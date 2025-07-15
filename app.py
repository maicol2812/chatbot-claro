from flask import Flask, request, jsonify, render_template
import pandas as pd
import os
import logging
from datetime import datetime
import sqlite3
import json

# Configuración de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

class AlarmDatabase:
    def __init__(self, excel_file='Ejemplo de alarmas CMM.xlsx'):
        self.excel_file = excel_file
        self.data = None
        self.load_data()
    
    def load_data(self):
        """Cargar datos del archivo Excel"""
        try:
            if os.path.exists(self.excel_file):
                # Leer el archivo Excel
                self.data = pd.read_excel(self.excel_file)
                
                # Normalizar nombres de columnas
                self.data.columns = self.data.columns.str.strip()
                
                # Verificar que las columnas necesarias existen
                required_columns = ['Nombre del elemento', 'Número de la alarma', 'Descripción', 'Severidad', 'Recomendaciones']
                missing_columns = [col for col in required_columns if col not in self.data.columns]
                
                if missing_columns:
                    logger.error(f"Columnas faltantes en el archivo Excel: {missing_columns}")
                    logger.info(f"Columnas disponibles: {list(self.data.columns)}")
                    return False
                
                # Limpiar datos
                self.data['Nombre del elemento'] = self.data['Nombre del elemento'].astype(str).str.strip()
                self.data['Número de la alarma'] = self.data['Número de la alarma'].astype(str).str.strip()
                
                logger.info(f"Datos cargados exitosamente: {len(self.data)} registros")
                return True
            else:
                logger.error(f"Archivo Excel no encontrado: {self.excel_file}")
                return False
                
        except Exception as e:
            logger.error(f"Error cargando datos del Excel: {str(e)}")
            return False
    
    def search_alarm(self, alarm_number, element_name):
        """Buscar alarma por número y nombre del elemento"""
        try:
            if self.data is None:
                return None
            
            # Normalizar inputs para búsqueda
            alarm_number = str(alarm_number).strip()
            element_name = str(element_name).strip().lower()
            
            # Buscar coincidencias
            mask = (
                (self.data['Número de la alarma'].astype(str).str.strip() == alarm_number) &
                (self.data['Nombre del elemento'].astype(str).str.strip().str.lower() == element_name)
            )
            
            results = self.data[mask]
            
            if len(results) > 0:
                # Retornar el primer resultado
                result = results.iloc[0]
                return {
                    'found': True,
                    'alarm_number': result['Número de la alarma'],
                    'element_name': result['Nombre del elemento'],
                    'description': result['Descripción'],
                    'severity': result['Severidad'],
                    'recommendations': result['Recomendaciones']
                }
            else:
                return {
                    'found': False,
                    'message': f'No se encontró una alarma con número {alarm_number} para el elemento "{element_name}"'
                }
                
        except Exception as e:
            logger.error(f"Error buscando alarma: {str(e)}")
            return {
                'found': False,
                'message': f'Error interno al buscar la alarma: {str(e)}'
            }

# Inicializar base de datos de alarmas
alarm_db = AlarmDatabase()

# Estado de usuarios (en memoria para simplicidad)
user_states = {}

def get_user_state(user_id):
    """Obtener estado del usuario"""
    if user_id not in user_states:
        user_states[user_id] = {
            'current_state': '',
            'alarm_number': None,
            'element_name': None,
            'conversation_started': False
        }
    return user_states[user_id]

