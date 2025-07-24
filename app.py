# ✅ app.py completo con lógica original + integración frontend experto (con estado_alarmas agregado)

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
        if not os.path.exists(app.config['EXCEL_ALARMAS']):
            return []

        mod_time = os.path.getmtime(app.config['EXCEL_ALARMAS'])
        if not force and alarmas_cache and mod_time <= ultima_actualizacion:
            return alarmas_cache.copy()

        df = pd.read_excel(app.config['EXCEL_ALARMAS'])

        # Renombrar columnas según estructura original del archivo
        df.rename(columns={
            'Numero alarma': 'ID',
            'Nombre del elemento': 'Elemento',
            'Descripción alarma': 'Descripción',
            'Severidad': 'Severidad',
            'Significado ': 'Significado',
            'Acciones': 'Acciones'
        }, inplace=True)

        if 'Fecha' not in df.columns:
            df['Fecha'] = datetime.now().strftime('%Y-%m-%d %H:%M')

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
        if not os.path.exists(app.config['CARPETA_DOCS']):
            os.makedirs(app.config['CARPETA_DOCS'])
        for archivo in os.listdir(app.config['CARPETA_DOCS']):
            if archivo.lower().endswith(('.pdf', '.docx', '.xlsx')):
                documentos.append({
                    'nombre': os.path.splitext(archivo)[0],
                    'extension': os.path.splitext(archivo)[1][1:],
                    'ruta': f"/docs/{archivo}",
                    'tamaño': os.path.getsize(os.path.join(app.config['CARPETA_DOCS'], archivo)),
                    'fecha': datetime.fromtimestamp(
                        os.path.getmtime(os.path.join(app.config['CARPETA_DOCS'], archivo))
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
            if 'ultima' in mensaje or 'ultimas' in mensaje:
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
        data = request.get_json()
        if not data:
            return jsonify({'tipo': 'error', 'contenido': 'No se recibieron datos'}), 400
        mensaje = data.get('mensaje', '')
        return jsonify(generar_respuesta(mensaje))
    except Exception as e:
        app.logger.error(f"Error en chat_api: {str(e)}")
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
        app.logger.error(f"Error en alarmas_api: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/docs/<path:nombre>')
def servir_documento(nombre):
    try:
        return send_from_directory(app.config['CARPETA_DOCS'], nombre)
    except Exception as e:
        app.logger.error(f"Error sirviendo documento {nombre}: {str(e)}")
        return jsonify({'error': 'Archivo no encontrado'}), 404

@app.route('/')
def index():
    try:
        return render_template('index.html')
    except Exception as e:
        app.logger.error(f"Error en index: {str(e)}")
        return f"Error cargando página principal: {str(e)}", 500

@app.route('/detalle_alarma.html')
def detalle_alarma():
    try:
        return render_template('detalle_alarma.html')
    except Exception as e:
        app.logger.error(f"Error en detalle_alarma: {str(e)}")
        return f"Error cargando detalle de alarma: {str(e)}", 500

@app.route('/estado_alarmas.html')
def estado_alarmas():
    try:
        alarmas = cargar_alarmas()
        return render_template('estado_alarmas.html', 
                             alarmas=alarmas, 
                             fecha=datetime.now().strftime('%d/%m/%Y %H:%M'))
    except Exception as e:
        app.logger.error(f"Error en estado_alarmas: {str(e)}")
        return f"Error cargando estado de alarmas: {str(e)}", 500

@app.route('/health')
def health():
    try:
        # Test básico de funcionamiento
        alarmas = cargar_alarmas()
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'alarmas_count': len(alarmas),
            'excel_exists': os.path.exists(app.config['EXCEL_ALARMAS']),
            'docs_folder_exists': os.path.exists(app.config['CARPETA_DOCS'])
        })
    except Exception as e:
        app.logger.error(f"Error in health check: {str(e)}")
        return jsonify({
            'status': 'unhealthy', 
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.errorhandler(404)
def error_404(e):
    app.logger.warning(f"404 error: {request.url}")
    return jsonify({'error': 'Endpoint no encontrado', 'url': request.url}), 404

@app.errorhandler(500)
def error_500(e):
    app.logger.error(f"500 error: {str(e)}")
    return jsonify({'error': 'Error interno del servidor'}), 500

# Inicialización y configuración para producción
def crear_archivos_iniciales():
    """Crear archivos y carpetas necesarios si no existen"""
    try:
        # Crear carpeta de documentos
        if not os.path.exists(app.config['CARPETA_DOCS']):
            os.makedirs(app.config['CARPETA_DOCS'])
            app.logger.info(f"Carpeta {app.config['CARPETA_DOCS']} creada")

        # Crear archivo Excel de ejemplo si no existe
        if not os.path.exists(app.config['EXCEL_ALARMAS']):
            # Crear un DataFrame de ejemplo
            ejemplo_alarmas = pd.DataFrame({
                'Numero alarma': [1001, 1002, 1003],
                'Nombre del elemento': ['Router Principal', 'Switch Core', 'Servidor DB'],
                'Descripción alarma': ['Pérdida de conectividad', 'Puerto desconectado', 'Base de datos lenta'],
                'Severidad': ['Crítica', 'Alta', 'Media'],
                'Significado ': ['Interrupción del servicio principal', 'Conexión de red interrumpida', 'Rendimiento degradado'],
                'Acciones': ['Reiniciar router • Verificar cables', 'Revisar puerto • Reemplazar cable', 'Optimizar queries • Reiniciar servicio']
            })
            ejemplo_alarmas.to_excel(app.config['EXCEL_ALARMAS'], index=False)
            app.logger.info(f"Archivo de ejemplo {app.config['EXCEL_ALARMAS']} creado")
            
    except Exception as e:
        app.logger.error(f"Error creando archivos iniciales: {str(e)}")

if __name__ == '__main__':
    # Configurar logging
    import logging
    logging.basicConfig(level=logging.INFO)
    
    # Crear archivos necesarios
    crear_archivos_iniciales()
    
    # Configuración para Render
    port = int(os.environ.get('PORT', 10000))
    debug_mode = os.environ.get('FLASK_ENV') == 'development'
    
    app.logger.info(f"Iniciando aplicación en puerto {port}")
    app.logger.info(f"Modo debug: {debug_mode}")
    
    app.run(host='0.0.0.0', port=port, debug=debug_mode)