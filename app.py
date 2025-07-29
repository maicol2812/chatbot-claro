from flask import Flask, render_template, jsonify, request, send_from_directory
import pandas as pd
import os
from datetime import datetime
import traceback
from flask import send_file
import numpy as np

app = Flask(__name__, static_folder='static', template_folder='templates')

# Configuración actualizada para el catálogo consolidado
app.config.update({
    'EXCEL_ALARMAS': 'Catalogo_Alarmas_Consolidado_17022025.xlsx',
    'CARPETA_DOCS': 'documentacion_plataformas',
    'MAX_ALARMAS': 20,
    'TIPOS_SEVERIDAD': ['ALTA', 'MEDIA', 'BAJA', 'CRITICA', 'INFORMATIVA'],
    'DOMINIOS': ['NETCOOL', 'METOOL', 'SISTEMA']
})

alarmas_cache = None
ultima_actualizacion = None

def cargar_alarmas(force=False):
    """Función actualizada para cargar alarmas desde el catálogo consolidado"""
    global alarmas_cache, ultima_actualizacion
    try:
        if not os.path.exists(app.config['EXCEL_ALARMAS']):
            app.logger.warning(f"Archivo {app.config['EXCEL_ALARMAS']} no encontrado")
            return []

        mod_time = os.path.getmtime(app.config['EXCEL_ALARMAS'])
        if not force and alarmas_cache and mod_time <= ultima_actualizacion:
            return alarmas_cache.copy()

        # Leer el archivo Excel - puede tener múltiples hojas
        try:
            df = pd.read_excel(app.config['EXCEL_ALARMAS'], sheet_name=0)
        except Exception as e:
            # Si hay error con .xls, intentar como .xlsx
            df = pd.read_excel(app.config['EXCEL_ALARMAS'].replace('.xls', '.xlsx'), sheet_name=0)

        # Limpiar nombres de columnas (remover espacios extra)
        df.columns = df.columns.str.strip()
        
        # Mapeo de columnas según la estructura del catálogo
        column_mapping = {
            'TEXTO DE LA ALARMA': 'Descripcion',
            'TEXTO 2 DE LA ALARMA': 'Descripcion_Adicional', 
            'TEXTO 3 DE LA ALARMA': 'Descripcion_Extendida',
            'DOMINIO': 'Dominio',
            'SEVERIDAD': 'Severidad',
            'CRITICIDAD': 'Criticidad',
            'TIPO DE AVISO': 'Tipo_Aviso',
            'PANEL NETCOOL': 'Panel_Netcool'
        }

        # Renombrar columnas existentes
        for old_col, new_col in column_mapping.items():
            if old_col in df.columns:
                df.rename(columns={old_col: new_col}, inplace=True)

        # Crear ID único si no existe
        if 'ID' not in df.columns:
            df['ID'] = range(1, len(df) + 1)

        # Crear columna de elemento si no existe
        if 'Elemento' not in df.columns:
            df['Elemento'] = df.get('Dominio', 'Sistema Desconocido')

        # Agregar fecha si no existe
        if 'Fecha' not in df.columns:
            df['Fecha'] = datetime.now().strftime('%Y-%m-%d %H:%M')

        # Limpiar datos nulos y normalizar
        df = df.fillna('')
        
        # Normalizar severidad
        if 'Severidad' in df.columns:
            df['Severidad'] = df['Severidad'].str.upper().str.strip()
            # Mapear valores comunes
            severidad_map = {
                'CRITICAL': 'CRITICA',
                'HIGH': 'ALTA', 
                'MEDIUM': 'MEDIA',
                'LOW': 'BAJA',
                'INFO': 'INFORMATIVA'
            }
            df['Severidad'] = df['Severidad'].replace(severidad_map)

        # Crear descripción combinada
        desc_cols = ['Descripcion', 'Descripcion_Adicional', 'Descripcion_Extendida']
        df['Descripcion_Completa'] = df[desc_cols].apply(
            lambda x: ' • '.join([str(val) for val in x if str(val).strip()]), axis=1
        )

        # Crear significado y acciones por defecto basados en la severidad
        def generar_significado_acciones(row):
            severidad = row.get('Severidad', '').upper()
            
            if severidad == 'CRITICA':
                significado = f"Alarma crítica en {row.get('Elemento', 'sistema')} - Requiere atención inmediata"
                acciones = "1. Verificar estado del equipo • 2. Revisar conectividad • 3. Contactar NOC • 4. Escalar si es necesario"
            elif severidad == 'ALTA':
                significado = f"Alarma de alta prioridad en {row.get('Elemento', 'sistema')} - Intervención requerida"
                acciones = "1. Revisar logs del sistema • 2. Verificar configuración • 3. Monitorear evolución • 4. Documentar solución"
            elif severidad == 'MEDIA':
                significado = f"Alarma de severidad media en {row.get('Elemento', 'sistema')} - Seguimiento necesario"
                acciones = "1. Monitorear comportamiento • 2. Revisar tendencias • 3. Programar mantenimiento • 4. Actualizar documentación"
            else:
                significado = f"Alarma informativa en {row.get('Elemento', 'sistema')} - Para conocimiento"
                acciones = "1. Tomar nota del evento • 2. Revisar si es recurrente • 3. Actualizar base de conocimiento"
            
            return pd.Series([significado, acciones])

        df[['Significado', 'Acciones']] = df.apply(generar_significado_acciones, axis=1)

        # Convertir a diccionario para cache
        alarmas_cache = df.to_dict(orient='records')
        ultima_actualizacion = mod_time
        
        app.logger.info(f"Cargadas {len(alarmas_cache)} alarmas del catálogo consolidado")
        return alarmas_cache.copy()

    except Exception as e:
        app.logger.error(f"Error cargando alarmas: {str(e)}\n{traceback.format_exc()}")
        return []

