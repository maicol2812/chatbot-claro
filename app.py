# ✅ app.py completo con lógica original + integración frontend experto (sin borrar nada)

from flask import Flask, render_template, jsonify, request, send_from_directory
import pandas as pd
import os
from datetime import datetime
import traceback

app = Flask(__name__, static_folder='static', template_folder='templates')

# Configuración
app.config.update({
    'EXCEL_ALARMAS': 'Ejemplo de alarmas CMM.xlsx',
    'CARPETA_DOCS': 'documentacion_plataformas',
    'MAX_ALARMAS': 10,
    'TIPOS_SEVERIDAD': ['Crítica', 'Alta', 'Media', 'Baja']
})

alarmas_cache = None
ultima_actualizacion = None

# Función para cargar alarmas desde Excel

def cargar_alarmas(force=False):
    global alarmas_cache, ultima_actualizacion
    try:
        mod_time = os.path.getmtime(app.config['EXCEL_ALARMAS'])
        if not force and alarmas_cache and mod_time <= ultima_actualizacion:
            return alarmas_cache.copy()
        df = pd.read_excel(app.config['EXCEL_ALARMAS'])
        columnas_necesarias = ['ID', 'Elemento', 'Severidad', 'Descripción', 'Fecha']
        for col in columnas_necesarias:
            if col not in df.columns:
                raise ValueError(f"Columna requerida faltante: {col}")
        alarmas_cache = df.to_dict(orient='records')
        ultima_actualizacion = mod_time
        return alarmas_cache.copy()
    except Exception as e:
        app.logger.error(f"Error cargando alarmas: {str(e)}\n{traceback.format_exc()}")
        return []

# Función para obtener documentos técnicos

def obtener_documentos():
    documentos = []
    try:
        for archivo in os.listdir(app.config['CARPETA_DOCS']):
            if archivo.lower().endswith(('.pdf', '.docx', '.xlsx')):
                documentos.append({
                    'nombre': os.path.splitext(archivo)[0],
                    'extension': os.path.splitext(archivo)[1][1:],
                    'ruta': f"/docs/{archivo}",
                    'tamaño': os.path.getsize(f"{app.config['CARPETA_DOCS']}/{archivo}"),
                    'fecha': datetime.fromtimestamp(
                        os.path.getmtime(f"{app.config['CARPETA_DOCS']}/{archivo}")
                    ).strftime('%d/%m/%Y %H:%M')
                })
    except Exception as e:
        app.logger.error(f"Error leyendo documentos: {str(e)}")
    return sorted(documentos, key=lambda x: x['nombre'])

# Motor de respuesta

def generar_respuesta(mensaje):
    mensaje = mensaje.lower().strip()
    respuesta = {'tipo': 'texto', 'contenido': '', 'opciones': [], 'datos': None}
    try:
        if any(k in mensaje for k in ['alarma', 'alarmas', 'incidente']):
            alarmas = cargar_alarmas()
            if 'últimas' in mensaje:
                respuesta.update({
                    'tipo': 'alarmas',
                    'contenido': 'Últimas alarmas registradas:',
                    'datos': alarmas[:app.config['MAX_ALARMAS']]
                })
            elif 'buscar' in mensaje or 'número' in mensaje:
                respuesta.update({
                    'tipo': 'input',
                    'contenido': 'Por favor ingresa el número de alarma:',
                    'opciones': ['Cancelar búsqueda']
                })
            else:
                respuesta.update({
                    'contenido': 'Puedo ayudarte con:',
                    'opciones': ['Ver últimas alarmas', 'Buscar alarma por número', 'Alarmas críticas']
                })
        elif any(k in mensaje for k in ['documento', 'manual', 'guía']):
            docs = obtener_documentos()
            respuesta.update({
                'tipo': 'documentos',
                'contenido': 'Documentación disponible:',
                'datos': docs
            })
        elif 'estado' in mensaje or 'operativo' in mensaje:
            respuesta.update({
                'contenido': 'Estado actual de las plataformas:',
                'opciones': [
                    'Plataforma X: Operativa',
                    'Plataforma Y: En mantenimiento',
                    'Plataforma Z: Inestable'
                ]
            })
        else:
            respuesta.update({
                'contenido': '¿En qué puedo ayudarte hoy?',
                'opciones': [
                    'Consultar alarmas',
                    'Ver documentación',
                    'Estado operativo',
                    'Hablar con un humano'
                ]
            })
    except Exception as e:
        app.logger.error(f"Error generando respuesta: {str(e)}")
        respuesta['contenido'] = 'Ocurrió un error procesando tu solicitud.'
    return respuesta

# Endpoints API y frontend

@app.route('/api/chat', methods=['POST'])
def chat_api():
    try:
        mensaje = request.json.get('mensaje', '')
        return jsonify(generar_respuesta(mensaje))
    except Exception as e:
        return jsonify({'tipo': 'error', 'contenido': f'Error en el servidor: {str(e)}'}), 500

@app.route('/api/alarmas')
def alarmas_api():
    try:
        filtro = request.args.get('filtro', '')
        alarmas = cargar_alarmas()
        if filtro:
            if filtro.isdigit():
                alarmas = [a for a in alarmas if str(a.get('ID')) == filtro]
            else:
                alarmas = [a for a in alarmas if filtro.lower() in str(a.get('Elemento', '')).lower()]
        return jsonify(alarmas[:app.config['MAX_ALARMAS']])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/docs/<nombre>')
def servir_documento(nombre):
    return send_from_directory(app.config['CARPETA_DOCS'], nombre)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/detalle_alarma.html')
def detalle_alarma():
    return render_template('detalle_alarma.html')

@app.route('/health')
def health():
    try:
        cargar_alarmas()
        return jsonify({'status': 'healthy'})
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)})

@app.errorhandler(404)
def error_404(e):
    return jsonify({'error': 'Endpoint no encontrado'}), 404

@app.errorhandler(500)
def error_500(e):
    return jsonify({'error': 'Error interno del servidor'}), 500

if __name__ == '__main__':
    if not os.path.exists(app.config['CARPETA_DOCS']):
        os.makedirs(app.config['CARPETA_DOCS'])
    if not os.path.exists(app.config['EXCEL_ALARMAS']):
        with open(app.config['EXCEL_ALARMAS'], 'w') as f:
            f.write('ID,Elemento,Severidad,Descripción,Fecha\n')
    app.run(host='0.0.0.0', port=5000)
# Ejecutar el servidor
# Puedes iniciar el servidor con: python app.py
# Asegúrate de tener Flask y pandas instalados en tu entorno                            