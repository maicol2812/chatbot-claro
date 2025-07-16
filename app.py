from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import pandas as pd
import os
import re
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Estado de usuarios
usuarios = {}

# Configuración del archivo Excel
ruta_excel = os.path.join(os.path.dirname(__file__), "Ejemplo de alarmas CMM.xlsx")

def init_excel():
    """Inicializa la conexión con el archivo Excel"""
    if not os.path.exists(ruta_excel):
        raise FileNotFoundError(f"⚠️ Archivo no encontrado en: {ruta_excel}")
    
    df = pd.read_excel(ruta_excel, engine="openpyxl")
    
    # Normalizar nombres de columnas
    df.columns = df.columns.str.strip().str.lower()
    
    # Mapear columnas a nombres estándar
    column_mapping = {
        'numero alarma': 'numero_alarma',
        'número alarma': 'numero_alarma',
        'nombre del elemento': 'elemento',
        'descripción alarma': 'descripcion',
        'descripcion alarma': 'descripcion',
        'severidad': 'severidad',
        'significado': 'significado',
        'acciones': 'acciones'
    }
    
    # Renombrar columnas
    for old_name, new_name in column_mapping.items():
        if old_name in df.columns:
            df = df.rename(columns={old_name: new_name})
    
    # Verificar columnas necesarias
    required_columns = ['numero_alarma', 'elemento']
    missing_columns = [col for col in required_columns if col not in df.columns]
    
    if missing_columns:
        raise KeyError(f"❌ Columnas faltantes: {missing_columns}")
    
    # Limpiar y normalizar datos
    df['numero_alarma'] = df['numero_alarma'].astype(str).str.strip()
    df['elemento'] = df['elemento'].astype(str).str.lower().str.strip()
    
    # Llenar valores NaN con cadenas vacías
    df = df.fillna('')
    
    return df

# Inicializar DataFrame
try:
    df = init_excel()
    print("✅ Base de datos de alarmas cargada correctamente")
except Exception as e:
    print(f"❌ Error al cargar base de datos: {e}")
    df = pd.DataFrame()

def get_user_state(user_id):
    """Obtiene el estado del usuario"""
    if user_id not in usuarios:
        usuarios[user_id] = {
            "estado": "inicio",
            "numero_alarma": None,
            "elemento": None,
            "historial": [],
            "timestamp": datetime.now()
        }
    return usuarios[user_id]

def set_user_state(user_id, estado, **kwargs):
    """Actualiza el estado del usuario"""
    user_data = get_user_state(user_id)
    user_data["estado"] = estado
    user_data["timestamp"] = datetime.now()
    
    for key, value in kwargs.items():
        user_data[key] = value

def buscar_alarma(numero_alarma, elemento):
    """Busca una alarma específica en la base de datos"""
    if df.empty:
        return None, "Base de datos no disponible"
    
    # Búsqueda exacta
    resultado = df[
        (df['numero_alarma'].str.contains(numero_alarma, case=False, na=False)) &
        (df['elemento'].str.contains(elemento, case=False, na=False))
    ]
    
    if not resultado.empty:
        return resultado.iloc[0].to_dict(), None
    
    # Búsqueda parcial por número de alarma
    resultado_parcial = df[df['numero_alarma'].str.contains(numero_alarma, case=False, na=False)]
    
    if not resultado_parcial.empty:
        return None, f"Se encontraron {len(resultado_parcial)} alarmas con número '{numero_alarma}', pero ninguna coincide con el elemento '{elemento}'"
    
    return None, "No se encontró ninguna alarma con esos criterios"

