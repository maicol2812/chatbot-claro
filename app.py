from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import pandas as pd
import os
from difflib import get_close_matches
from deep_translator import GoogleTranslator
import datetime, re, sqlite3, hashlib, logging
from collections import defaultdict

# ────────────────────────────
# 1. Config básica de Flask
# ────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/chat": {"origins": "*"}})          # ← abre CORS a cualquier origen

app.config['SECRET_KEY']    = 'claro-secret-key-2024'
app.config['JWT_ALGORITHM'] = 'HS256'

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ────────────────────────────
# 2. Estructuras en memoria
# ────────────────────────────
usuarios             = {}
sesiones_activas     = {}
metricas_sistema     = defaultdict(int, {
    'consultas_totales'       : 0,
    'tiempo_respuesta_total'  : 0,
    'satisfaccion_total'      : 0,
    'evaluaciones_satisfaccion': 0
})
alertas_activas        = {}
historial_conversaciones = defaultdict(list)
predicciones_ia        = {}

# ────────────────────────────
# 3. Base de datos SQLite
# ────────────────────────────
def init_db():
    try:
        conn = sqlite3.connect('chatbot.db')
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS conversaciones(
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              usuario_id TEXT,
              mensaje TEXT,
              respuesta TEXT,
              timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
              sentimiento TEXT,
              categoria TEXT
            )
        ''')
        c.execute('''
            CREATE TABLE IF NOT EXISTS metricas(
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              fecha DATE,
              consultas_totales INTEGER,
              tiempo_respuesta_promedio REAL,
              satisfaccion_promedio REAL
            )
        ''')
        conn.commit()
        conn.close()

    except sqlite3.Error as e:
        logger.error(f"Error en la base de datos SQLite: {str(e)}")
        raise

# ────────────────────────────
# 4. Carga del Excel
# ────────────────────────────
# Carga del Excel con manejo de errores
ruta_excel = os.path.join(os.path.dirname(__file__), "Ejemplo de alarmas CMM.xlsx")
try:
    if not os.path.exists(ruta_excel):
        raise FileNotFoundError(f"⚠️ Archivo no encontrado: {ruta_excel}")

    df = pd.read_excel(ruta_excel, engine='openpyxl')
    df.columns = df.columns.str.strip().str.lower()
    if "numero alarma" not in df.columns or "nombre del elemento" not in df.columns:
        raise KeyError("❌ Falta una de las columnas requeridas")

    df["numero alarma"] = df["numero alarma"].astype(str).str.strip()
    df["nombre del elemento"] = df["nombre del elemento"].str.strip().str.lower()

except (FileNotFoundError, KeyError, ValueError) as e:
    logger.error(f"Error al cargar el archivo Excel: {str(e)}")
    raise


# ────────────────────────────
# 5. Funciones de ayuda (idénticas a las tuyas, solo compactadas)
# ────────────────────────────
def analizar_sentimiento(txt):
    pos = ['gracias','perfecto','excelente','bien','correcto','genial']
    neg = ['problema','error','mal','fallo','urgente','crítico']
    score = sum(w in txt.lower() for w in pos) - sum(w in txt.lower() for w in neg)
    return "positivo" if score>0 else "negativo" if score<0 else "neutral"

def traducir(t): 
    try: return GoogleTranslator(source='auto', target='es').translate(t)
    except: return t

def predecir_problema_potencial(txt):
    crit = ['caída','down','offline','falla masiva','crítico','sin servicio','no funciona','emergencia']
    return any(c in txt.lower() for c in crit)

def menu_principal():
    return (
      "🎯 **ASESOR CLARO - MENÚ AVANZADO**\n"
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
      "1️⃣ Consultar alarmas de plataformas\n"
      "2️⃣ Documentación técnica avanzada\n"
      "3️⃣ Monitoreo de incidentes activos\n"
      "4️⃣ Dashboard de estado operativo\n"
      "5️⃣ Gestión de cambios programados\n"
      "6️⃣ Contactar especialista técnico\n"
      "🔮 **FUNCIONES IA AVANZADAS**\n"
      "7️⃣ Análisis predictivo de problemas\n"
      "8️⃣ Recomendaciones inteligentes\n"
      "9️⃣ Reportes automáticos\n"
      "🆘 **EMERGENCIA** - Escalamiento crítico\n"
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    )

# Diccionario de mensajes rápidos sin cambios
mensajes_personalizados = {
    "arreglar alerta": "🔧 Para arreglar una alerta...",
    "configurar alerta": "⚙️ Las alertas se configuran...",
    "solucion alerta": "💡 Una solución típica...",
    "estado sistema": "📊 Consultando estado...",
    "ayuda avanzada": "🤖 Funciones avanzadas...",
    "dashboard": "📈 Mostrando métricas...",
    "escalamiento": "📞 Iniciando escalamiento..."
}

# ------------------------------------------------------------------
# 6. Rutas Flask
# ------------------------------------------------------------------
@app.route('/')
def index(): return render_template('index.html')

@app.route('/metricas')
def obtener_metricas():
    total = metricas_sistema['consultas_totales']
    return jsonify({
        "consultas_totales"        : total,
        "tiempo_respuesta_promedio": metricas_sistema['tiempo_respuesta_total'] / max(total,1),
        "alertas_activas"          : len(alertas_activas),
        "sesiones_activas"         : len(sesiones_activas),
        "satisfaccion_promedio"    : metricas_sistema['satisfaccion_total'] / max(metricas_sistema['evaluaciones_satisfaccion'],1)
    })

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json(force=True)
        msg = (data.get("message") or "").strip()
        if not msg:
            return jsonify({"response": "⚠️ Por favor, ingrese un mensaje.", "tipo": "error"})

        uid = data.get("user_id", "usuario1")
        # Lógica del chat aquí...
        
    except Exception as e:
        logger.error(f"Error en el procesamiento del mensaje: {str(e)}")
        return jsonify({"response": "❌ Hubo un error al procesar tu mensaje. Intenta nuevamente.", "tipo": "error"})

    # ── Registro de usuario ─────────────────
    if uid not in usuarios:
        usuarios[uid] = {"estado":"inicio", "numero_alarma":None}

    estado = usuarios[uid]['estado']
    msg_low = msg.lower()

    # ── Menú vacío para mensajes vacíos ────
    if not msg_low:
        return jsonify({"response": menu_principal(), "tipo":"menu"})

    # ── Emergencias rápidas ─────────────────
    if msg_low in ("emergencia","urgente","crítico"):
        return jsonify({
            "response":"🚨 **PROTOCOLO DE EMERGENCIA ACTIVADO**",
            "tipo":"emergencia"
        })

    # ── Mensajes predefinidos ───────────────
    if msg_low in mensajes_personalizados:
        return jsonify({"response": mensajes_personalizados[msg_low], "tipo":"personalizada"})

    # ── Lógica de estados: Inicio → espera_alarma → espera_elemento ──
    if estado == "inicio":
        if msg_low == "1":
            usuarios[uid]['estado'] = "espera_alarma"
            return jsonify({"response":"🔍 Ingresa el número de alarma:", "tipo":"sistema"})
        else:
            return jsonify({"response": menu_principal(), "tipo":"menu"})

    elif estado == "espera_alarma":
        usuarios[uid]['numero_alarma'] = msg_low
        usuarios[uid]['estado']        = "espera_elemento"
        return jsonify({"response":"✅ Ahora el nombre del elemento:", "tipo":"sistema"})

    elif estado == "espera_elemento":
        num = usuarios[uid]['numero_alarma']
        elem= msg_low
        usuarios[uid]['estado'] = "inicio"

        posibles = get_close_matches(elem, df["nombre del elemento"], n=1, cutoff=0.4)
        if not posibles:
            return jsonify({"response":"❌ Elemento no encontrado.\n\n"+menu_principal(),"tipo":"error"})

        fila = df[(df["numero alarma"]==num)&(df["nombre del elemento"]==posibles[0])]
        if fila.empty:
            return jsonify({"response":"❌ Alarma/Elemento no coinciden.\n\n"+menu_principal(),"tipo":"error"})

        f = fila.iloc[0]
        resp = (
          f"🎯 **ALARMA {num} ENCONTRADA**\n"
          f"Descripción: {traducir(str(f.get('descripción alarma','N/A')))}\n"
          f"Severidad: {traducir(str(f.get('severidad','N/A')))}\n"
          f"Acciones: {traducir(str(f.get('acciones','N/A')))}"
        )
        return jsonify({"response":resp,"tipo":"resultado_alarma"})

    # ── Caso por defecto ────────────────────
    return jsonify({"response":menu_principal(),"tipo":"menu"})

# ------------------------------------------------------------------
if __name__ == "__main__":
    port = int(os.getenv("PORT",5000))
    app.run(host='0.0.0.0', port=port, debug=True)
