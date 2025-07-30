from flask import Flask, render_template, jsonify, request, send_from_directory
import pandas as pd
import os
from datetime import datetime
import traceback
from flask import send_file
import numpy as np
from flask_cors import CORS
import logging
import PyPDF2
import docx
from pathlib import Path
import re

# Configuración inicial de la aplicación
app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# Configuración para el catálogo de alarmas
app.config.update({
    'EXCEL_ALARMAS': 'CatalogoAlarmas.xlsx',
    'CARPETA_DOCS': 'documentacion_plataformas',
    'CARPETA_DOCS_ALARMAS': 'documentos_alarmas',  # Nueva carpeta para PDFs de alarmas
    'MAX_ALARMAS': 50,
    'TIPOS_SEVERIDAD': ['CRITICA', 'ALTA', 'MEDIA', 'BAJA', 'INFORMATIVA', 'BLOQUEO'],
    'DOMINIOS': ['NETCOOL', 'METOOL', 'SISTEMA', 'Domain amx_ns:.DOM.COLM_TRIARA_U2000_DOM'],
    'SHEET_NAME': 'Afectacion',
    'DOCS_ALARMAS': ['Alarmas vSR.pdf', 'vDSR Alarms and KPIs.pdf']  # Lista de documentos de alarmas
})

# Variables globales para caché
alarmas_cache = None
ultima_actualizacion = None
docs_cache = {}  # Cache para contenido de documentos

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def crear_archivos_iniciales():
    """Crear estructura de carpetas y archivos iniciales"""
    carpetas = [
        app.config['CARPETA_DOCS'],
        app.config['CARPETA_DOCS_ALARMAS']
    ]
    
    for carpeta in carpetas:
        if not os.path.exists(carpeta):
            os.makedirs(carpeta)
            logger.info(f"Creada carpeta: {carpeta}")

def extraer_texto_pdf(ruta_archivo):
    """Extraer texto de un archivo PDF"""
    try:
        texto = ""
        with open(ruta_archivo, 'rb') as archivo:
            lector_pdf = PyPDF2.PdfReader(archivo)
            for pagina in lector_pdf.pages:
                texto += pagina.extract_text() + "\n"
        return texto
    except Exception as e:
        logger.error(f"Error extrayendo texto de PDF {ruta_archivo}: {str(e)}")
        return ""

def extraer_texto_docx(ruta_archivo):
    """Extraer texto de un archivo DOCX"""
    try:
        doc = docx.Document(ruta_archivo)
        texto = ""
        for parrafo in doc.paragraphs:
            texto += parrafo.text + "\n"
        return texto
    except Exception as e:
        logger.error(f"Error extrayendo texto de DOCX {ruta_archivo}: {str(e)}")
        return ""

def cargar_documentos_alarmas():
    """Cargar y cachear el contenido de los documentos de alarmas"""
    global docs_cache
    
    carpeta_docs = app.config['CARPETA_DOCS_ALARMAS']
    documentos = app.config['DOCS_ALARMAS']
    
    for nombre_doc in documentos:
        ruta_completa = os.path.join(carpeta_docs, nombre_doc)
        
        if os.path.exists(ruta_completa):
            if nombre_doc not in docs_cache:
                logger.info(f"Cargando documento: {nombre_doc}")
                
                if nombre_doc.lower().endswith('.pdf'):
                    contenido = extraer_texto_pdf(ruta_completa)
                elif nombre_doc.lower().endswith('.docx'):
                    contenido = extraer_texto_docx(ruta_completa)
                else:
                    contenido = ""
                
                docs_cache[nombre_doc] = {
                    'contenido': contenido,
                    'ruta': ruta_completa,
                    'fecha_carga': datetime.now()
                }
        else:
            logger.warning(f"Documento no encontrado: {ruta_completa}")