def buscar_alarma_por_criterios(criterio, valor):
    """Buscar alarmas por diferentes criterios"""
    try:
        alarmas = cargar_alarmas()
        if not alarmas:
            return []

        valor = str(valor).lower().strip()
        resultados = []

        for alarma in alarmas:
            match = False
            
            if criterio == 'id' and str(alarma.get('ID', '')).lower() == valor:
                match = True
            elif criterio == 'elemento' and valor in str(alarma.get('Elemento', '')).lower():
                match = True
            elif criterio == 'severidad' and valor in str(alarma.get('Severidad', '')).lower():
                match = True
            elif criterio == 'descripcion' and valor in str(alarma.get('Descripcion_Completa', '')).lower():
                match = True
            elif criterio == 'dominio' and valor in str(alarma.get('Dominio', '')).lower():
                match = True
            elif criterio == 'texto' and (
                valor in str(alarma.get('Descripcion_Completa', '')).lower() or
                valor in str(alarma.get('Elemento', '')).lower() or
                valor in str(alarma.get('Dominio', '')).lower()
            ):
                match = True
                
            if match:
                resultados.append(alarma)

        return resultados[:app.config['MAX_ALARMAS']]
        
    except Exception as e:
        app.logger.error(f"Error buscando alarmas: {str(e)}")
        return []

def obtener_estadisticas_alarmas():
    """Generar estadísticas del catálogo de alarmas"""
    try:
        alarmas = cargar_alarmas()
        if not alarmas:
            return {}

        total = len(alarmas)
        por_severidad = {}
        por_dominio = {}
        
        for alarma in alarmas:
            # Contar por severidad
            sev = alarma.get('Severidad', 'NO_DEFINIDA')
            por_severidad[sev] = por_severidad.get(sev, 0) + 1
            
            # Contar por dominio
            dom = alarma.get('Dominio', 'NO_DEFINIDO')
            por_dominio[dom] = por_dominio.get(dom, 0) + 1

        return {
            'total': total,
            'por_severidad': por_severidad,
            'por_dominio': por_dominio,
            'fecha_actualizacion': datetime.now().strftime('%d/%m/%Y %H:%M')
        }
        
    except Exception as e:
        app.logger.error(f"Error generando estadísticas: {str(e)}")
        return {}

