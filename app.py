import os
from flask import Flask, request, jsonify, render_template
import pandas as pd
import sqlite3
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

# Cargar alarmas con validación
def load_alarms():
    try:
        df = pd.read_excel(ALARMS_FILE)
        required_columns = ['Código', 'Nombre', 'Descripción']
        if not all(col in df.columns for col in required_columns):
            raise ValueError("El archivo Excel no tiene las columnas requeridas")
        return df.to_dict('records')
    except Exception as e:
        app.logger.error(f"Error loading alarms: {str(e)}")
        return []

# Análisis de sentimiento
def analyze_sentiment(text):
    try:
        analysis = TextBlob(text)
        return analysis.sentiment.polarity
    except:
        return 0.0

# Manejo de emergencias
def check_emergency(message):
    return any(keyword in message.lower() for keyword in EMERGENCY_KEYWORDS)

# Endpoints
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/health')
def health_check():
    try:
        conn = sqlite3.connect(DATABASE)
        conn.close()
        if not os.path.exists(ALARMS_FILE):
            raise FileNotFoundError("Archivo de alarmas no encontrado")
        return jsonify({"status": "healthy"}), 200
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

@app.route('/chat', methods=['POST'])
def chat():
    start_time = time.time()
    try:
        data = request.get_json()
        if not data or 'message' not in data or len(data['message']) > 500:
            return jsonify({"error": "Mensaje inválido"}), 400

        user_message = data['message']
        user_id = data.get('user_id', 'anonymous')
        is_emergency = data.get('isEmergency', False) or check_emergency(user_message)

        response = process_message(user_message, is_emergency)
        sentiment = analyze_sentiment(user_message)

        # Guardar en base de datos
        save_conversation(user_id, user_message, response['response'], sentiment)
        
        # Métricas
        response_time = time.time() - start_time
        save_metrics(user_id, response.get('alarms_checked', 0),
                    1 if is_emergency else 0, response_time)

        return jsonify(response)

    except Exception as e:
        app.logger.error(f"Error in /chat: {str(e)}")
        return jsonify({
            "response": "Error procesando tu mensaje. Intenta nuevamente.",
            "type": "error"
        }), 500

@app.route('/handle_state', methods=['POST'])
def handle_state():
    try:
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({"error": "Datos inválidos"}), 400

        user_message = data['message']
        current_state = data.get('current_state', '')
        user_id = data.get('user_id', 'anonymous')

        if current_state == 'await_alarm_number':
            if not user_message.isdigit():
                return jsonify({
                    'response': '❌ El número de alarma debe ser numérico',
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
            element_name = user_message.strip().lower()

            alarms = load_alarms()
            match = next((a for a in alarms if 
                         str(a.get('Código')).strip() == alarm_number and 
                         str(a.get('Nombre', '')).strip().lower() == element_name), None)

            if match:
                response_text = f"""🔎 Resultado de la consulta:

• Número de alarma: {alarm_number}
• Elemento: {user_message}
• Descripción: {match.get('Descripción', 'N/A')}
• Severidad: {match.get('Severidad', 'N/A')}
• Recomendaciones: {match.get('Recomendaciones', 'N/A')}"""
            else:
                response_text = f"No se encontró información para la alarma {alarm_number} con el elemento '{user_message}'."

            return jsonify({
                'response': response_text,
                'type': 'alarm_resolved',
                'next_step': ''
            })

        return jsonify({
            'response': 'Estado de conversación no reconocido. Volviendo al menú principal.',
            'type': 'error',
            'next_step': ''
        })

    except Exception as e:
        app.logger.error(f"Error in /handle_state: {str(e)}")
        return jsonify({
            "response": "Error procesando tu solicitud. Intenta nuevamente.",
            "type": "error",
            "next_step": ""
        }), 500

# Funciones auxiliares
def process_message(message, is_emergency):
    message_lower = message.lower()
    
    if message_lower == 'menu':
        return {
            'response': 'Buen día, hablemos de nuestras plataformas de Core. ¿Qué te gustaría consultar el día de hoy?\n\n1. Alarmas de plataformas\n2. Documentación de las plataformas\n3. Incidentes activos de las plataformas\n4. Estado operativo de las plataformas\n5. Cambios activos en las plataformas\n6. Hablar con el administrador de la plataforma',
            'type': 'menu'
        }

    if message_lower == '1' or 'alarma' in message_lower:
        return {
            'response': 'Por favor ingrese el número de alarma que desea consultar',
            'type': 'alarm_query',
            'next_step': 'await_alarm_number',
            'alarms_checked': 1
        }

    if message_lower == '4' or 'estado operativo' in message_lower:
        return {
            'response': 'Estado operativo actual:\n\n• Plataforma Core A: Operativa\n• Plataforma Core B: En mantenimiento\n• Plataforma Core C: Operativa con alertas',
            'type': 'system_status'
        }

    if is_emergency:
        return {
            'response': '🚨 **EMERGENCIA**\nSe ha detectado una situación crítica. Personal ha sido notificado.',
            'type': 'emergency',
            'command': 'emergency'
        }

    return {
        'response': 'Por favor selecciona una opción del menú (1-6) o escribe "menu" para ver las opciones.',
        'type': 'instruction'
    }

def save_conversation(user_id, message, response, sentiment):
    try:
        conn = sqlite3.connect(DATABASE)
        c = conn.cursor()
        c.execute('INSERT INTO conversations VALUES (NULL, ?, ?, ?, ?, ?)',
                 (user_id, message, response, sentiment, datetime.now()))
        conn.commit()
    except Exception as e:
        app.logger.error(f"Error saving conversation: {str(e)}")
    finally:
        conn.close()

def save_metrics(user_id, alarms_checked, emergencies, response_time):
    try:
        conn = sqlite3.connect(DATABASE)
        c = conn.cursor()
        c.execute('INSERT INTO metrics VALUES (NULL, ?, ?, ?, ?, ?)',
                 (user_id, alarms_checked, emergencies, response_time, datetime.now()))
        conn.commit()
    except Exception as e:
        app.logger.error(f"Error saving metrics: {str(e)}")
    finally:
        conn.close()

if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)