def buscar_en_documentos(termino_busqueda):
    """Buscar información relacionada con una alarma en los documentos"""
    resultados = []
    
    # Asegurar que los documentos estén cargados
    cargar_documentos_alarmas()
    
    termino_busqueda = termino_busqueda.lower().strip()
    
    for nombre_doc, info_doc in docs_cache.items():
        contenido = info_doc['contenido'].lower()
        
        if termino_busqueda in contenido:
            # Encontrar contexto alrededor del término
            lineas = contenido.split('\n')
            fragmentos_relevantes = []
            
            for i, linea in enumerate(lineas):
                if termino_busqueda in linea:
                    # Obtener contexto (3 líneas antes y después)
                    inicio = max(0, i - 3)
                    
                    fin = min(len(lineas), i + 4)
                    contexto = '\n'.join(lineas[inicio:fin])
                    
                    fragmentos_relevantes.append({
                        'fragmento': contexto,
                        'linea': i + 1
                    })
            
            if fragmentos_relevantes:
                resultados.append({
                    'documento': nombre_doc,
                    'ruta': info_doc['ruta'],
                    'fragmentos': fragmentos_relevantes[:3],  # Máximo 3 fragmentos por documento
                    'total_ocurrencias': len(fragmentos_relevantes)
                })
    
    return resultados

def crear_datos_demo():
    """Datos de demostración completos"""
    return [
        {
            'ID': 1,
            'Fabricante': 'Huawei',
            'Servicio_Gestionado': 'AAA Huawei',
            'Gestor': 'NETCOOL',
            'Codigo_Alarma': '1003',
            'Descripcion_Corta': 'Module Fault',
            'Descripcion_Larga': 'Error en módulo del sistema',
            'Detalles_Adicionales': 'Módulo principal presenta fallas',
            'Nivel': 'ALTA',
            'Dominio': 'Domain amx_ns:.DOM.COLM_TRIARA_U2000_DOM',
            'Severidad': 'CRITICA',
            'Tipo_Aviso': 'GENERAL',
            'Grupo_Atencion': 'BO CORE',
            'Criticidad': 'ALTA',
            'Dueño_Plataforma': 'EDISON GONZALEZ',
            'Panel_Netcool': 'AEL PACKET CORE VAS II',
            'Elemento': 'AAA Huawei',
            'Fecha': datetime.now().strftime('%Y-%m-%d %H:%M'),
            'Descripcion_Completa': 'Module Fault • Error en módulo del sistema • Módulo principal presenta fallas',
            'Significado': 'Alarma crítica en AAA Huawei - Requiere atención inmediata',
            'Acciones': '1. Verificar estado del equipo • 2. Revisar conectividad • 3. Contactar NOC • 4. Escalar si es necesario'
        },
        {
            'ID': 2,
            'Fabricante': 'Ericsson',
            'Servicio_Gestionado': 'MME Ericsson',
            'Gestor': 'NETCOOL',
            'Codigo_Alarma': '2001',
            'Descripcion_Corta': 'S1AP Connection Lost',
            'Descripcion_Larga': 'Pérdida de conexión S1AP',
            'Detalles_Adicionales': 'Interfaz S1 no disponible',
            'Nivel': 'CRITICA',
            'Dominio': 'NETCOOL',
            'Severidad': 'CRITICA',
            'Tipo_Aviso': 'CONNECTIVITY',
            'Grupo_Atencion': 'CORE NETWORK',
            'Criticidad': 'CRITICA',
            'Dueño_Plataforma': 'LUIS MARTINEZ',
            'Panel_Netcool': 'CORE LTE',
            'Elemento': 'MME Ericsson',
            'Fecha': datetime.now().strftime('%Y-%m-%d %H:%M'),
            'Descripcion_Completa': 'S1AP Connection Lost • Pérdida de conexión S1AP • Interfaz S1 no disponible',
            'Significado': 'Alarma crítica en MME Ericsson - Pérdida de conectividad',
            'Acciones': '1. Verificar enlaces de red • 2. Revisar configuración S1AP • 3. Coordinar con transporte • 4. Escalar a fabricante'
        }
    ]

