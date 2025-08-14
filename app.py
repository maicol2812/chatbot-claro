from flask import Flask, render_template, request, send_from_directory, jsonify, session
import pandas as pd
import os
import logging
from pathlib import Path
from werkzeug.middleware.proxy_fix import ProxyFix

# ======================
# CONFIGURACIÓN GLOBAL
# ======================
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "static" / "data"
EXCEL_FILE = DATA_DIR / "alarmasCMM.xlsx"
INSTRUCTIVOS_DIR = BASE_DIR / "instructivos"

# ======================
# APP FLASK
# ======================
app = Flask(__name__, template_folder="templates", static_folder="static")
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'dev-key-segura')  # Mejor práctica para clave secreta

# ======================
# CARGA DE DATOS
# ======================
def cargar_excel():
    if not EXCEL_FILE.exists():
        logger.error(f"No se encontró el archivo {EXCEL_FILE}")
        return pd.DataFrame()
    try:
        df = pd.read_excel(EXCEL_FILE, dtype=str).fillna("")
        # Normalizar nombres de columnas
        df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')
        logger.info(f"Archivo {EXCEL_FILE.name} cargado con éxito ({len(df)} registros)")
        logger.debug(f"Columnas detectadas: {df.columns.tolist()}")
        return df
    except Exception as e:
        logger.error(f"Error al leer {EXCEL_FILE.name}: {e}")
        return pd.DataFrame()

df = cargar_excel()

# ======================
# FUNCIONES AUXILIARES
# ======================
def generar_menu_principal():
    return {
        "text": "Buen día, hablemos de nuestras plataformas de Core. ¿Qué te gustaría consultar hoy?",
        "options": [
            {"text": "🛎️ Alarmas", "value": "1", "icon": "bi-alarm"},
            {"text": "📄 Documentación", "value": "2", "icon": "bi-file-earmark-text"},
            {"text": "⚠️ Incidentes", "value": "3", "icon": "bi-exclamation-triangle"},
            {"text": "📊 Estado operativo", "value": "4", "icon": "bi-graph-up"},
            {"text": "🔄 Cambios programados", "value": "5", "icon": "bi-calendar-check"},
            {"text": "👨‍💻 Contactar soporte", "value": "6", "icon": "bi-headset"}
        ],
        "quick_actions": [
            {"text": "🔍 Buscar alarmas críticas", "value": "criticas"},
            {"text": "🆘 Soporte urgente", "value": "soporte_urgente"}
        ]
    }

def buscar_alarmas(numero="", elemento="", severidad=""):
    try:
        query = []
        if numero:
            query.append(f"numero_alarma.str.contains('{numero}', case=False, na=False)")
        if elemento:
            query.append(f"nombre_del_elemento.str.contains('{elemento}', case=False, na=False)")
        if severidad:
            query.append(f"severidad.str.contains('{severidad}', case=False, na=False)")
        
        if not query:
            return pd.DataFrame()
            
        full_query = " & ".join(query)
        resultados = df.query(full_query) if query else df
        
        return resultados
    except Exception as e:
        logger.error(f"Error en búsqueda: {e}")
        return pd.DataFrame()

def formatear_alarmas(alarmas_df):
    if alarmas_df.empty:
        return []
    
    return alarmas_df.to_dict('records')

# ======================
# RUTAS MEJORADAS
# ======================
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/api/chatbot", methods=["POST"])
def chatbot():
    data = request.json
    user_input = data.get('message', '').strip().lower()
    current_step = data.get('step', 'main_menu')
    context = data.get('context', {})
    
    logger.info(f"Paso actual: {current_step}, Input: {user_input}")
    
    # Manejo de comandos especiales
    if user_input in ['reiniciar', 'reset', 'menu']:
        return jsonify({
            "message": generar_menu_principal()["text"],
            "options": generar_menu_principal()["options"],
            "quick_actions": generar_menu_principal()["quick_actions"],
            "step": "main_menu"
        })
    
    # Máquina de estados del chatbot
    response = {
        "step": current_step,
        "context": context
    }
    
    if current_step == 'main_menu':
        handle_main_menu(user_input, response)
    elif current_step == 'get_alarm_number':
        handle_get_alarm_number(user_input, response, context)
    elif current_step == 'get_element_name':
        handle_get_element_name(user_input, response, context)
    elif current_step == 'retry_search':
        handle_retry_search(user_input, response)
    elif current_step == 'show_results':
        handle_show_results(user_input, response, context)
    elif current_step == 'additional_info':
        handle_additional_info(user_input, response, context)
    elif current_step == 'get_docs':
        handle_get_docs(user_input, response, context)
    else:
        response.update({
            "message": "Disculpa, hubo un error en la conversación. Reiniciando...",
            "step": "main_menu"
        })
    
    return jsonify(response)

# ======================
# MANEJADORES DE ESTADOS
# ======================
def handle_main_menu(user_input, response):
    if user_input == '1':
        response.update({
            "message": "Por favor ingrese el número de alarma que desea consultar:",
            "step": "get_alarm_number"
        })
    elif user_input == 'criticas':
        alarmas = buscar_alarmas(severidad="critica|alta")
        if not alarmas.empty:
            response.update({
                "message": f"⚠️ Se encontraron {len(alarmas)} alarmas críticas/altas:",
                "alarmas": formatear_alarmas(alarmas),
                "step": "show_results",
                "context": {"tipo_busqueda": "criticas"}
            })
        else:
            response.update({
                "message": "No se encontraron alarmas críticas en este momento.",
                "step": "main_menu"
            })
    else:
        menu = generar_menu_principal()
        response.update({
            "message": menu["text"],
            "options": menu["options"],
            "quick_actions": menu["quick_actions"],
            "step": "main_menu"
        })

