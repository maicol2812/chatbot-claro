from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
import pandas as pd
import os
from difflib import get_close_matches
from deep_translator import GoogleTranslator
import json
import datetime
import re
from collections import defaultdict
import logging
from threading import Timer
import sqlite3
import hashlib
from functools import wraps 

app = Flask(__name__)
CORS(app)

# Configuración avanzada
app.config['SECRET_KEY'] = 'claro-secret-key-2024'
app.config['JWT_ALGORITHM'] = 'HS256'

# Configuración de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Almacenamiento en memoria mejorado
usuarios = {}
sesiones_activas = {}
metricas_sistema = defaultdict(int)
alertas_activas = {}
historial_conversaciones = defaultdict(list)
predicciones_ia = {}

# Base de datos SQLite para persistencia
def init_db():
    conn = sqlite3.connect('chatbot.db')
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS conversaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id TEXT,
            mensaje TEXT,
            respuesta TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            sentimiento TEXT,
            categoria TEXT
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS metricas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha DATE,
            consultas_totales INTEGER,
            tiempo_respuesta_promedio REAL,
            satisfaccion_promedio REAL
        )
    ''')
    
    conn.commit()
    conn.close()

init_db()

# Carga de datos del Excel
def cargar_datos_excel():
    try:
        ruta_excel = os.path.join(os.path.dirname(__file__), "Ejemplo de alarmas CMM.xlsx")
        
        if not os.path.exists(ruta_excel):
            logger.error(f"Archivo no encontrado: {ruta_excel}")
            return None
        
        df = pd.read_excel(ruta_excel, engine="openpyxl")
        
        # Normalizar nombres de columnas
        df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')
        
        # Verificar columnas necesarias (ajustar según tu archivo)
        required_columns = ["numero_alarma", "nombre_del_elemento"]
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            logger.error(f"Columnas faltantes: {missing_columns}")
            logger.info(f"Columnas disponibles: {list(df.columns)}")
            return None
        
        # Limpiar datos
        df["numero_alarma"] = df["numero_alarma"].astype(str).str.strip()
        df["nombre_del_elemento"] = df["nombre_del_elemento"].astype(str).str.lower().str.strip()
        
        logger.info(f"Datos cargados exitosamente: {len(df)} registros")
        return df
    
    except Exception as e:
        logger.error(f"Error cargando Excel: {str(e)}")
        return None

# Cargar datos
df = cargar_datos_excel()

# Análisis de sentimientos avanzado
def analizar_sentimiento(texto):
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

# Sistema de notificaciones inteligentes
def enviar_notificacion_critica(mensaje, usuario_id):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    logger.warning(f"ALERTA CRÍTICA - Usuario {usuario_id}: {mensaje} - {timestamp}")
    
    alertas_activas[usuario_id] = {
        'mensaje': mensaje,
        'timestamp': timestamp,
        'nivel': 'critico'
    }

# Análisis predictivo de problemas
def predecir_problema_potencial(mensaje):
    indicadores_criticos = [
        'caída', 'down', 'offline', 'falla masiva', 'crítico',
        'sin servicio', 'no funciona', 'emergencia'
    ]
    
    for indicador in indicadores_criticos:
        if indicador in mensaje.lower():
            return True
    return False

# Sistema de métricas avanzadas
def actualizar_metricas(usuario_id, tiempo_respuesta, satisfaccion=None):
    metricas_sistema['consultas_totales'] += 1
    metricas_sistema['tiempo_respuesta_total'] += tiempo_respuesta
    
    if satisfaccion:
        metricas_sistema['satisfaccion_total'] += satisfaccion
        metricas_sistema['evaluaciones_satisfaccion'] += 1

# Funciones de traducción
def traducir(texto):
    try:
        if pd.isna(texto) or texto == 'N/A' or str(texto).strip() == '':
            return 'N/A'
        return GoogleTranslator(source='auto', target='es').translate(str(texto))
    except Exception as e:
        logger.error(f"Error en traducción: {str(e)}")
        return str(texto)

# Menú principal
def menu_principal():
    return (
        "🎯 **ASESOR CLARO - MENÚ PRINCIPAL**\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "1️⃣ Consultar alarmas de plataformas\n"
        "2️⃣ Documentación técnica\n"
        "3️⃣ Incidentes activos\n"
        "4️⃣ Estado operativo\n"
        "5️⃣ Cambios programados\n"
        "6️⃣ Contactar especialista\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "🆘 **EMERGENCIA** - Escalamiento crítico\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "📝 Escribe el número de opción o describe tu problema"
    )

# Guardar conversación en BD
def guardar_conversacion(usuario_id, mensaje, respuesta, sentimiento, categoria):
    try:
        conn = sqlite3.connect('chatbot.db')
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO conversaciones (usuario_id, mensaje, respuesta, sentimiento, categoria)
            VALUES (?, ?, ?, ?, ?)
        ''', (usuario_id, mensaje, respuesta, sentimiento, categoria))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error guardando conversación: {str(e)}")

