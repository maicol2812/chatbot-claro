from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import pandas as pd
import os
import datetime
import re
import hashlib
import sqlite3
from difflib import get_close_matches
from deep_translator import GoogleTranslator
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

# Configuración
app.config['SECRET_KEY'] = 'tu_clave_secreta_aqui'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['EXCEL_FILE'] = 'Ejemplo de alarmas CMM.xlsx'

# Variables globales
metricas_globales = {
    'total_mensajes': 0,
    'sesiones_activas': 0,
    'tiempo_promedio_respuesta': 0,
    'ultimo_reinicio': datetime.datetime.now(),
    'alertas_criticas': 0
}

usuarios = {}
alertas_activas = {}
sesiones_activas = set()
predicciones_ia = {}

# Datos del menú
MENU_OPCIONES = {
    '1': 'Alarmas de plataformas',
    '2': 'Documentación de las plataformas',
    '3': 'Incidentes activos de las plataformas',
    '4': 'Estado operativo de las plataformas',
    '5': 'Cambios activos en las plataformas',
    '6': 'Hablar con el administrador',
    '7': 'Análisis predictivo de problemas',
    '8': 'Recomendaciones inteligentes',
    '9': 'Generar reporte automático',
    '0': 'Emergencia crítica'
}

# Mensajes personalizados
MENSAJES_PERSONALIZADOS = {
    "arreglar alerta": "🔧 Para arreglar una alerta, asegúrate de validar los logs y reiniciar el proceso afectado.",
    "configurar alerta": "⚙️ Las alertas se configuran desde el módulo de monitoreo. Indícame el tipo de alerta a configurar.",
    "solucion alerta": "💡 Una solución típica a las alertas es verificar conectividad, servicios activos y uso de CPU/RAM.",
    "estado sistema": "📊 Consultando estado del sistema en tiempo real...",
    "ayuda avanzada": "🤖 Funciones avanzadas: análisis predictivo, escalamiento automático, reportes inteligentes.",
    "dashboard": "📈 Mostrando métricas en tiempo real del sistema Core.",
    "escalamiento": "📞 Iniciando proceso de escalamiento automático a nivel 2."
}

def cargar_excel_alarmas():
    """Carga el archivo Excel de alarmas"""
    try:
        if os.path.exists(app.config['EXCEL_FILE']):
            df = pd.read_excel(app.config['EXCEL_FILE'], engine='openpyxl')
            # Normalizar nombres de columnas
            df.columns = df.columns.str.strip().str.lower()
            return df
        else:
            print(f"⚠️ Archivo {app.config['EXCEL_FILE']} no encontrado")
            return None
    except Exception as e:
        print(f"❌ Error al cargar Excel: {e}")
        return None

def formatear_respuesta_alarma(df, filtro=None):
    """Formatea la respuesta de alarmas para el chat"""
    if df is None or df.empty:
        return "❌ No se encontraron datos de alarmas.", "error"
    
    try:
        # Si hay filtro, aplicarlo
        if filtro:
            df_filtrado = df[df.apply(lambda x: x.astype(str).str.contains(filtro, case=False, na=False).any(), axis=1)]
            if df_filtrado.empty:
                return f"🔍 No se encontraron alarmas que coincidan con '{filtro}'.", "warning"
            df = df_filtrado
        
        # Limitar resultados para evitar mensajes muy largos
        max_resultados = 5
        if len(df) > max_resultados:
            df = df.head(max_resultados)
            mensaje_limite = f"\n\n📋 *Mostrando {max_resultados} de {len(df)} alarmas encontradas*"
        else:
            mensaje_limite = ""
        
        respuesta = "🚨 **ALARMAS DE PLATAFORMAS**\n\n"
        
        for index, row in df.iterrows():
            respuesta += f"**━━━ ALARMA {index + 1} ━━━**\n"
            for col in df.columns:
                if pd.notna(row[col]) and str(row[col]).strip():
                    respuesta += f"**{col.capitalize()}:** {row[col]}\n"
            respuesta += "\n"
        
        respuesta += mensaje_limite
        return respuesta, "info"
        
    except Exception as e:
        return f"❌ Error al procesar alarmas: {str(e)}", "error"

def analizar_sentimiento(texto):
    """Analiza el sentimiento del mensaje del usuario"""
    palabras_positivas = ['gracias', 'perfecto', 'excelente', 'bien', 'correcto', 'genial']
    palabras_negativas = ['problema', 'error', 'mal', 'fallo', 'urgente', 'crítico']
    
    texto_lower = texto.lower()
    puntuacion = 0
    
    for palabra in palabras_positivas:
        if palabra in texto_lower:
            puntuacion += 1
    
    for palabra in palabras_negativas:
        if palabra in texto_lower:
            puntuacion -= 1
    
    if puntuacion > 0:
        return "positivo"
    elif puntuacion < 0:
        return "negativo"
    else:
        return "neutral"