def format_alarm_response(alarm_data):
    """Formatea la respuesta de una alarma encontrada"""
    severity_colors = {
        'baja': '🟢',
        'media': '🟡', 
        'alta': '🔴',
        'major': '🔴',
        'critical': '🚨'
    }
    
    severidad = str(alarm_data.get('severidad', '')).lower()
    color_icon = severity_colors.get(severidad, '⚪')
    
    response = f"""
🔔 <b>Alarma encontrada:</b>

📋 <b>Número de alarma:</b> {alarm_data.get('numero_alarma', 'N/A')}
🔧 <b>Elemento:</b> {alarm_data.get('elemento', 'N/A')}
📝 <b>Descripción:</b> {alarm_data.get('descripcion', 'N/A')}
{color_icon} <b>Severidad:</b> {alarm_data.get('severidad', 'N/A')}
💡 <b>Significado:</b> {alarm_data.get('significado', 'N/A')}
🛠️ <b>Acciones recomendadas:</b> {alarm_data.get('acciones', 'N/A')}
"""
    
    return response.strip()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json()
        message = data.get("message", "").strip()
        user_id = data.get("user_id", "default_user")
        
        if not message:
            return jsonify({"error": "Mensaje vacío"}), 400
        
        user_state = get_user_state(user_id)
        estado_actual = user_state["estado"]
        
        # Agregar mensaje al historial
        user_state["historial"].append({
            "timestamp": datetime.now(),
            "message": message,
            "type": "user"
        })
        
        response_data = process_message(message, user_id, estado_actual)
        
        # Agregar respuesta al historial
        user_state["historial"].append({
            "timestamp": datetime.now(),
            "message": response_data["response"],
            "type": "bot"
        })
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"Error en /chat: {e}")
        return jsonify({
            "response": "Lo siento, hubo un error interno. Por favor intenta nuevamente.",
            "type": "error"
        }), 500

def process_message(message, user_id, estado_actual):
    """Procesa el mensaje según el estado actual del usuario"""
    message_lower = message.lower().strip()
    
    if estado_actual == "inicio":
        return handle_inicio(message_lower, user_id)
    elif estado_actual == "esperando_numero_alarma":
        return handle_numero_alarma(message, user_id)
    elif estado_actual == "esperando_elemento":
        return handle_elemento(message, user_id)
    else:
        # Estado desconocido, reiniciar
        set_user_state(user_id, "inicio")
        return handle_inicio(message_lower, user_id)

def handle_inicio(message, user_id):
    """Maneja el estado inicial y el menú principal"""
    
    # Mensaje de bienvenida automático
    if message in ["inicio", "start", "comenzar", "hola", "buenas", "buen día"]:
        welcome_message = """Buen día, hablemos de nuestras plataformas de Core.

¿Qué te gustaría consultar el día de hoy?

1. Alarmas de plataformas.
2. Documentación de las plataformas.
3. Incidentes activos de las plataformas.
4. Estado operativo de las plataformas.
5. Cambios activos en las plataformas.
6. Hablar con el administrador de la plataforma."""
        
        return {
            "response": welcome_message,
            "type": "menu",
            "suggestions": ["1", "2", "3", "4", "5", "6"]
        }
    
    # Opción 1: Alarmas de plataformas
    if message in ["1", "alarmas", "alarmas de plataformas"]:
        set_user_state(user_id, "esperando_numero_alarma")
        return {
            "response": "Por favor, ingresa el número de alarma que deseas consultar:",
            "type": "request_input",
            "suggestions": ["12345", "67890", "11111"]
        }
    
    # Opción 2: Documentación
    elif message in ["2", "documentacion", "documentación"]:
        return {
            "response": """📄 <b>Documentación técnica disponible:</b>

• Manual de procedimientos
• Guías de configuración
• Documentación de API
• Manuales de usuario

¿Qué tipo de documentación necesitas?""",
            "type": "info",
            "suggestions": ["Manual de procedimientos", "Guías de configuración", "Volver al menú"]
        }
    
    # Opción 3: Incidentes activos
    elif message in ["3", "incidentes", "incidentes activos"]:
        return {
            "response": """🚨 <b>Estado de incidentes:</b>

✅ No hay incidentes críticos activos
📊 Última actualización: """ + datetime.now().strftime("%H:%M") + """
🔍 Monitoreo continuo activo

¿Deseas reportar un incidente?""",
            "type": "info",
            "suggestions": ["Reportar incidente", "Ver historial", "Volver al menú"]
        }
    
    # Opción 4: Estado operativo
    elif message in ["4", "estado", "estado operativo"]:
        return {
            "response": """🟢 <b>Estado operativo de las plataformas:</b>

✅ Todas las plataformas operativas
📈 Rendimiento: Normal
🔧 Mantenimiento programado: Ninguno

Sistema funcionando correctamente.""",
            "type": "info",
            "suggestions": ["Ver detalles", "Programar mantenimiento", "Volver al menú"]
        }
    
    # Opción 5: Cambios activos
    elif message in ["5", "cambios", "cambios activos"]:
        return {
            "response": """🔄 <b>Cambios en las plataformas:</b>

📋 No hay cambios activos actualmente
⏰ Última revisión: """ + datetime.now().strftime("%H:%M") + """
📅 Próxima ventana de cambios: Por definir

¿Necesitas programar un cambio?""",
            "type": "info",
            "suggestions": ["Programar cambio", "Ver historial", "Volver al menú"]
        }
    
    # Opción 6: Contactar administrador
    elif message in ["6", "administrador", "contactar", "hablar con administrador"]:
        return {
            "response": """👨‍💼 <b>Contacto con el administrador:</b>

📧 Email: 38514121@claro.com.co
📞 Teléfono: +573213445747
💬 Disponible: Lunes a Viernes 8:00 AM - 6:00 PM

¿Cómo prefieres contactarlo?""",
            "type": "contact",
            "suggestions": ["Enviar email", "Llamar", "Volver al menú"]
        }
    
    # Comando para volver al menú
    elif message in ["menu", "menú", "volver", "volver al menú"]:
        return handle_inicio("inicio", user_id)
    
    # Mensaje no reconocido
    else:
        return {
            "response": """❓ No entendí tu solicitud. Por favor selecciona una opción:

1. Alarmas de plataformas
2. Documentación de las plataformas
3. Incidentes activos de las plataformas
4. Estado operativo de las plataformas
5. Cambios activos en las plataformas
6. Hablar con el administrador de la plataforma

O escribe "menú" para ver las opciones.""",
            "type": "error",
            "suggestions": ["1", "2", "3", "4", "5", "6", "menú"]
        }