def cargar_alarmas(force=False):
    """Cargar alarmas desde Excel o usar datos demo"""
    global alarmas_cache, ultima_actualizacion
    try:
        if not os.path.exists(app.config['EXCEL_ALARMAS']):
            logger.warning(f"Archivo {app.config['EXCEL_ALARMAS']} no encontrado - Usando datos demo")
            if not alarmas_cache:
                alarmas_cache = crear_datos_demo()
                ultima_actualizacion = datetime.now().timestamp()
            return alarmas_cache.copy()

        mod_time = os.path.getmtime(app.config['EXCEL_ALARMAS'])
        if not force and alarmas_cache and mod_time <= ultima_actualizacion:
            return alarmas_cache.copy()

        try:
            try:
                df = pd.read_excel(app.config['EXCEL_ALARMAS'], sheet_name=app.config['SHEET_NAME'])
            except:
                df = pd.read_excel(app.config['EXCEL_ALARMAS'], sheet_name=1)
                
            if df.empty:
                raise ValueError("El archivo Excel no contiene datos o la hoja es incorrecta")
                
        except Exception as e:
            logger.error(f"Error leyendo Excel: {str(e)} - Usando datos demo")
            alarmas_cache = crear_datos_demo()
            return alarmas_cache.copy()

        # Procesamiento del DataFrame
        df.columns = df.columns.str.strip()
        
        column_mapping = {
            'Fabricante': 'Fabricante',
            'SERVICIO Y/O SISTEMA GESTIONADO': 'Servicio_Gestionado',
            'GESTOR': 'Gestor',
            'TEXTO 1 DE LA ALARMA': 'Codigo_Alarma',
            'TEXTO 2 DE LA ALARMA': 'Descripcion_Corta', 
            'TEXTO 3 DE LA ALARMA': 'Descripcion_Larga',
            'TEXTO 4 DE LA ALARMA': 'Detalles_Adicionales',
            'BAJA / ALTA / BLOQUEO': 'Nivel',
            'DOMINIO': 'Dominio',
            'SEVERIDAD': 'Severidad',
            'TIPO DE ALARMA': 'Tipo_Aviso',
            'GRUPO DE ATENCIÓN': 'Grupo_Atencion',
            'CRITICIDAD': 'Criticidad',
            'DUEÑO DE PLATAFORMA': 'Dueño_Plataforma',
            'PANEL NETCOOL': 'Panel_Netcool'
        }

        for old_col, new_col in column_mapping.items():
            if old_col in df.columns:
                df.rename(columns={old_col: new_col}, inplace=True)

        if 'ID' not in df.columns:
            df['ID'] = range(1, len(df) + 1)

        if 'Elemento' not in df.columns:
            df['Elemento'] = df.get('Servicio_Gestionado', 'Sistema Desconocido')

        if 'Fecha' not in df.columns:
            df['Fecha'] = datetime.now().strftime('%Y-%m-%d %H:%M')

        df = df.fillna('')
        
        for col in ['Severidad', 'Nivel']:
            if col in df.columns:
                df[col] = df[col].astype(str).str.upper().str.strip()
                severidad_map = {
                    'CRITICAL': 'CRITICA',
                    'HIGH': 'ALTA', 
                    'MEDIUM': 'MEDIA',
                    'LOW': 'BAJA',
                    'INFO': 'INFORMATIVA',
                    'BLOQUEO': 'BLOQUEO',
                    'ALTA': 'ALTA',
                    'BAJA': 'BAJA',
                    'AFECTACION': 'MEDIA'
                }
                df[col] = df[col].replace(severidad_map)

        desc_cols = ['Descripcion_Corta', 'Descripcion_Larga', 'Detalles_Adicionales']
        existing_cols = [col for col in desc_cols if col in df.columns]
        df['Descripcion_Completa'] = df[existing_cols].apply(
            lambda x: ' • '.join([str(val) for val in x if str(val).strip()]), axis=1
        )

        def generar_significado_acciones(row):
            severidad = str(row.get('Severidad', '')).upper()
            nivel = str(row.get('Nivel', '')).upper()
            nivel_efectivo = nivel if nivel in ['CRITICA', 'ALTA', 'MEDIA', 'BAJA', 'BLOQUEO'] else severidad
            elemento = row.get('Elemento', 'sistema')
            
            if nivel_efectivo == 'CRITICA' or nivel_efectivo == 'BLOQUEO':
                significado = f"Alarma crítica en {elemento} - Requiere atención inmediata"
                acciones = "1. Verificar estado del equipo • 2. Revisar conectividad • 3. Contactar NOC • 4. Escalar si es necesario"
            elif nivel_efectivo == 'ALTA':
                significado = f"Alarma de alta prioridad en {elemento} - Intervención requerida"
                acciones = "1. Revisar logs del sistema • 2. Verificar configuración • 3. Monitorear evolución • 4. Documentar solución"
            elif nivel_efectivo == 'MEDIA':
                significado = f"Alarma de severidad media en {elemento} - Seguimiento necesario"
                acciones = "1. Monitorear comportamiento • 2. Revisar tendencias • 3. Programar mantenimiento • 4. Actualizar documentación"
            else:
                significado = f"Alarma informativa en {elemento} - Para conocimiento"
                acciones = "1. Tomar nota del evento • 2. Revisar si es recurrente • 3. Actualizar base de conocimiento"
            
            return pd.Series([significado, acciones])

        df[['Significado', 'Acciones']] = df.apply(generar_significado_acciones, axis=1)

        alarmas_cache = df.to_dict(orient='records')
        ultima_actualizacion = mod_time
        
        logger.info(f"Cargadas {len(alarmas_cache)} alarmas del catálogo consolidado")
        return alarmas_cache.copy()

    except Exception as e:
        logger.error(f"Error cargando alarmas: {str(e)}\n{traceback.format_exc()}")
        if not alarmas_cache:
            alarmas_cache = crear_datos_demo()
        return alarmas_cache.copy()