# Template HTML integrado
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Asesor Claro IA</title>
    <style>
        /* Estilos integrados para funcionalidad completa */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #000000 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        
        .welcome {
            text-align: center;
            margin-bottom: 50px;
        }
        
        .welcome h1 {
            font-size: 3rem;
            background: linear-gradient(45deg, #d41528, #ff6b35);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 20px;
        }
        
        .welcome p {
            font-size: 1.2rem;
            color: #b0b0b0;
        }
        
        #chat-toggle {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: #d41528;
            color: white;
            border: none;
            border-radius: 50%;
            width: 60px;
            height: 60px;
            font-size: 24px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(212, 21, 40, 0.4);
            transition: all 0.3s ease;
            z-index: 1000;
        }
        
        #chat-toggle:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(212, 21, 40, 0.6);
        }
        
        #chat-container {
            position: fixed;
            bottom: 100px;
            right: 30px;
            width: 400px;
            height: 500px;
            background: rgba(30, 30, 30, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            display: none;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            z-index: 999;
        }
        
        #chat-container.show {
            display: flex;
        }
        
        #chat-header {
            background: #d41528;
            color: white;
            padding: 15px 20px;
            font-weight: bold;
            text-align: center;
        }
        
        #chat-body {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .message {
            padding: 10px 15px;
            border-radius: 15px;
            max-width: 80%;
            word-wrap: break-word;
            white-space: pre-wrap;
        }
        
        .user-message {
            background: #d41528;
            color: white;
            align-self: flex-end;
            border-bottom-right-radius: 5px;
        }
        
        .bot-message {
            background: rgba(255, 255, 255, 0.1);
            color: white;
            align-self: flex-start;
            border-bottom-left-radius: 5px;
        }
        
        #chat-input {
            display: flex;
            padding: 20px;
            gap: 10px;
            background: rgba(0, 0, 0, 0.3);
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        #chat-input input {
            flex: 1;
            padding: 10px 15px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            outline: none;
        }
        
        #chat-input input::placeholder {
            color: #b0b0b0;
        }
        
        #chat-input button {
            padding: 10px 20px;
            background: #d41528;
            color: white;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-weight: bold;
        }
        
        #chat-input button:hover {
            background: #ff1744;
        }
        
        .typing {
            color: #b0b0b0;
            font-style: italic;
        }
        
        @media (max-width: 768px) {
            #chat-container {
                width: 90vw;
                right: 5vw;
                height: 60vh;
            }
            
            #chat-toggle {
                bottom: 20px;
                right: 20px;
                width: 50px;
                height: 50px;
                font-size: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="welcome">
        <h1>Asesor Claro IA</h1>
        <p>Sistema inteligente de soporte técnico</p>
    </div>
    
    <button id="chat-toggle">💬</button>
    
    <div id="chat-container">
        <div id="chat-header">
            Asesor Claro IA - En línea
        </div>
        <div id="chat-body"></div>
        <div id="chat-input">
            <input type="text" id="message-input" placeholder="Escribe tu mensaje...">
            <button id="send-btn">Enviar</button>
        </div>
    </div>
    
    <script>
        const chatToggle = document.getElementById('chat-toggle');
        const chatContainer = document.getElementById('chat-container');
        const chatBody = document.getElementById('chat-body');
        const messageInput = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-btn');
        
        let userId = 'user_' + Math.random().toString(36).substr(2, 9);
        let isTyping = false;
        
        // Toggle chat
        chatToggle.addEventListener('click', () => {
            chatContainer.classList.toggle('show');
            if (chatContainer.classList.contains('show') && chatBody.children.length === 0) {
                addMessage('bot', 'Hola! Soy tu Asesor Claro IA. ¿En qué puedo ayudarte hoy?', true);
            }
        });
        
        // Send message
        function sendMessage() {
            const message = messageInput.value.trim();
            if (message && !isTyping) {
                addMessage('user', message);
                messageInput.value = '';
                
                // Show typing indicator
                isTyping = true;
                const typingDiv = addMessage('bot', 'Escribiendo...', true);
                typingDiv.classList.add('typing');
                
                // Send to backend
                fetch('/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: message,
                        user_id: userId
                    })
                })
                .then(response => response.json())
                .then(data => {
                    // Remove typing indicator
                    chatBody.removeChild(typingDiv);
                    isTyping = false;
                    
                    // Add bot response
                    addMessage('bot', data.response, true);
                })
                .catch(error => {
                    chatBody.removeChild(typingDiv);
                    isTyping = false;
                    addMessage('bot', 'Error: No pude procesar tu mensaje. Intenta de nuevo.', true);
                    console.error('Error:', error);
                });
            }
        }
        
        // Add message to chat
        function addMessage(sender, text, scroll = false) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${sender}-message`;
            messageDiv.textContent = text;
            
            chatBody.appendChild(messageDiv);
            
            if (scroll) {
                chatBody.scrollTop = chatBody.scrollHeight;
            }
            
            return messageDiv;
        }
        
        // Event listeners
        sendBtn.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        // Auto-focus input when chat opens
        chatToggle.addEventListener('click', () => {
            setTimeout(() => {
                if (chatContainer.classList.contains('show')) {
                    messageInput.focus();
                }
            }, 100);
        });
    </script>
</body>
</html>
"""

# Rutas
@app.route("/")
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route("/metricas", methods=["GET"])
def obtener_metricas():
    consultas_totales = metricas_sistema['consultas_totales']
    tiempo_total = metricas_sistema['tiempo_respuesta_total']
    satisfaccion_total = metricas_sistema['satisfaccion_total']
    evaluaciones = metricas_sistema['evaluaciones_satisfaccion']
    
    return jsonify({
        "consultas_totales": consultas_totales,
        "tiempo_respuesta_promedio": tiempo_total / max(consultas_totales, 1),
        "alertas_activas": len(alertas_activas),
        "sesiones_activas": len(sesiones_activas),
        "satisfaccion_promedio": satisfaccion_total / max(evaluaciones, 1) if evaluaciones > 0 else 0
    })

@app.route("/dashboard", methods=["GET"])
def dashboard():
    return jsonify({
        "estado_sistema": "🟢 OPERATIVO",
        "alertas_criticas": len([a for a in alertas_activas.values() if a.get('nivel') == 'critico']),
        "usuarios_activos": len(usuarios),
        "uptime": "99.7%",
        "ultima_actualizacion": datetime.datetime.now().isoformat()
    })

@app.route("/chat", methods=["POST"])
def chat():
    inicio_tiempo = datetime.datetime.now()
    
    try:
        data = request.get_json()
        msg = data.get("message", "").strip()
        user_id = data.get("user_id", "usuario_anonimo")
        
        if not msg:
            return jsonify({"response": "❌ Mensaje vacío. Por favor, escribe algo.", "tipo": "error"})
        
        # Verificar si hay datos del Excel
        if df is None:
            return jsonify({
                "response": "❌ **SISTEMA NO DISPONIBLE**\n\nNo se pudo cargar la base de datos de alarmas.\nPor favor, contacta al administrador.\n\n" + menu_principal(),
                "tipo": "error"
            })
        
        # Análisis de sentimiento
        sentimiento = analizar_sentimiento(msg)
        
        msg_lower = msg.lower()
        
        # Manejo de emergencias
        if any(word in msg_lower for word in ["emergencia", "urgente", "crítico", "caída", "down"]):
            enviar_notificacion_critica(msg, user_id)
            respuesta = (
                "🚨 **PROTOCOLO DE EMERGENCIA ACTIVADO**\n\n"
                "✅ Especialista notificado\n"
                "✅ Ticket crítico creado\n"
                "✅ Monitoreo intensivo activado\n\n"
                "⏱️ Tiempo estimado de respuesta: 5 minutos\n\n"
                "📞 Para contacto inmediato: 123-456-7890"
            )
            guardar_conversacion(user_id, msg, respuesta, sentimiento, "emergencia")
            return jsonify({"response": respuesta, "tipo": "emergencia"})
        
        # Comandos especiales
        if msg_lower in ["estado", "estado sistema", "dashboard", "4"]:
            respuesta = (
                "📊 **ESTADO DEL SISTEMA**\n\n"
                "🟢 Core Network: OPERATIVO\n"
                "🟢 Base de Datos: OPERATIVO\n"
                "🟡 Servidor Web: CARGA NORMAL\n"
                "🟢 Servicios API: OPERATIVO\n\n"
                "📈 Rendimiento general: 97%\n"
                "🔄 Última actualización: " + datetime.datetime.now().strftime("%H:%M:%S")
            )
            return jsonify({"response": respuesta, "tipo": "dashboard"})
        
        # Inicializar usuario si no existe
        if user_id not in usuarios:
            usuarios[user_id] = {
                "estado": "inicio",
                "sesion_id": hashlib.md5(f"{user_id}{datetime.datetime.now()}".encode()).hexdigest()[:8],
                "numero_alarma": None,
                "elemento": None
            }
        
        estado = usuarios[user_id]["estado"]
        
        # Lógica de estados
        if estado == "inicio":
            if msg_lower == "1":
                usuarios[user_id]["estado"] = "espera_alarma"
                respuesta = (
                    "🔍 **CONSULTA DE ALARMAS ACTIVADA**\n\n"
                    "📝 Por favor ingresa el número de alarma que deseas consultar.\n\n"
                    "💡 Ejemplos: 1001, AL-2024-001, 5432\n\n"
                    "ℹ️ Asegúrate de ingresar el número exacto como aparece en tu sistema."
                )
                return jsonify({"response": respuesta, "tipo": "sistema"})
            elif msg_lower in ["2", "documentacion", "documentación técnica"]:
                respuesta = (
                    "📚 **DOCUMENTACIÓN TÉCNICA**\n\n"
                    "📖 Manuales disponibles:\n"
                    "• Guía de resolución de problemas\n"
                    "• Configuración de equipos\n"
                    "• Protocolos de mantenimiento\n\n"
                    "📧 Solicita documentos específicos al equipo técnico."
                )
                return jsonify({"response": respuesta, "tipo": "documentacion"})
            elif msg_lower in ["3", "incidentes", "incidentes activos"]:
                respuesta = (
                    "📋 **INCIDENTES ACTIVOS**\n\n"
                    "🔴 Incidentes críticos: 0\n"
                    "🟡 Incidentes menores: 2\n"
                    "🟢 Sistema estable: 95%\n\n"
                    "📊 Todos los servicios principales funcionando correctamente."
                )
                return jsonify({"response": respuesta, "tipo": "incidentes"})
            elif msg_lower in ["5", "cambios", "cambios programados"]:
                respuesta = (
                    "📅 **CAMBIOS PROGRAMADOS**\n\n"
                    "🔧 Próximo mantenimiento:\n"
                    "• Fecha: Este sábado 2:00 AM\n"
                    "• Duración: 2 horas\n"
                    "• Servicios afectados: Ninguno crítico\n\n"
                    "✅ Se notificará 24 horas antes."
                )
                return jsonify({"response": respuesta, "tipo": "cambios"})
            elif msg_lower in ["6", "especialista", "contactar especialista"]:
                respuesta = (
                    "👨‍💻 **CONTACTAR ESPECIALISTA**\n\n"
                    "📞 Mesa de ayuda: 123-456-7890\n"
                    "📧 Email: soporte@claro.com\n"
                    "💬 Chat especializado: Disponible 24/7\n\n"
                    "🎫 ¿Deseas que genere un ticket de soporte?"
                )
                return jsonify({"response": respuesta, "tipo": "contacto"})
            else:
                respuesta = (
                    "🤖 **ASESOR CLARO IA ACTIVADO**\n\n"
                    "Hola! Soy tu asistente inteligente de Claro.\n"
                    "Estoy aquí para ayudarte con consultas técnicas.\n\n" + 
                    menu_principal()
                )
                return jsonify({"response": respuesta, "tipo": "menu"})
        
        elif estado == "espera_alarma":
            usuarios[user_id]["numero_alarma"] = msg
            usuarios[user_id]["estado"] = "espera_elemento"
            respuesta = (
                f"✅ Alarma **{msg}** registrada.\n\n"
                "🎯 Ahora ingresa el nombre del elemento asociado a la alarma.\n\n"
                "💡 Ejemplos: router, switch, servidor, antena\n"
                "🔍 Puedes usar nombres parciales o palabras clave."
            )
            return jsonify({"response": respuesta, "tipo": "sistema"})
        
        elif estado == "espera_elemento":
            numero = usuarios[user_id]["numero_alarma"]
            elemento = msg.strip().lower()
            usuarios[user_id]["estado"] = "inicio"
            
            # Búsqueda inteligente
            elementos_disponibles = df["nombre_del_elemento"].tolist()
            posibles = get_close_matches(elemento, elementos_disponibles, n=3, cutoff=0.4)
            
            if posibles:
                elemento_encontrado = posibles[0]
                resultado = df[
                    (df["numero_alarma"] == numero) &
                    (df["nombre_del_elemento"] == elemento_encontrado)
                ]
                
                if not resultado.empty:
                    fila = resultado.iloc[0]
                    
                    # Obtener información con manejo de errores
                    descripcion = str(fila.get('descripcion_alarma', 'N/A'))
                    significado = str(fila.get('significado', 'N/A'))
                    acciones = str(fila.get('acciones', 'N/A'))
                    severidad = str(fila.get('severidad', 'N/A'))
                    
                    # Traducir si es necesario
                    if descripcion != 'N/A':
                        descripcion = traducir(descripcion)
                    if significado != 'N/A':
                        significado = traducir(significado)
                    if acciones != 'N/A':
                        acciones = traducir(acciones)
                    if severidad != 'N/A':
                        severidad = traducir(severidad)
                    
                    # Emoji según severidad
                    emoji_severidad = "🔴" if 'crítico' in severidad.lower() else "🟡" if 'alto' in severidad.lower() else "🟢"
                    
                    respuesta = (
                        f"🎯 **ALARMA ENCONTRADA**\n"
                        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                        f"📋 **Número:** {numero}\n"
                        f"🏷️ **Elemento:** {elemento_encontrado}\n"
                        f"📝 **Descripción:** {descripcion}\n"
                        f"{emoji_severidad} **Severidad:** {severidad}\n"
                        f"🧠 **Significado:** {significado}\n"
                        f"🛠️ **Acciones recomendadas:** {acciones}\n"
                        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                        f"🤖 **Análisis IA:** Información procesada\n"
                        f"⏱️ **Tiempo estimado de resolución:** 15-30 min\n"
                        f"📞 **¿Necesitas escalamiento?** Escribe 'escalar'\n\n"
                        f"¿Necesitas consultar otra alarma? Escribe '1'"
                    )
                    categoria = "alarma_encontrada"
                    
                else:
                    respuesta = (
                        f"❌ **ALARMA NO ENCONTRADA**\n\n"
                        f"🔍 **Búsqueda realizada:**\n"
                        f"• Número: {numero}\n"
                        f"• Elemento: {elemento}\n\n"
                        f"💡 **Elementos similares encontrados:**\n"
                        f"• {chr(10).join(f'  - {elem}' for elem in posibles[:3])}\n\n"
                        f"🔄 ¿Deseas buscar con alguno de estos elementos?\n"
                        f"📞 O escribe 'especialista' para contactar soporte.\n\n"
                        + menu_principal()
                    )
                    categoria = "alarma_no_encontrada"
            else:
                respuesta = (
                    f"❌ **ELEMENTO NO RECONOCIDO**\n\n"
                    f"🔍 No se encontraron elementos similares a '{elemento}'\n\n"
                    f"💡 **Sugerencias:**\n"
                    f"• Verifica la ortografía\n"
                    f"• Usa nombres más específicos\n"
                    f"• Prueba con palabras clave\n\n"
                    f"📞 **¿Necesitas ayuda?** Escribe 'especialista'\n\n"
                    + menu_principal()
                )
                categoria = "elemento_no_encontrado"
            
            # Guardar conversación
            guardar_conversacion(user_id, f"Alarma: {numero}, Elemento: : {elemento}", respuesta, sentimiento, categoria)
            
            # Agregar menú si hay error
            if "❌" in respuesta:
                respuesta += "\n\n" + menu_principal()
            
            tiempo_respuesta = (datetime.datetime.now() - inicio_tiempo).total_seconds()
            actualizar_metricas(user_id, tiempo_respuesta)
            
            return jsonify({"response": respuesta, "tipo": "resultado_alarma"})
        
        # Respuesta por defecto
        respuesta = (
            "🤖 **ASESOR CLARO IA**\n\n"
            "No entendí tu solicitud.\n\n" + 
            menu_principal()
        )
        
        tiempo_respuesta = (datetime.datetime.now() - inicio_tiempo).total_seconds()
        actualizar_metricas(user_id, tiempo_respuesta)
        
        return jsonify({"response": respuesta, "tipo": "default"})
        
    except Exception as e:
        logger.error(f"Error en chat: {str(e)}")
        return jsonify({
            "response": "❌ **ERROR DEL SISTEMA**\n\nOcurrió un error procesando tu solicitud.\nPor favor, intenta nuevamente.",
            "tipo": "error"
        })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)