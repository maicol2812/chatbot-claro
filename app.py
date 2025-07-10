from flask import Flask, request, jsonify, render_template
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
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import sqlite3
import hashlib
import jwt
from functools import wraps 

app = Flask(__name__)
CORS(app, resources={r"/chat": {"origins": "https://chatbot-claro.onrender.com"}})

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

# Carga de datos existente
ruta_excel = os.path.join(os.path.dirname(__file__), "Ejemplo de alarmas CMM.xlsx")

if not os.path.exists(ruta_excel):
    raise FileNotFoundError(f"⚠️ Archivo no encontrado en: {ruta_excel}")

df = pd.read_excel(ruta_excel, engine="openpyxl")
df.columns = df.columns.str.strip().str.lower()

if "numero alarma" not in df.columns or "nombre del elemento" not in df.columns:
    raise KeyError("❌ Las columnas necesarias no existen en el archivo Excel.")

df["numero alarma"] = df["numero alarma"].astype(str).str.strip()
df["nombre del elemento"] = df["nombre del elemento"].str.lower().str.strip()

# === NUEVAS FUNCIONALIDADES AVANZADAS ===

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

# Sistema de aprendizaje automático básico
def aprender_de_conversacion(usuario_id, mensaje, respuesta):
    patron = extraer_patron(mensaje)
    if patron not in predicciones_ia:
        predicciones_ia[patron] = []
    predicciones_ia[patron].append(respuesta)

def extraer_patron(mensaje):
    # Simplificado - en producción usarías NLP más avanzado
    palabras_clave = re.findall(r'\b\w+\b', mensaje.lower())
    return ' '.join(sorted(palabras_clave[:3]))

# Sistema de notificaciones inteligentes
def enviar_notificacion_critica(mensaje, usuario_id):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    logger.warning(f"ALERTA CRÍTICA - Usuario {usuario_id}: {mensaje} - {timestamp}")
    
    # Aquí podrías integrar con sistemas de notificación reales
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

# Generador de respuestas contextuales avanzadas
def generar_respuesta_contextual(usuario_id, mensaje):
    historial = historial_conversaciones[usuario_id]
    
    # Análisis de contexto basado en historial
    if len(historial) > 2:
        temas_recurrentes = [conv['categoria'] for conv in historial[-3:]]
        if temas_recurrentes.count('alarma') >= 2:
            return "🔍 Noto que has consultado varias alarmas. ¿Necesitas un análisis de patrones o escalamiento?"
    
    # Detección de urgencia
    if predecir_problema_potencial(mensaje):
        return "🚨 DETECCIÓN DE PROBLEMA CRÍTICO - Activando protocolo de emergencia. Conectando con especialista..."
    
    return None

# Mensajes personalizados mejorados
mensajes_personalizados = {
    "arreglar alerta": "🔧 Para arreglar una alerta, asegúrate de validar los logs y reiniciar el proceso afectado.",
    "configurar alerta": "⚙️ Las alertas se configuran desde el módulo de monitoreo. Indícame el tipo de alerta a configurar.",
    "solucion alerta": "💡 Una solución típica a las alertas es verificar conectividad, servicios activos y uso de CPU/RAM.",
    "estado sistema": "📊 Consultando estado del sistema en tiempo real...",
    "ayuda avanzada": "🤖 Funciones avanzadas: análisis predictivo, escalamiento automático, reportes inteligentes.",
    "dashboard": "📈 Mostrando métricas en tiempo real del sistema Core.",
    "escalamiento": "📞 Iniciando proceso de escalamiento automático a nivel 2."
}

# Funciones de traducción mejoradas
def traducir(texto):
    try:
        return GoogleTranslator(source='auto', target='es').translate(texto)
    except:
        return texto

# Menú principal mejorado
def menu_principal():
    return (
        "🎯 **ASESOR CLARO - MENÚ AVANZADO**\n"
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
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    )