def handle_numero_alarma(message, user_id):
    """Maneja la entrada del número de alarma"""
    numero_alarma = message.strip()
    
    if not numero_alarma:
        return {
            "response": "Por favor ingresa un número de alarma válido:",
            "type": "error",
            "suggestions": ["12345", "67890", "Volver al menú"]
        }
    
    # Guardar número de alarma y solicitar elemento
    set_user_state(user_id, "esperando_elemento", numero_alarma=numero_alarma)
    
    return {
        "response": f"Número de alarma: {numero_alarma}\n\nAhora, por favor ingresa el nombre del elemento que reporta la alarma:",
        "type": "request_input",
        "suggestions": ["Motor principal", "Válvula de seguridad", "Sensor de temperatura", "Volver al menú"]
    }

def handle_elemento(message, user_id):
    """Maneja la entrada del elemento y realiza la búsqueda"""
    user_state = get_user_state(user_id)
    numero_alarma = user_state.get("numero_alarma")
    elemento = message.strip()
    
    if not elemento:
        return {
            "response": "Por favor ingresa el nombre del elemento:",
            "type": "error",
            "suggestions": ["Motor principal", "Válvula de seguridad", "Volver al menú"]
        }
    
    # Buscar alarma
    alarm_data, error = buscar_alarma(numero_alarma, elemento)
    
    # Resetear estado después de la búsqueda
    set_user_state(user_id, "inicio")
    
    if alarm_data:
        return {
            "response": format_alarm_response(alarm_data),
            "type": "alarm_found",
            "suggestions": ["Consultar otra alarma", "Volver al menú"]
        }
    else:
        return {
            "response": f"❌ {error}\n\n¿Deseas intentar con otros criterios?",
            "type": "alarm_not_found",
            "suggestions": ["Intentar de nuevo", "Volver al menú"]
        }

# Ruta para obtener estadísticas (opcional)
@app.route("/stats", methods=["GET"])
def get_stats():
    """Obtiene estadísticas de uso del chatbot"""
    total_users = len(usuarios)
    active_users = sum(1 for user in usuarios.values() 
                      if (datetime.now() - user["timestamp"]).seconds < 3600)
    
    return jsonify({
        "total_users": total_users,
        "active_users": active_users,
        "database_records": len(df) if not df.empty else 0,
        "timestamp": datetime.now().isoformat()
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug_mode = os.environ.get("FLASK_DEBUG", "False").lower() == "true"
    
    print(f"🚀 Iniciando chatbot en puerto {port}")
    print(f"📊 Base de datos: {len(df)} registros cargados" if not df.empty else "❌ Base de datos vacía")
    
    app.run(host="0.0.0.0", port=port, debug=debug_mode)