def obtener_documentos():
    """Función para obtener documentos técnicos"""
    documentos = []
    try:
        if not os.path.exists(app.config['CARPETA_DOCS']):
            os.makedirs(app.config['CARPETA_DOCS'])
            
        for archivo in os.listdir(app.config['CARPETA_DOCS']):
            if archivo.lower().endswith(('.pdf', '.docx', '.xlsx', '.xls', '.txt')):
                ruta_completa = os.path.join(app.config['CARPETA_DOCS'], archivo)
                documentos.append({
                    'nombre': os.path.splitext(archivo)[0],
                    'extension': os.path.splitext(archivo)[1][1:],
                    'ruta': f"/docs/{archivo}",
                    'tamaño': os.path.getsize(ruta_completa),
                    'fecha': datetime.fromtimestamp(
                        os.path.getmtime(ruta_completa)
                    ).strftime('%d/%m/%Y %H:%M')
                })
    except Exception as e:
        app.logger.error(f"Error leyendo documentos: {str(e)}")
    return sorted(documentos, key=lambda x: x['nombre'])

def generar_respuesta(mensaje):
    """Motor de respuesta mejorado para el catálogo"""
    mensaje = mensaje.lower().strip()
    respuesta = {'tipo': 'texto', 'contenido': '', 'opciones': [], 'datos': None}
    
    try:
        if any(k in mensaje for k in ['alarma', 'alarmas', 'incidente']):
            if 'estadisticas' in mensaje or 'estadística' in mensaje:
                stats = obtener_estadisticas_alarmas()
                respuesta.update({
                    'tipo': 'estadisticas',
                    'contenido': 'Estadísticas del catálogo de alarmas:',
                    'datos': stats
                })
            elif 'critica' in mensaje or 'crítica' in mensaje:
                alarmas_criticas = buscar_alarma_por_criterios('severidad', 'critica')
                respuesta.update({
                    'tipo': 'alarmas',
                    'contenido': f'Encontradas {len(alarmas_criticas)} alarmas críticas:',
                    'datos': alarmas_criticas
                })
            elif 'netcool' in mensaje:
                alarmas_netcool = buscar_alarma_por_criterios('dominio', 'netcool')
                respuesta.update({
                    'tipo': 'alarmas',
                    'contenido': f'Alarmas del dominio NETCOOL:',
                    'datos': alarmas_netcool
                })
            elif 'buscar' in mensaje or 'número' in mensaje:
                respuesta.update({
                    'tipo': 'input',
                    'contenido': 'Puedes buscar por: ID, elemento, severidad o descripción. ¿Qué deseas buscar?',
                    'opciones': ['Buscar por ID', 'Buscar por elemento', 'Buscar por severidad', 'Cancelar']
                })
            else:
                alarmas = cargar_alarmas()
                respuesta.update({
                    'tipo': 'alarmas',
                    'contenido': f'Catálogo de alarmas ({len(alarmas)} registros):',
                    'datos': alarmas[:app.config['MAX_ALARMAS']],
                    'opciones': ['Ver estadísticas', 'Filtrar por severidad', 'Buscar específica']
                })
                
        elif any(k in mensaje for k in ['documento', 'manual', 'guía', 'documentación']):
            docs = obtener_documentos()
            respuesta.update({
                'tipo': 'documentos',
                'contenido': 'Documentación técnica disponible:',
                'datos': docs
            })
            
        elif 'estado' in mensaje or 'operativo' in mensaje:
            stats = obtener_estadisticas_alarmas()
            respuesta.update({
                'tipo': 'estado_operativo', 
                'contenido': 'Estado operativo de las plataformas:',
                'datos': stats,
                'opciones': [
                    f"Total alarmas: {stats.get('total', 0)}",
                    f"Críticas: {stats.get('por_severidad', {}).get('CRITICA', 0)}",
                    f"Altas: {stats.get('por_severidad', {}).get('ALTA', 0)}"
                ]
            })
            
        else:
            respuesta.update({
                'contenido': '¿En qué puedo ayudarte con el catálogo de alarmas?',
                'opciones': [
                    'Ver catálogo completo',
                    'Buscar alarma específica', 
                    'Estadísticas del catálogo',
                    'Alarmas críticas',
                    'Documentación técnica'
                ]
            })
            
    except Exception as e:
        app.logger.error(f"Error generando respuesta: {str(e)}")
        respuesta['contenido'] = f'Error procesando solicitud: {str(e)}'
        
    return respuesta

