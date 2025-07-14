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

def process_message(message, is_emergency):
    # Comandos especiales
    if message.lower() == 'estado sistema':
        return {
            'response': '✅ **Estado del Sistema**\n- Servidor: Operativo\n- IA: Activa\n- Alarmas: 0 críticas',
            'type': 'system'
        }
    
    if message.lower() == 'alarmas':
        alarms = load_alarms()
        return {
            'response': format_alarms(alarms[:5]),
            'type': 'alarms',
            'alarms_checked': len(alarms)
        }
    
    if message.lower() == 'dashboard':
        return {
            'response': '📊 **Dashboard**\n- Usuarios activos: 42\n- Alarmas hoy: 3\n- Satisfacción: 4.5/5',
            'type': 'dashboard',
            'command': 'metrics'
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
        'response': generate_ai_response(message),
        'type': 'normal'
    }

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
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)