def update_user_state(user_id, **kwargs):
    """Actualizar estado del usuario"""
    state = get_user_state(user_id)
    state.update(kwargs)
    user_states[user_id] = state

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/health')
def health_check():
    """Verificar estado del servidor"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'database_loaded': alarm_db.data is not None
    })

@app.route('/chat', methods=['POST'])
def chat():
    """Endpoint principal del chat"""
    try:
        data = request.json
        message = data.get('message', '').strip()
        user_id = data.get('user_id', 'anonymous')
        is_emergency = data.get('isEmergency', False)
        
        user_state = get_user_state(user_id)
        
        # Mensaje inicial/menú
        if not user_state['conversation_started'] or message.lower() in ['menu', 'inicio', 'help']:
            update_user_state(user_id, conversation_started=True, current_state='')
            return jsonify({
                'response': '''¡Hola! Soy tu asistente de alarmas CMM. 

¿En qué puedo ayudarte hoy?

1. 🔍 Consultar información de alarma
2. 📋 Ver historial de alarmas
3. 🚨 Reportar emergencia
4. 📊 Estadísticas del sistema
5. 📖 Manual de procedimientos
6. 👥 Contactar soporte técnico

Selecciona una opción (1-6):''',
                'type': 'system'
            })
        
        return jsonify({
            'response': 'Mensaje recibido en endpoint general. Por favor, usa el menú para navegar.',
            'type': 'system'
        })
        
    except Exception as e:
        logger.error(f"Error en /chat: {str(e)}")
        return jsonify({
            'response': 'Error interno del servidor. Intenta nuevamente.',
            'type': 'error'
        }), 500

@app.route('/handle_state', methods=['POST'])
def handle_state():
    """Manejar estados específicos del flujo de alarmas"""
    try:
        data = request.json
        message = data.get('message', '').strip()
        current_state = data.get('current_state', '')
        user_id = data.get('user_id', 'anonymous')
        alarm_number = data.get('alarm_number', None)
        
        logger.info(f"handle_state - User: {user_id}, State: {current_state}, Message: {message}, Alarm: {alarm_number}")
        
        if current_state == 'await_alarm_number':
            # Validar que el mensaje es un número
            if not message.isdigit():
                return jsonify({
                    'response': '❌ El número de alarma debe contener solo dígitos. Intenta nuevamente:',
                    'type': 'error',
                    'next_step': 'await_alarm_number'
                })
            
            # Guardar número de alarma
            update_user_state(user_id, alarm_number=message, current_state='await_element_name')
            
            return jsonify({
                'response': 'Perfecto. Ahora ingresa el nombre del elemento que reporta la alarma:',
                'type': 'system',
                'next_step': 'await_element_name',
                'alarm_number': message
            })
            
        elif current_state == 'await_element_name':
            # Validar que tenemos el número de alarma
            if not alarm_number:
                return jsonify({
                    'response': 'Error: No se encontró el número de alarma. Vuelve a empezar.',
                    'type': 'error'
                })
            
            # Buscar en la base de datos
            result = alarm_db.search_alarm(alarm_number, message)
            
            if result and result['found']:
                # Formatear respuesta exitosa
                response = f"""✅ **Alarma Encontrada**

📋 **Información de la Alarma:**
• **Número:** {result['alarm_number']}
• **Elemento:** {result['element_name']}
• **Severidad:** {result['severity']}

📝 **Descripción:**
{result['description']}

💡 **Recomendaciones:**
{result['recommendations']}

---
¿Necesitas consultar otra alarma? Escribe "1" para buscar otra alarma o "menu" para ver todas las opciones."""
                
                # Limpiar estado del usuario
                update_user_state(user_id, current_state='', alarm_number=None, element_name=None)
                
                return jsonify({
                    'response': response,
                    'type': 'alarm_resolved',
                    'alarm_info': result
                })
            else:
                # No encontrada
                error_msg = result['message'] if result else 'No se encontró la alarma especificada'
                response = f"""❌ **Alarma No Encontrada**

{error_msg}

**Sugerencias:**
• Verifica que el número de alarma sea correcto
• Revisa la ortografía del nombre del elemento
• Asegúrate de que el elemento corresponda a esa alarma

¿Quieres intentar nuevamente?
• Escribe "1" para buscar otra alarma
• Escribe "menu" para ver todas las opciones"""
                
                # Limpiar estado del usuario
                update_user_state(user_id, current_state='', alarm_number=None, element_name=None)
                
                return jsonify({
                    'response': response,
                    'type': 'error'
                })
        
        return jsonify({
            'response': 'Estado no reconocido. Usa "menu" para empezar.',
            'type': 'error'
        })
        
    except Exception as e:
        logger.error(f"Error en handle_state: {str(e)}")
        return jsonify({
            'response': 'Error procesando la solicitud. Intenta nuevamente.',
            'type': 'error'
        }), 500

@app.route('/debug/data')
def debug_data():
    """Endpoint para debug - mostrar datos cargados"""
    if alarm_db.data is not None:
        return jsonify({
            'status': 'loaded',
            'records': len(alarm_db.data),
            'columns': list(alarm_db.data.columns),
            'sample_data': alarm_db.data.head().to_dict('records')
        })
    else:
        return jsonify({
            'status': 'not_loaded',
            'message': 'No hay datos cargados'
        })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)