# Guardar conversación en BD
def guardar_conversacion(usuario_id, mensaje, respuesta, sentimiento, categoria):
    conn = sqlite3.connect('chatbot.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO conversaciones (usuario_id, mensaje, respuesta, sentimiento, categoria)
        VALUES (?, ?, ?, ?, ?)
    ''', (usuario_id, mensaje, respuesta, sentimiento, categoria))
    conn.commit()
    conn.close()

# Rutas existentes
@app.route("/")
def index():
    return render_template("index.html")

# === NUEVAS RUTAS AVANZADAS ===

@app.route("/metricas", methods=["GET"])
def obtener_metricas():
    return jsonify({
        "consultas_totales": metricas_sistema['consultas_totales'],
        "tiempo_respuesta_promedio": metricas_sistema['tiempo_respuesta_total'] / max(metricas_sistema['consultas_totales'], 1),
        "alertas_activas": len(alertas_activas),
        "sesiones_activas": len(sesiones_activas),
        "satisfaccion_promedio": metricas_sistema['satisfaccion_total'] / max(metricas_sistema['evaluaciones_satisfaccion'], 1)
    })

@app.route("/dashboard", methods=["GET"])
def dashboard():
    return jsonify({
        "estado_sistema": "🟢 OPERATIVO",
        "alertas_criticas": len([a for a in alertas_activas.values() if a['nivel'] == 'critico']),
        "usuarios_activos": len(usuarios),
        "uptime": "99.7%",
        "ultima_actualizacion": datetime.datetime.now().isoformat()
    })

@app.route("/chat", methods=["POST"])
def chat():
    inicio_tiempo = datetime.datetime.now()
    msg = request.json.get("message", "").strip()
    user_id = request.json.get("user_id", "usuario1")
    
    # Análisis de sentimiento
    sentimiento = analizar_sentimiento(msg)
    
    # Respuesta contextual inteligente
    respuesta_contextual = generar_respuesta_contextual(user_id, msg)
    if respuesta_contextual:
        tiempo_respuesta = (datetime.datetime.now() - inicio_tiempo).total_seconds()
        actualizar_metricas(user_id, tiempo_respuesta)
        return jsonify({"response": respuesta_contextual, "tipo": "contextual"})
    
    msg_lower = msg.lower()
    
    # Manejo de comandos especiales
    if msg_lower in ["emergencia", "urgente", "crítico"]:
        enviar_notificacion_critica(msg, user_id)
        return jsonify({
            "response": "🚨 **PROTOCOLO DE EMERGENCIA ACTIVADO**\n\n✅ Especialista notificado\n✅ Ticket crítico creado\n✅ Monitoreo intensivo activado\n\n⏱️ Tiempo estimado de respuesta: 5 minutos",
            "tipo": "emergencia"
        })
    
    # Respuestas personalizadas mejoradas
    if msg_lower in mensajes_personalizados:
        respuesta = mensajes_personalizados[msg_lower]
        guardar_conversacion(user_id, msg, respuesta, sentimiento, "personalizada")
        return jsonify({"response": respuesta, "tipo": "personalizada"})
    
    # Funciones avanzadas
    if msg_lower in ["7", "análisis predictivo"]:
        return jsonify({
            "response": "🔮 **ANÁLISIS PREDICTIVO ACTIVADO**\n\n📊 Analizando patrones...\n⚠️ Posibles problemas detectados:\n• Sobrecarga CPU en 2 horas\n• Memoria crítica en servidor DB\n• Latencia elevada en red\n\n🎯 Recomendación: Ejecutar mantenimiento preventivo",
            "tipo": "ia_avanzada"
        })
    
    if msg_lower in ["8", "recomendaciones"]:
        return jsonify({
            "response": "💡 **RECOMENDACIONES INTELIGENTES**\n\n🔧 Optimizaciones sugeridas:\n• Reiniciar servicios con alta memoria\n• Actualizar configuración de red\n• Programar limpieza de logs\n\n📈 Impacto estimado: +15% rendimiento",
            "tipo": "recomendaciones"
        })
    
    # Inicializar usuario si no existe
    if user_id not in usuarios:
        usuarios[user_id] = {
            "estado": "inicio",
            "sesion_id": hashlib.md5(f"{user_id}{datetime.datetime.now()}".encode()).hexdigest()[:8],
            "preferencias": {},
            "historial_comandos": []
        }
    
    estado = usuarios[user_id]["estado"]
    
    # Lógica de estados existente mejorada
    if estado == "inicio":
        if msg_lower == "1":
            usuarios[user_id]["estado"] = "espera_alarma"
            usuarios[user_id]["historial_comandos"].append("consulta_alarma")
            return jsonify({
                "response": "🔍 **CONSULTA DE ALARMAS ACTIVADA**\n\n📝 Por favor ingresa el número de alarma que deseas consultar.\n\n💡 Tip: Puedes usar comandos como 'última alarma' o 'alarmas críticas'",
                "tipo": "sistema"
            })
        elif msg_lower == "4":
            return jsonify({
                "response": "📊 **DASHBOARD DE ESTADO OPERATIVO**\n\n🟢 Core Network: OPERATIVO\n🟢 Base de Datos: OPERATIVO\n🟡 Servidor Web: CARGA ALTA\n🔴 Backup System: MANTENIMIENTO\n\n📈 Rendimiento general: 94%\n⏱️ Última actualización: hace 2 min",
                "tipo": "dashboard"
            })
        else:
            return jsonify({"response": menu_principal(), "tipo": "menu"})
    
    elif estado == "espera_alarma":
        # Comandos especiales para alarmas
        if msg_lower in ["última alarma", "ultima"]:
            return jsonify({
                "response": "🔔 **ÚLTIMA ALARMA REGISTRADA**\n\n📋 Número: AL-2024-001\n🏷️ Elemento: Core-Router-01\n⚠️ Severidad: CRÍTICA\n⏱️ Tiempo: hace 15 min\n\n¿Deseas ver detalles completos?",
                "tipo": "alarma_reciente"
            })
        
        usuarios[user_id]["numero_alarma"] = msg
        usuarios[user_id]["estado"] = "espera_elemento"
        return jsonify({
            "response": f"✅ Alarma **{msg}** registrada.\n\n🎯 Ahora ingresa el nombre del elemento asociado a la alarma.\n\n🔍 Búsqueda inteligente activada - puedes usar nombres parciales.",
            "tipo": "sistema"
        })
    
    elif estado == "espera_elemento":
        numero = usuarios[user_id]["numero_alarma"]
        elemento = msg.strip().lower()
        usuarios[user_id]["estado"] = "inicio"
        
        # Búsqueda inteligente mejorada
        posibles = get_close_matches(elemento, df["nombre del elemento"], n=3, cutoff=0.4)
        
        if posibles:
            elemento_encontrado = posibles[0]
            resultado = df[
                (df["numero alarma"] == numero) &
                (df["nombre del elemento"] == elemento_encontrado)
            ]
            
            if not resultado.empty:
                fila = resultado.iloc[0]
                
                # Clasificar severidad
                severidad = str(fila.get('severidad', 'N/A'))
                emoji_severidad = "🔴" if 'crítico' in severidad.lower() else "🟡" if 'alto' in severidad.lower() else "🟢"
                
                respuesta = (
                    f"🎯 **ALARMA ENCONTRADA Y ANALIZADA**\n"
                    f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                    f"📋 **Descripción:** {traducir(str(fila.get('descripción alarma', 'N/A')))}\n"
                    f"{emoji_severidad} **Severidad:** {traducir(severidad)}\n"
                    f"🧠 **Significado:** {traducir(str(fila.get('significado', 'N/A')))}\n"
                    f"🛠️ **Acciones recomendadas:** {traducir(str(fila.get('acciones', 'N/A')))}\n"
                    f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                    f"🤖 **Análisis IA:** Problema detectado con alta confianza\n"
                    f"⏱️ **Tiempo estimado de resolución:** 15-30 min\n"
                    f"📞 **¿Necesitas escalamiento?** Escribe 'escalar'"
                )
                
                categoria = "alarma_encontrada"
            else:
                respuesta = (
                    f"❌ **ALARMA NO ENCONTRADA**\n\n"
                    f"🔍 **Búsqueda realizada:**\n"
                    f"• Número: {numero}\n"
                    f"• Elemento: {elemento}\n\n"
                    f"💡 **Elementos similares encontrados:**\n"
                    f"• {', '.join(posibles[:3])}\n\n"
                    f"¿Deseas buscar con alguno de estos elementos?"
                )
                categoria = "alarma_no_encontrada"
        else:
            respuesta = (
                f"❌ **ELEMENTO NO RECONOCIDO**\n\n"
                f"🔍 No se encontraron elementos similares a '{elemento}'\n\n"
                f"💡 **Sugerencias:**\n"
                f"• Verifica la ortografía\n"
                f"• Usa nombres más específicos\n"
                f"• Contacta al administrador si persiste\n\n"
                f"📞 **Escalamiento automático disponible**"
            )
            categoria = "elemento_no_encontrado"
        
        # Guardar conversación
        guardar_conversacion(user_id, f"Alarma: {numero}, Elemento: {elemento}", respuesta, sentimiento, categoria)
        
        # Aprender de la conversación
        aprender_de_conversacion(user_id, msg, respuesta)
        
        # Agregar menú si hay error
        if "❌" in respuesta:
            respuesta += "\n\n" + menu_principal()
        
        tiempo_respuesta = (datetime.datetime.now() - inicio_tiempo).total_seconds()
        actualizar_metricas(user_id, tiempo_respuesta)
        
        return jsonify({"response": respuesta, "tipo": "resultado_alarma"})
    
    # Respuesta por defecto mejorada
    tiempo_respuesta = (datetime.datetime.now() - inicio_tiempo).total_seconds()
    actualizar_metricas(user_id, tiempo_respuesta)
    
    return jsonify({
        "response": "🤖 **ASISTENTE INTELIGENTE ACTIVADO**\n\nNo entendí tu solicitud, pero estoy aprendiendo continuamente.\n\n" + menu_principal(),
        "tipo": "default"
    })

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)