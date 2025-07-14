from flask import Flask, request, jsonify
import pandas as pd
import sqlite3
from deep_translator import GoogleTranslator
from textblob import TextBlob
import time
from datetime import datetime

app = Flask(__name__)

# Configuración
DATABASE = 'database.db'
ALARMS_FILE = 'Ejemplo de alarmas CMM.xlsx'
EMERGENCY_KEYWORDS = ['emergencia', 'urgente', 'ayuda', 'error', 'falla']

# Inicializar base de datos
def init_db():
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    
    c.execute('''CREATE TABLE IF NOT EXISTS conversations
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  user_id TEXT,
                  message TEXT,
                  response TEXT,
                  sentiment REAL,
                  timestamp DATETIME)''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS metrics
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  user_id TEXT,
                  alarms_checked INTEGER,
                  emergencies INTEGER,
                  response_time REAL,
                  timestamp DATETIME)''')
    
    conn.commit()
    conn.close()

# Cargar alarmas desde Excel
def load_alarms():
    try:
        df = pd.read_excel(ALARMS_FILE)
        return df.to_dict('records')
    except Exception as e:
        print(f"Error loading alarms: {e}")
        return []

# Análisis de sentimiento
def analyze_sentiment(text):
    analysis = TextBlob(text)
    return analysis.sentiment.polarity

# Manejo de emergencias
def check_emergency(message):
    return any(keyword in message.lower() for keyword in EMERGENCY_KEYWORDS)

# Ruta raíz para evitar el 404
@app.route('/')
def home():
     return render_template('index.html')
            

# Ruta principal del chatbot
@app.route('/chat', methods=['POST'])
def chat():

    start_time = time.time()
    data = request.json
    user_message = data['message']
    user_id = data.get('user_id', 'anonymous')
    is_emergency = data.get('isEmergency', False)
    
    # Procesamiento del mensaje
    response = process_message(user_message, is_emergency)
    sentiment = analyze_sentiment(user_message)
    
    # Guardar en base de datos
    save_conversation(user_id, user_message, response['response'], sentiment)
    
    # Métricas
    response_time = time.time() - start_time
    save_metrics(user_id, response.get('alarms_checked', 0), 
               1 if is_emergency else 0, response_time)
    
    return jsonify(response)

# Actualizar la función process_message para manejar el nuevo flujo
def process_message(message, is_emergency):
    # Comandos especiales
    if message.lower() == 'menu':
        return {
            'response': 'Buen día, hablemos de nuestras plataformas de Core. ¿Qué te gustaría consultar el día de hoy?\n\n1. Alarmas de plataformas\n2. Documentación de las plataformas\n3. Incidentes activos de las plataformas\n4. Estado operativo de las plataformas\n5. Cambios activos en las plataformas\n6. Hablar con el administrador de la plataforma',
            'type': 'menu'
        }
    
    if message.lower() == '1' or 'alarma' in message.lower():
        return {
            'response': 'Por favor ingrese el número de alarma que desea consultar',
            'type': 'alarm_query',
            'next_step': 'await_alarm_number'
        }
    
    if message.lower() == '4' or 'estado operativo' in message.lower():
        return {
            'response': 'Estado operativo actual:\n\n• Plataforma Core A: Operativa\n• Plataforma Core B: En mantenimiento\n• Plataforma Core C: Operativa con alertas',
            'type': 'system_status'
        }
    
    # Manejo de emergencia
    if is_emergency:
        return {
            'response': '🚨 **EMERGENCIA**\nSe ha detectado una situación crítica. Personal ha sido notificado.',
            'type': 'emergency',
            'command': 'emergency'
        }
    
    # Respuesta por defecto
    return {
        'response': 'Por favor selecciona una opción del menú (1-6) o escribe "menu" para ver las opciones.',
        'type': 'instruction'
    }

# Función para manejar estados de conversación
@app.route('/handle_state', methods=['POST'])
def handle_state():
    data = request.json
    user_message = data['message']
    current_state = data.get('current_state', '')
    user_id = data.get('user_id', 'anonymous')
    
    if current_state == 'await_alarm_number':
        # Validar formato de número de alarma
        if not user_message.isdigit():
            return jsonify({
                'response': 'Por favor ingrese un número de alarma válido',
                'type': 'error',
                'next_step': 'await_alarm_number'
            })
        
        return jsonify({
            'response': 'Por favor ingresa el nombre del elemento que reporta la alarma',
            'type': 'alarm_query',
            'next_step': 'await_element_name',
            'alarm_number': user_message
        })
    
    elif current_state == 'await_element_name':
        alarm_number = data.get('alarm_number', 'N/A')
        return jsonify({
            'response': f'Consulta de alarma completada:\n\n• Número de alarma: {alarm_number}\n• Elemento: {user_message}\n\nSe ha generado un ticket de seguimiento.',
            'type': 'alarm_resolved',
            'next_step': ''
        })
    
    return jsonify({
        'response': 'Estado de conversación no reconocido. Volviendo al menú principal.',
        'type': 'error',
        'next_step': ''
    })

def format_alarms(alarms):
    if not alarms:
        return 'No se encontraron alarmas activas.'
    
    formatted = '🚨 **Alarmas Recientes:**\n'
    for alarm in alarms:
        formatted += f"- {alarm.get('nombre', 'Sin nombre')} (Código: {alarm.get('codigo', 'N/A')})\n"
    return formatted

def generate_ai_response(message):
    # Aquí integrarías tu modelo de IA o reglas de negocio
    if 'hola' in message.lower():
        return '¡Hola! ¿En qué puedo ayudarte hoy?'
    if 'gracias' in message.lower():
        return '¡De nada! ¿Hay algo más en lo que pueda ayudarte?'
    
    return 'He procesado tu solicitud. ¿Necesitas algo más específico?'

def save_conversation(user_id, message, response, sentiment):
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    c.execute('INSERT INTO conversations (user_id, message, response, sentiment, timestamp) VALUES (?, ?, ?, ?, ?)',
              (user_id, message, response, sentiment, datetime.now()))
    conn.commit()
    conn.close()

def save_metrics(user_id, alarms_checked, emergencies, response_time):
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    c.execute('INSERT INTO metrics (user_id, alarms_checked, emergencies, response_time, timestamp) VALUES (?, ?, ?, ?, ?)',
              (user_id, alarms_checked, emergencies, response_time, datetime.now()))
    conn.commit()
    conn.close()

# Inicializar la aplicación
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))  # Usa el puerto de Render o 10000 por defecto
    app.run(host="0.0.0.0", port=port)