def predecir_problema_potencial(mensaje):
    """Predice si el mensaje indica un problema potencial"""
    indicadores_criticos = [
        'caída', 'down', 'offline', 'falla masiva', 'crítico',
        'sin servicio', 'no funciona', 'emergencia'
    ]
    
    for indicador in indicadores_criticos:
        if indicador in mensaje.lower():
            return True
    return False

def generar_menu():
    """Genera el menú principal con emojis y formato mejorado"""
    menu = "🎯 **MENÚ PRINCIPAL - ASESOR CLARO IA**\n\n"
    for numero, descripcion in MENU_OPCIONES.items():
        emoji = "🔴" if numero == "0" else "⚡" if int(numero) < 7 else "🤖"
        menu += f"{emoji} **{numero}:** {descripcion}\n"
    
    menu += "\n💡 *Escribe el número de la opción o tu consulta directamente*"
    return menu

def guardar_conversacion(usuario_id, mensaje, respuesta, sentimiento, categoria):
    """Guarda la conversación en la base de datos"""
    conn = sqlite3.connect('chatbot.db')
    cursor = conn.cursor()
    
    # Crear tabla si no existe
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS conversaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id TEXT,
            mensaje TEXT,
            respuesta TEXT,
            sentimiento TEXT,
            categoria TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        INSERT INTO conversaciones (usuario_id, mensaje, respuesta, sentimiento, categoria)
        VALUES (?, ?, ?, ?, ?)
    ''', (usuario_id, mensaje, respuesta, sentimiento, categoria))
    
    conn.commit()
    conn.close()

def enviar_notificacion_critica(mensaje, usuario_id):
    """Envía una notificación crítica"""
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"🚨 ALERTA CRÍTICA - Usuario {usuario_id}: {mensaje} - {timestamp}")
    
    alertas_activas[usuario_id] = {
        'mensaje': mensaje,
        'timestamp': timestamp,
        'nivel': 'critico'
    }
    metricas_globales['alertas_criticas'] += 1

@app.route('/')
def index():
    """Página principal del chat"""
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    """Endpoint principal para el chat"""
    try:
        inicio_tiempo = datetime.datetime.now()
        data = request.get_json()
        mensaje = data.get('message', '').strip()
        user_id = data.get('user_id', 'anonimo')
        
        # Actualizar métricas
        metricas_globales['total_mensajes'] += 1
        sesiones_activas.add(user_id)
        metricas_globales['sesiones_activas'] = len(sesiones_activas)
        
        # Análisis de sentimiento
        sentimiento = analizar_sentimiento(mensaje)
        
        # Verificar si es una emergencia
        if predecir_problema_potencial(mensaje) or mensaje.lower() in ['emergencia', '0']:
            enviar_notificacion_critica(mensaje, user_id)
            respuesta = """🚨 **PROTOCOLO DE EMERGENCIA ACTIVADO**\n
✅ Especialista notificado
✅ Ticket crítico creado
✅ Monitoreo intensivo activado

⏱️ Tiempo estimado de respuesta: 5 minutos"""
            guardar_conversacion(user_id, mensaje, respuesta, sentimiento, "emergencia")
            return jsonify({
                'response': respuesta,
                'tipo': 'emergencia',
                'timestamp': datetime.datetime.now().isoformat()
            })
        
        # Manejar opciones del menú
        if mensaje in MENU_OPCIONES:
            opcion = mensaje
        elif mensaje.startswith(tuple(MENU_OPCIONES.keys())):
            opcion = mensaje[0]
        else:
            opcion = None
        
        if opcion:
            if opcion == '1':
                df = cargar_excel_alarmas()
                if df is not None:
                    respuesta, tipo = formatear_respuesta_alarma(df)
                else:
                    respuesta = "❌ No se pudo acceder al archivo de alarmas."
                    tipo = "error"
            elif opcion == '2':
                respuesta = """📚 **DOCUMENTACIÓN TÉCNICA**
                
1. Manual de usuario - Plataforma Principal
2. Guía de resolución de problemas
3. Procedimientos de escalamiento
4. Políticas de seguridad
5. Manual de configuración

*Para acceder a un documento específico, escribe "2 [número]"*"""
                tipo = "info"
            elif opcion == '3':
                respuesta = """🔴 **INCIDENTES ACTIVOS**
                
• INC-001: Lentitud en plataforma web - En progreso
• INC-002: Error de conexión BD - Resuelto
• INC-003: Problema autenticación - Pendiente

Tiempo promedio de resolución: 2.5 horas"""
                tipo = "emergencia"
            elif opcion == '4':
                respuesta = """✅ **ESTADO OPERATIVO**
                
• Plataforma Web: 🟢 Operativa
• Base de Datos: 🟢 Operativa
• API Services: 🟡 Degradada
• Sistema Backup: 🟢 Operativo
• Monitoreo: 🟢 Activo

Última verificación: Hace 2 minutos"""
                tipo = "info"
            elif opcion == '5':
                respuesta = """🔄 **CAMBIOS ACTIVOS**
                
• CHG-001: Actualización de seguridad - Esta noche
• CHG-002: Migración de servidor - Fin de semana
• CHG-003: Actualización certificados - Pendiente

Impacto esperado: Mínimo"""
                tipo = "info"
            elif opcion == '6':
                respuesta = """👨‍💼 **CONTACTO ADMINISTRADOR**
                
Teléfono: +57 (1) 123-4567
Email: admin@claro.com.co
Ticket: Sistema interno
Escalamiento: 24/7

Horario atención: L-V 8AM-6PM"""
                tipo = "info"
            elif opcion == '7':
                respuesta = """🔮 **ANÁLISIS PREDICTIVO**
                
📊 Posibles problemas detectados:
• Sobrecarga CPU en 2 horas
• Memoria crítica en servidor DB
• Latencia elevada en red

🎯 Recomendación: Mantenimiento preventivo"""
                tipo = "ia"
            elif opcion == '8':
                respuesta = """💡 **RECOMENDACIONES**
                
🔧 Optimizaciones sugeridas:
• Reiniciar servicios con alta memoria
• Actualizar configuración de red
• Programar limpieza de logs

📈 Impacto estimado: +15% rendimiento"""
                tipo = "ia"
            else:
                respuesta = generar_menu()
                tipo = "menu"
        else:
            # Respuesta por defecto o búsqueda inteligente
            if any(palabra in mensaje.lower() for palabra in ['hola', 'hello', 'hi']):
                respuesta = """👋 **¡Hola! Soy tu Asesor Claro IA**

Escribe "menu" para ver las opciones disponibles
o realiza tu consulta directamente."""
                tipo = "info"
            elif any(palabra in mensaje.lower() for palabra in ['menu', 'opciones', 'ayuda']):
                respuesta = generar_menu()
                tipo = "menu"
            elif any(palabra in mensaje.lower() for palabra in ['alarma', 'buscar', 'consultar']):
                df = cargar_excel_alarmas()
                if df is not None:
                    terminos = mensaje.lower().replace('alarma', '').replace('buscar', '').strip()
                    respuesta, tipo = formatear_respuesta_alarma(df, terminos)
                else:
                    respuesta = "❌ No se pudo acceder a los datos de alarmas."
                    tipo = "error"
            else:
                respuesta = """🤖 **ASISTENTE INTELIGENTE**

No entendí tu solicitud. Puedes:
1. Escribir "menu" para ver opciones
2. Realizar una consulta específica
3. Contactar al administrador (opción 6)"""
                tipo = "info"
        
        # Calcular tiempo de respuesta
        tiempo_respuesta = (datetime.datetime.now() - inicio_tiempo).total_seconds()
        metricas_globales['tiempo_promedio_respuesta'] = (
            metricas_globales['tiempo_promedio_respuesta'] * (metricas_globales['total_mensajes'] - 1) + tiempo_respuesta
        ) / metricas_globales['total_mensajes']
        
        # Guardar conversación
        guardar_conversacion(user_id, mensaje, respuesta, sentimiento, tipo)
        
        return jsonify({
            'response': respuesta,
            'tipo': tipo,
            'timestamp': datetime.datetime.now().isoformat(),
            'user_id': user_id
        })
        
    except Exception as e:
        print(f"❌ Error en /chat: {e}")
        return jsonify({
            'response': f'❌ Error interno del servidor: {str(e)}',
            'tipo': 'error',
            'timestamp': datetime.datetime.now().isoformat()
        }), 500

@app.route('/metrics', methods=['GET'])
def get_metrics():
    """Endpoint para obtener métricas del sistema"""
    uptime = datetime.datetime.now() - metricas_globales['ultimo_reinicio']
    
    return jsonify({
        'total_mensajes': metricas_globales['total_mensajes'],
        'sesiones_activas': metricas_globales['sesiones_activas'],
        'tiempo_promedio_respuesta': metricas_globales['tiempo_promedio_respuesta'],
        'alertas_criticas': metricas_globales['alertas_criticas'],
        'uptime': str(uptime).split('.')[0],
        'status': 'operativo'
    })

@app.route('/health', methods=['GET'])
def health_check():
    """Endpoint de verificación de salud"""
    excel_disponible = os.path.exists(app.config['EXCEL_FILE'])
    return jsonify({
        'status': 'ok' if excel_disponible else 'warning',
        'excel_available': excel_disponible,
        'timestamp': datetime.datetime.now().isoformat()
    })

if __name__ == '__main__':
    # Verificar y crear estructura de directorios
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    # Inicializar base de datos
    with sqlite3.connect('chatbot.db') as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS conversaciones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                usuario_id TEXT,
                mensaje TEXT,
                respuesta TEXT,
                sentimiento TEXT,
                categoria TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    
    print("🚀 Iniciando Asesor Claro IA...")
    print(f"📊 Archivo Excel: {'✅ Disponible' if os.path.exists(app.config['EXCEL_FILE']) else '❌ No encontrado'}")
    print("🌐 Servidor listo en http://localhost:5000")
    
    app.run(debug=True, host='0.0.0.0', port=5000)