# API Endpoints
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
        criterio = request.args.get('criterio', 'texto')
        
        if filtro:
            alarmas = buscar_alarma_por_criterios(criterio, filtro)
        else:
            alarmas = cargar_alarmas()[:app.config['MAX_ALARMAS']]
            
        return jsonify({
            'alarmas': alarmas,
            'total': len(alarmas),
            'criterio': criterio,
            'filtro': filtro
        })
    except Exception as e:
        app.logger.error(f"Error en alarmas_api: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/alarmas/estadisticas')
def estadisticas_api():
    try:
        return jsonify(obtener_estadisticas_alarmas())
    except Exception as e:
        app.logger.error(f"Error en estadisticas_api: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/alarmas/<int:alarma_id>')
def detalle_alarma_api(alarma_id):
    try:
        alarmas = buscar_alarma_por_criterios('id', alarma_id)
        if alarmas:
            return jsonify(alarmas[0])
        else:
            return jsonify({'error': 'Alarma no encontrada'}), 404
    except Exception as e:
        app.logger.error(f"Error en detalle_alarma_api: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/docs/<path:nombre>')
def servir_documento(nombre):
    try:
        return send_from_directory(app.config['CARPETA_DOCS'], nombre)
    except Exception as e:
        app.logger.error(f"Error sirviendo documento {nombre}: {str(e)}")
        return jsonify({'error': 'Archivo no encontrado'}), 404

# Rutas de páginas
@app.route('/')
def index():
    try:
        stats = obtener_estadisticas_alarmas()
        return render_template('index.html', estadisticas=stats)
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
        estadisticas = obtener_estadisticas_alarmas()
        return render_template('estado_alarmas.html', 
                             alarmas=alarmas[:50],  # Mostrar máximo 50
                             estadisticas=estadisticas,
                             fecha=datetime.now().strftime('%d/%m/%Y %H:%M'))
    except Exception as e:
        app.logger.error(f"Error en estado_alarmas: {str(e)}")
        return f"Error cargando estado de alarmas: {str(e)}", 500

@app.route('/health')
def health():
    try:
        alarmas = cargar_alarmas()
        stats = obtener_estadisticas_alarmas()
        
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'alarmas_count': len(alarmas),
            'excel_exists': os.path.exists(app.config['EXCEL_ALARMAS']),
            'docs_folder_exists': os.path.exists(app.config['CARPETA_DOCS']),
            'estadisticas': stats
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

@app.route('/static/<path:filename>')
def serve_static(filename):
    """Endpoint explícito para servir archivos estáticos"""
    return send_from_directory(app.static_folder, filename)

def crear_archivos_iniciales():
    """Crear archivos y carpetas necesarios si no existen"""
    try:
        # Crear carpeta de documentos
        if not os.path.exists(app.config['CARPETA_DOCS']):
            os.makedirs(app.config['CARPETA_DOCS'])
            app.logger.info(f"Carpeta {app.config['CARPETA_DOCS']} creada")

        # Verificar si existe el archivo de catálogo
        if not os.path.exists(app.config['EXCEL_ALARMAS']):
            app.logger.warning(f"Archivo {app.config['EXCEL_ALARMAS']} no encontrado")
            app.logger.info("Por favor, coloca el archivo 'Catalogo_Alarmas_Consolidado_17022025.xlsx' en el directorio raíz")
            
    except Exception as e:
        app.logger.error(f"Error creando archivos iniciales: {str(e)}")

if __name__ == '__main__':
    # Configurar logging
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Crear archivos necesarios
    crear_archivos_iniciales()
    
    # Configuración para desarrollo/producción
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('FLASK_ENV') == 'development'
    
    app.logger.info(f"Iniciando aplicación en puerto {port}")
    app.logger.info(f"Modo debug: {debug_mode}")
    app.logger.info(f"Buscando catálogo: {app.config['EXCEL_ALARMAS']}")
    
    # Cargar alarmas al inicio para verificar funcionamiento
    alarmas_iniciales = cargar_alarmas()
    app.logger.info(f"Cargadas {len(alarmas_iniciales)} alarmas del catálogo")
    
    app.run(host='0.0.0.0', port=port, debug=debug_mode)