def buscar_alarma_por_criterios(criterio, valor):
    """Función completa de búsqueda"""
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
            elif criterio == 'servicio' and valor in str(alarma.get('Servicio_Gestionado', '')).lower():
                match = True
            elif criterio == 'codigo' and valor in str(alarma.get('Codigo_Alarma', '')).lower():
                match = True
            elif criterio == 'severidad' and valor in str(alarma.get('Severidad', '')).lower():
                match = True
            elif criterio == 'nivel' and valor in str(alarma.get('Nivel', '')).lower():
                match = True
            elif criterio == 'descripcion' and valor in str(alarma.get('Descripcion_Completa', '')).lower():
                match = True
            elif criterio == 'dominio' and valor in str(alarma.get('Dominio', '')).lower():
                match = True
            elif criterio == 'texto' and (
                valor in str(alarma.get('Descripcion_Completa', '')).lower() or
                valor in str(alarma.get('Elemento', '')).lower() or
                valor in str(alarma.get('Servicio_Gestionado', '')).lower() or
                valor in str(alarma.get('Codigo_Alarma', '')).lower()
            ):
                match = True
                
            if match:
                resultados.append(alarma)

        return resultados[:app.config['MAX_ALARMAS']]
        
    except Exception as e:
        logger.error(f"Error buscando alarmas: {str(e)}")
        return []

def obtener_estadisticas_alarmas():
    """Obtener estadísticas de las alarmas cargadas"""
    try:
        alarmas = cargar_alarmas()
        if not alarmas:
            return {'total': 0}
        
        stats = {
            'total': len(alarmas),
            'por_severidad': {},
            'por_dominio': {},
            'por_fabricante': {}
        }
        
        for alarma in alarmas:
            # Severidad
            sev = alarma.get('Severidad', 'NO DEFINIDA')
            stats['por_severidad'][sev] = stats['por_severidad'].get(sev, 0) + 1
            
            # Dominio
            dom = alarma.get('Dominio', 'NO DEFINIDO')
            stats['por_dominio'][dom] = stats['por_dominio'].get(dom, 0) + 1
            
            # Fabricante
            fab = alarma.get('Fabricante', 'NO DEFINIDO')
            stats['por_fabricante'][fab] = stats['por_fabricante'].get(fab, 0) + 1
        
        return stats
        
    except Exception as e:
        logger.error(f"Error obteniendo estadísticas: {str(e)}")
        return {'total': 0}

# ENDPOINTS

