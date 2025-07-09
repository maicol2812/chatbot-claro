from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import pandas as pd, os, datetime, sqlite3, logging
from difflib import get_close_matches
from deep_translator import GoogleTranslator
from collections import defaultdict

app = Flask(__name__)
CORS(app, resources={r"/chat": {"origins": "*"}})

app.config['SECRET_KEY']    = 'claro-secret-key-2024'
app.config['JWT_ALGORITHM'] = 'HS256'

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ────────────────────
usuarios = {}
metricas_sistema = defaultdict(int)
alertas_activas  = {}
sesiones_activas = {}

# ───── Excel
ruta_excel = os.path.join(os.path.dirname(__file__), 'Ejemplo de alarmas CMM.xlsx')
df = pd.read_excel(ruta_excel, engine='openpyxl')
df.columns = df.columns.str.strip().str.lower()
df['numero alarma']      = df['numero alarma'].astype(str).str.strip()
df['nombre del elemento']= df['nombre del elemento'].str.strip().str.lower()

# ───── Helpers
def traducir(t):
    try: return GoogleTranslator(source='auto', target='es').translate(t)
    except: return t

def menu_principal():
    return ("🎯 **ASESOR CLARO - MENÚ AVANZADO**\n"
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
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

mensajes_personalizados = {
  "estado sistema":"📊 Consultando estado...",
  "dashboard":"📈 Mostrando métricas...",
  "emergencia":"🚨 EMERGENCIA, escalando..."
}

# ───── Rutas
@app.route('/')
def index(): return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json(force=True)
    msg  = (data.get('message') or '').strip().lower()
    uid  = data.get('user_id','userAnon')

    if uid not in usuarios:
        usuarios[uid] = {'estado':'inicio','num':None}

    estado = usuarios[uid]['estado']

    # Emergencia directa
    if msg in ('emergencia','urgente','crítico'):
        return jsonify({"response": mensajes_personalizados['emergencia'], "tipo":"emergencia"})

    # Respuestas predefinidas
    if msg in mensajes_personalizados:
        return jsonify({"response": mensajes_personalizados[msg], "tipo":"predef"})

    # Lógica paso a paso
    if estado == 'inicio':
        if msg == '1':
            usuarios[uid]['estado'] = 'espera_num'
            return jsonify({"response": "🔍 Ingresa el número de alarma:", "tipo":"sistema"})
        else:
            return jsonify({"response": menu_principal(), "tipo":"menu"})

    elif estado == 'espera_num':
        usuarios[uid]['num'] = msg
        usuarios[uid]['estado'] = 'espera_elem'
        return jsonify({"response":"✅ Ahora escribe el nombre del elemento:", "tipo":"sistema"})

    elif estado == 'espera_elem':
        num  = usuarios[uid]['num']
        elem = msg
        usuarios[uid]['estado']='inicio'

        posible = get_close_matches(elem, df['nombre del elemento'], n=1, cutoff=0.45)
        if not posible:
            return jsonify({"response":"❌ Elemento no encontrado.\n\n"+menu_principal(), "tipo":"error"})
        fila = df[(df['numero alarma']==num) & (df['nombre del elemento']==posible[0])]
        if fila.empty:
            return jsonify({"response":"❌ Número y elemento no coinciden.\n\n"+menu_principal(),"tipo":"error"})

        f = fila.iloc[0]
        respuesta = (f"🎯 **ALARMA {num} ENCONTRADA**\n"
                     f"Descripción: {traducir(str(f.get('descripción alarma','N/A')))}\n"
                     f"Severidad  : {traducir(str(f.get('severidad','N/A')))}\n"
                     f"Acciones   : {traducir(str(f.get('acciones','N/A')))}")
        return jsonify({"response": respuesta, "tipo":"resultado"})

    return jsonify({"response": menu_principal(), "tipo":"menu"})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.getenv('PORT',5000)))
