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
app.secret_key = 'tu_clave_secreta_aqui'  # Necesaria para usar sesiones

# ======================
# CARGA DE DATOS
# ======================
def cargar_excel():
    if not EXCEL_FILE.exists():
        logger.error(f"No se encontró el archivo {EXCEL_FILE}")
        return pd.DataFrame()
    try:
        df = pd.read_excel(EXCEL_FILE, dtype=str).fillna("")
        logger.info(f"Archivo {EXCEL_FILE.name} cargado con éxito ({len(df)} registros)")
        logger.info(f"Columnas detectadas: {df.columns.tolist()}")
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
        "text": "Buen día, hablemos de nuestras plataformas de Core. ¿Qué te gustaría consultar el día de hoy?",
        "options": [
            {"text": "Alarmas de plataformas", "value": "1"},
            {"text": "Documentación de las plataformas", "value": "2"},
            {"text": "Incidentes activos de las plataformas", "value": "3"},
            {"text": "Estado operativo de las plataformas", "value": "4"},
            {"text": "Cambios activos en las plataformas", "value": "5"},
            {"text": "Hablar con el administrador de la plataforma", "value": "6"}
        ]
    }

def buscar_alarmas(numero, elemento):
    try:
        resultados = df[
            (df.iloc[:, 0].str.contains(numero, case=False, na=False)) &  # Primera columna (Numero alarma)
            (df.iloc[:, 1].str.contains(elemento, case=False, na=False))   # Segunda columna (Descripción alarma)
        ]
        
        if resultados.empty:
            return {"error": "No se encontraron alarmas con esos criterios"}
        
        alarmas = resultados.to_dict(orient='records')
        return {"alarmas": alarmas}
    except Exception as e:
        logger.error(f"Error en búsqueda: {e}")
        return {"error": str(e)}

# ======================
# RUTAS
# ======================
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/api/chatbot", methods=["POST"])
def chatbot():
    data = request.json
    user_input = data.get('message', '').strip()
    current_step = data.get('step', 'main_menu')
    
    # Reiniciar conversación si recibe un comando especial
    if user_input.lower() == 'reiniciar':
        current_step = 'main_menu'
    
    # Menú principal
    if current_step == 'main_menu':
        if user_input == '1':
            response = {"message": "Por favor ingrese el número de alarma que desea consultar:", "step": "get_alarm_number"}
        else:
            response = {
                "message": generar_menu_principal()["text"],
                "options": generar_menu_principal()["options"],
                "step": "main_menu"
            }
    
    # Obtener número de alarma
    elif current_step == 'get_alarm_number':
        session['alarm_number'] = user_input
        response = {"message": "Por favor ingresa el nombre del elemento que reporta la alarma:", "step": "get_element_name"}
    
    # Obtener elemento y mostrar resultados
    elif current_step == 'get_element_name':
        alarm_number = session.get('alarm_number', '')
        result = buscar_alarmas(alarm_number, user_input)
        
        if 'error' in result:
            response = {
                "message": result['error'] + "\n\n¿Deseas intentar con otros valores? (Sí/No)",
                "step": "retry_search"
            }
        else:
            alarmas = result['alarmas']
            message = f"🔍 Se encontraron {len(alarmas)} alarmas:\n\n"
            
            for alarma in alarmas:
                message += (
                    f"📌 Alarma: {alarma.get('Numero alarma', 'N/A')}\n"
                    f"📝 Descripción: {alarma.get('Descripción alarma', 'N/A')}\n"
                    f"⚠️ Severidad: {alarma.get('Severidad', 'N/A')}\n"
                    f"🛠 Acciones: {alarma.get('Acciones', 'N/A')}\n\n"
                )
            
            message += "¿Necesitas más información sobre alguna de estas alarmas? (Sí/No)"
            response = {"message": message, "step": "follow_up"}
    
    # Manejar reintento de búsqueda
    elif current_step == 'retry_search':
        if user_input.lower() in ['sí', 'si', 'yes']:
            response = {"message": "Por favor ingrese el número de alarma:", "step": "get_alarm_number"}
        else:
            response = {
                "message": generar_menu_principal()["text"],
                "options": generar_menu_principal()["options"],
                "step": "main_menu"
            }
    
    # Seguimiento después de mostrar resultados
    elif current_step == 'follow_up':
        if user_input.lower() in ['sí', 'si', 'yes']:
            response = {
                "message": "¿Qué información adicional necesitas?\n1. Documentación técnica\n2. Contactar a soporte\n3. Otras alarmas relacionadas",
                "step": "additional_info"
            }
        else:
            response = {
                "message": generar_menu_principal()["text"],
                "options": generar_menu_principal()["options"],
                "step": "main_menu"
            }
    
    # Información adicional
    elif current_step == 'additional_info':
        if user_input == '1':
            response = {"message": "Por favor ingresa el número de alarma para buscar documentación:", "step": "get_docs"}
        elif user_input == '2':
            response = {"message": "Conectándote con soporte técnico...", "step": "main_menu"}
        elif user_input == '3':
            response = {"message": "Por favor ingrese el número de alarma relacionada:", "step": "get_alarm_number"}
        else:
            response = {"message": "Opción no válida. ¿En qué más puedo ayudarte?", "step": "main_menu"}
    
    # Obtener documentación
    elif current_step == 'get_docs':
        # Aquí puedes implementar la lógica para buscar documentación
        response = {
            "message": f"Documentación para la alarma {user_input}: [Enlace o información]\n\n¿Necesitas algo más?",
            "step": "main_menu"
        }
    
    return jsonify(response)

@app.route("/buscar", methods=["GET"])
def buscar():
    numero = request.args.get("numero", "").strip()
    elemento = request.args.get("elemento", "").strip()

    if df.empty:
        return jsonify({"error": "No hay datos cargados"}), 500

    try:
        resultados = df[
            (df.iloc[:, 0].str.contains(numero, case=False, na=False)) &
            (df.iloc[:, 1].str.contains(elemento, case=False, na=False))
        ]
        return jsonify(resultados.to_dict(orient="records"))
    except Exception as e:
        logger.error(f"Error en búsqueda: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/instructivo/<nombre>")
def obtener_instructivo(nombre):
    archivo = f"{nombre}.pdf"
    ruta = INSTRUCTIVOS_DIR / archivo

    if ruta.exists():
        return send_from_directory(INSTRUCTIVOS_DIR, archivo)
    else:
        return jsonify({"error": "Instructivo no encontrado"}), 404

@app.route("/health")
def health():
    return "OK", 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)