@app.route('/')
def home():
    estadisticas = obtener_estadisticas_alarmas()
    return render_template('index.html', estadisticas=estadisticas)

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
            'filtro': filtro,
            'estadisticas': obtener_estadisticas_alarmas()
        })
    except Exception as e:
        logger.error(f"Error en alarmas_api: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/alarma/<int:id>')
def alarma_detalle(id):
    try:
        alarmas = cargar_alarmas()
        alarma = next((a for a in alarmas if a.get('ID') == id), None)
        
        if not alarma:
            return jsonify({'error': 'Alarma no encontrada'}), 404
        
        # Buscar documentación relacionada
        terminos_busqueda = [
            alarma.get('Codigo_Alarma', ''),
            alarma.get('Descripcion_Corta', ''),
            alarma.get('Elemento', ''),
            alarma.get('Servicio_Gestionado', '')
        ]
        
        documentacion = []
        for termino in terminos_busqueda:
            if termino and len(termino.strip()) > 2:
                docs_encontrados = buscar_en_documentos(termino.strip())
                for doc in docs_encontrados:
                    # Evitar duplicados
                    if not any(d['documento'] == doc['documento'] for d in documentacion):
                        documentacion.append(doc)
        
        return jsonify({
            'alarma': alarma,
            'documentacion': documentacion
        })
        
    except Exception as e:
        logger.error(f"Error obteniendo detalle de alarma {id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/documentos')
def listar_documentos():
    """Listar documentos disponibles de alarmas"""
    try:
        cargar_documentos_alarmas()
        
        documentos_info = []
        for nombre_doc, info in docs_cache.items():
            documentos_info.append({
                'nombre': nombre_doc,
                'ruta': info['ruta'],
                'fecha_carga': info['fecha_carga'].strftime('%Y-%m-%d %H:%M:%S'),
                'tamaño_contenido': len(info['contenido'])
            })
        
        return jsonify({
            'documentos': documentos_info,
            'total': len(documentos_info)
        })
    except Exception as e:
        logger.error(f"Error listando documentos: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/buscar_documentos')
def buscar_documentos_api():
    """Buscar en documentos de alarmas"""
    try:
        termino = request.args.get('termino', '')
        if not termino or len(termino.strip()) < 2:
            return jsonify({'error': 'Término de búsqueda debe tener al menos 2 caracteres'}), 400
        
        resultados = buscar_en_documentos(termino)
        
        return jsonify({
            'termino': termino,
            'resultados': resultados,
            'total_documentos': len(resultados)
        })
    except Exception as e:
        logger.error(f"Error buscando en documentos: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/descargar_documento/<nombre_documento>')
def descargar_documento(nombre_documento):
    """Descargar documento específico"""
    try:
        if nombre_documento not in app.config['DOCS_ALARMAS']:
            return jsonify({'error': 'Documento no autorizado'}), 403
        
        ruta_archivo = os.path.join(app.config['CARPETA_DOCS_ALARMAS'], nombre_documento)
        
        if not os.path.exists(ruta_archivo):
            return jsonify({'error': 'Documento no encontrado'}), 404
        
        return send_file(ruta_archivo, as_attachment=True)
    except Exception as e:
        logger.error(f"Error descargando documento {nombre_documento}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/estadisticas')
def estadisticas_api():
    try:
        return jsonify(obtener_estadisticas_alarmas())
    except Exception as e:
        logger.error(f"Error obteniendo estadísticas: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/recargar')
def recargar_datos():
    try:
        # Recargar alarmas
        global alarmas_cache
        alarmas_cache = None
        alarmas = cargar_alarmas(force=True)
        
        # Recargar documentos
        global docs_cache
        docs_cache = {}
        cargar_documentos_alarmas()
        
        return jsonify({
            'mensaje': 'Datos recargados exitosamente',
            'alarmas_cargadas': len(alarmas),
            'documentos_cargados': len(docs_cache)
        })
    except Exception as e:
        logger.error(f"Error recargando datos: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Configuración
    crear_archivos_iniciales()
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('FLASK_ENV') == 'development'
    
    logger.info(f"Iniciando aplicación en puerto {port}")
    logger.info(f"Modo debug: {debug_mode}")
    
    # Cargar datos iniciales
    alarmas_iniciales = cargar_alarmas()
    logger.info(f"Cargadas {len(alarmas_iniciales)} alarmas del catálogo")
    
    cargar_documentos_alarmas()
    logger.info(f"Cargados {len(docs_cache)} documentos de alarmas")
        
    app.run(host='0.0.0.0', port=port, debug=debug_mode)