def handle_get_alarm_number(user_input, response, context):
    if not user_input:
        response.update({
            "message": "Por favor ingrese un número de alarma válido:",
            "step": "get_alarm_number"
        })
    else:
        context['alarm_number'] = user_input
        response.update({
            "message": "Por favor ingresa el nombre del elemento que reporta la alarma:",
            "step": "get_element_name",
            "context": context
        })

def handle_get_element_name(user_input, response, context):
    if not user_input:
        response.update({
            "message": "Por favor ingrese un nombre de elemento válido:",
            "step": "get_element_name"
        })
    else:
        alarmas = buscar_alarmas(
            numero=context.get('alarm_number', ''),
            elemento=user_input
        )
        
        if alarmas.empty:
            response.update({
                "message": "No se encontraron alarmas con esos criterios. ¿Deseas intentar con otros valores? (Sí/No)",
                "step": "retry_search",
                "context": context
            })
        else:
            context['alarmas'] = formatear_alarmas(alarmas)
            response.update({
                "message": f"🔍 Se encontraron {len(alarmas)} alarmas:",
                "alarmas": context['alarmas'],
                "step": "show_results",
                "context": context,
                "options": [
                    {"text": "Ver detalles completos", "value": "detalles"},
                    {"text": "Documentación relacionada", "value": "documentacion"},
                    {"text": "Otras alarmas del elemento", "value": "mas_alarmas"}
                ]
            })

def handle_retry_search(user_input, response):
    if user_input in ['sí', 'si', 's', 'yes']:
        response.update({
            "message": "Por favor ingrese el número de alarma:",
            "step": "get_alarm_number"
        })
    else:
        response.update({
            "message": generar_menu_principal()["text"],
            "options": generar_menu_principal()["options"],
            "quick_actions": generar_menu_principal()["quick_actions"],
            "step": "main_menu"
        })

def handle_show_results(user_input, response, context):
    if user_input == 'detalles':
        response.update({
            "message": "Detalles completos de las alarmas:",
            "alarmas": context.get('alarmas', []),
            "step": "show_detailed_results",
            "context": context
        })
    elif user_input == 'documentacion':
        response.update({
            "message": "Por favor ingresa el número de alarma para buscar documentación:",
            "step": "get_docs",
            "context": context
        })
    else:
        response.update({
            "message": "¿Necesitas algo más sobre estas alarmas?",
            "step": "follow_up",
            "context": context,
            "options": [
                {"text": "Sí, más información", "value": "si"},
                {"text": "No, volver al menú", "value": "no"}
            ]
        })

def handle_additional_info(user_input, response, context):
    if user_input in ['1', 'documentacion']:
        response.update({
            "message": "Por favor ingresa el número de alarma para buscar documentación:",
            "step": "get_docs",
            "context": context
        })
    elif user_input in ['2', 'soporte']:
        response.update({
            "message": "Conectándote con soporte técnico... Un especialista se comunicará contigo pronto.",
            "step": "main_menu"
        })
    else:
        response.update({
            "message": "Opción no válida. ¿En qué más puedo ayudarte?",
            "step": "main_menu"
        })

def handle_get_docs(user_input, response, context):
    # Aquí iría la lógica para buscar documentación
    # Por ahora simulamos la respuesta
    response.update({
        "message": f"📄 Documentación técnica para la alarma {user_input}:\n\n"
                   f"1. Manual de procedimientos: [link]\n"
                   f"2. Diagrama de flujo: [link]\n"
                   f"3. Histórico de incidentes: [link]\n\n"
                   f"¿Necesitas algo más?",
        "step": "main_menu"
    })

# ======================
# RUTAS API
# ======================
@app.route("/api/alarmas", methods=["GET"])
def buscar_alarmas_api():
    numero = request.args.get("numero", "").strip()
    elemento = request.args.get("elemento", "").strip()
    severidad = request.args.get("severidad", "").strip()
    
    try:
        resultados = buscar_alarmas(numero=numero, elemento=elemento, severidad=severidad)
        return jsonify({
            "success": True,
            "count": len(resultados),
            "alarmas": formatear_alarmas(resultados)
        })
    except Exception as e:
        logger.error(f"Error en API búsqueda: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route("/api/alarmas/<alarma_id>", methods=["GET"])
def detalle_alarma(alarma_id):
    try:
        alarma = df[df['numero_alarma'].str.contains(alarma_id, case=False, na=False)]
        if alarma.empty:
            return jsonify({"success": False, "error": "Alarma no encontrada"}), 404
            
        return jsonify({
            "success": True,
            "alarma": alarma.iloc[0].to_dict()
        })
    except Exception as e:
        logger.error(f"Error obteniendo alarma {alarma_id}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/instructivo/<nombre>")
def obtener_instructivo(nombre):
    archivo = f"{nombre}.pdf"
    ruta = INSTRUCTIVOS_DIR / archivo

    if ruta.exists():
        return send_from_directory(INSTRUCTIVOS_DIR, archivo, as_attachment=False)
    return jsonify({"error": "Instructivo no encontrado"}), 404

@app.route("/health")
def health():
    return jsonify({
        "status": "OK",
        "alarmas_cargadas": len(df),
        "servicio": "Chatbot Alarmas Claro"
    })

# ======================
# INICIO DE LA APLICACIÓN
# ======================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)