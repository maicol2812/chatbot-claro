from flask import Flask, render_template, jsonify, request, session, send_file, redirect, url_for
import pandas as pd
import os
from datetime import datetime, timedelta
import logging
import re
from werkzeug.utils import secure_filename
from flask_cors import CORS
import PyPDF2
import docx
from pathlib import Path
import uuid

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'default_secret_key_development_only')
CORS(app)

# Configuración mejorada
CONFIG = {
    'EXCEL_ALARMAS': 'CatalogoAlarmas.xlsx',
    'CARPETA_DOCS_ALARMAS': 'documentos_alarmas',
    'DOCS_ALARMAS': ['Alarmas vSR.pdf', 'vDSR Alarms and KPIs.pdf'],
    'ALLOWED_EXTENSIONS': {'pdf', 'docx'},
    'TIPOS_SEVERIDAD': ['CRITICA', 'ALTA', 'MEDIA', 'BAJA', 'INFORMATIVA'],
    'MAX_ALARMAS': 50,
    'EXCEL_COLUMNAS': {
        'FABRICANTE': 'Fabricante',
        'SERVICIO': 'SERVICIO Y/O SISTEMA GESTIONADO',
        'GESTOR': 'GESTOR',
        'TEXTO_1': 'TEXTO 1 DE LA ALARMA',
        'TEXTO_2': 'TEXTO 2 DE LA ALARMA', 
        'TEXTO_3': 'TEXTO 3 DE LA ALARMA',
        'TEXTO_4': 'TEXTO 4 DE LA ALARMA',
        'TIPO': 'BAJA / ALTA / BLOQUEO',
        'DOMINIO': 'DOMINIO',
        'SEVERIDAD': 'SEVERIDAD',
        'INSTRUCTIVO': 'KM (TITULO DEL INSTRUCTIVO)',
        'TIER_1': 'TIER 1',
        'TIER_2': 'TIER 2',
        'TIER_3': 'TIER 3',
        'TIPO_ALARMA': 'TIPO DE ALARMA',
        'GRUPO_ATENCION': 'GRUPO DE ATENCIÓN',
        'CRITICIDAD': 'CRITICIDAD',
        'DUEÑO': 'DUEÑO DE PLATAFORMA',
        'PANEL': 'PANEL NETCOOL'
    }
}

# Configuración de logging mejorada
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('alarmas.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Función mejorada para cargar alarmas desde Excel
def cargar_alarmas_desde_excel():
    try:
        # Verificar si el archivo existe
        if not os.path.exists(CONFIG['EXCEL_ALARMAS']):
            logger.error(f"Archivo Excel no encontrado: {CONFIG['EXCEL_ALARMAS']}")
            return {}

        # Leer el archivo Excel
        df = pd.read_excel(CONFIG['EXCEL_ALARMAS'])
        logger.info(f"Excel cargado correctamente. Columnas disponibles: {df.columns.tolist()}")
        
        # Mapeo flexible de columnas
        column_mapping = {}
        missing_columns = []
        
        for config_col, expected_name in CONFIG['EXCEL_COLUMNAS'].items():
            # Buscar coincidencia insensible a mayúsculas y espacios
            matched_col = next((col for col in df.columns 
                             if str(col).strip().upper() == str(expected_name).strip().upper()), None)
            
            if matched_col:
                column_mapping[config_col] = matched_col
            else:
                logger.warning(f"Columna no encontrada: '{expected_name}'")
                missing_columns.append(expected_name)
                column_mapping[config_col] = expected_name  # Usar el nombre esperado para generar el error

        if missing_columns:
            logger.warning(f"Columnas faltantes en el Excel: {missing_columns}")

        alarmas = {}
        
        for index, row in df.iterrows():
            try:
                alarma_id = str(uuid.uuid4())[:8]
                
                # Construir descripción solo con textos existentes
                descripcion_parts = []
                for text_part in ['TEXTO_1', 'TEXTO_2', 'TEXTO_3', 'TEXTO_4']:
                    if column_mapping[text_part] in df.columns:
                        text_value = str(row[column_mapping[text_part]])
                        if text_value and text_value != 'nan':
                            descripcion_parts.append(text_value)
                
                # Crear diccionario de alarma con manejo de errores para cada campo
                alarma_data = {
                    "id": alarma_id,
                    "fabricante": safe_get(row, column_mapping['FABRICANTE']),
                    "servicio": safe_get(row, column_mapping['SERVICIO']),
                    "gestor": safe_get(row, column_mapping['GESTOR']),
                    "descripcion": " | ".join(descripcion_parts) if descripcion_parts else "Sin descripción",
                    "tipo": safe_get(row, column_mapping['TIPO']),
                    "dominio": safe_get(row, column_mapping['DOMINIO']),
                    "severidad": safe_get(row, column_mapping['SEVERIDAD']),
                    "instructivo": safe_get(row, column_mapping['INSTRUCTIVO']),
                    "tier_1": safe_get(row, column_mapping['TIER_1']),
                    "tier_2": safe_get(row, column_mapping['TIER_2']),
                    "tier_3": safe_get(row, column_mapping['TIER_3']),
                    "tipo_alarma": safe_get(row, column_mapping['TIPO_ALARMA']),
                    "grupo_atencion": safe_get(row, column_mapping['GRUPO_ATENCION']),
                    "criticidad": safe_get(row, column_mapping['CRITICIDAD']),
                    "dueño": safe_get(row, column_mapping['DUEÑO']),
                    "panel": safe_get(row, column_mapping['PANEL']),
                    "documentos": CONFIG['DOCS_ALARMAS'],
                    "contacto": f"{safe_get(row, column_mapping['GRUPO_ATENCION'], 'soporte')}@empresa.com"
                }
                
                alarmas[alarma_id] = alarma_data
                
            except Exception as row_error:
                logger.error(f"Error procesando fila {index}: {str(row_error)}")
                continue
        
        logger.info(f"Se cargaron {len(alarmas)} alarmas correctamente")
        return alarmas
        
    except Exception as e:
        logger.error(f"Error crítico cargando alarmas desde Excel: {str(e)}", exc_info=True)
        return {}

def safe_get(row, column_name, default="No especificado"):
    """Obtiene un valor de una fila de manera segura"""
    try:
        if column_name in row and pd.notna(row[column_name]):
            return str(row[column_name])
        return default
    except Exception as e:
        logger.warning(f"Error obteniendo columna {column_name}: {str(e)}")
        return default

# Base de datos de alarmas cargada desde Excel
alarmas_db = cargar_alarmas_desde_excel()

# Helpers
def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in CONFIG['ALLOWED_EXTENSIONS']

def secure_path(path):
    """Prevenir ataques de directory traversal"""
    return os.path.abspath(os.path.join(os.getcwd(), path))

def extract_text(filepath):
    """Extraer texto de PDF o DOCX"""
    ext = os.path.splitext(filepath)[1].lower()
    try:
        if ext == '.pdf':
            with open(filepath, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                return '\n'.join([page.extract_text() for page in reader.pages])
        elif ext == '.docx':
            doc = docx.Document(filepath)
            return '\n'.join([para.text for para in doc.paragraphs])
        return ""
    except Exception as e:
        logger.error(f"Error extrayendo texto de {filepath}: {str(e)}")
        return ""

def log_interaction(action, details):
    """Registrar interacciones importantes"""
    logger.info(f"User Interaction - Action: {action}, Details: {details}")

def get_severity_color(severidad):
    """Devuelve el color correspondiente a la severidad"""
    colors = {
        'CRITICA': '#d32f2f',
        'ALTA': '#f57c00',
        'MEDIA': '#fbc02d',
        'BAJA': '#7cb342',
        'INFORMATIVA': '#4285F4'
    }
    return colors.get(severidad.upper(), '#757575')

# Rutas principales
@app.route('/')
def home():
    return redirect(url_for('inicio'))

@app.route('/health')
def health_check():
    """Endpoint para verificación de salud"""
    return jsonify({
        "status": "healthy" if alarmas_db else "warning",
        "alarmas_cargadas": len(alarmas_db),
        "timestamp": datetime.now().isoformat(),
        "service": "asesor-claro-ia",
        "version": "1.0.0"
    }), 200

@app.route('/inicio', methods=['GET', 'POST'])
def inicio():
    if request.method == 'POST':
        opcion = request.form.get('opcion')
        
        if opcion == '1':
            log_interaction('menu_selection', 'opcion_1')
            return redirect(url_for('consultar_alarma'))
        
        elif opcion == '2':
            log_interaction('menu_selection', 'opcion_2')
            return '''
            <h3>Documentación disponible:</h3>
            <div style="margin: 20px;">
                <a href="/descargar/Alarmas vSR.pdf" class="doc-button">PDF - Alarmas vSR</a>
                <a href="/descargar/vDSR Alarms and KPIs.pdf" class="doc-button">PDF - vDSR Alarms</a>
            </div>
            <a href="/inicio" class="back-button">Volver al inicio</a>
            
            <style>
                .doc-button {
                    display: inline-block;
                    padding: 12px 20px;
                    margin: 10px;
                    background-color: #4285F4;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    font-weight: bold;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                    transition: all 0.3s;
                }
                .doc-button:hover {
                    background-color: #3367D6;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                }
                .back-button {
                    display: inline-block;
                    padding: 10px 15px;
                    background-color: #f44336;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    margin-top: 20px;
                }
            </style>
            '''
    
    return '''
    <div style="max-width: 800px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <h2 style="color: #333; border-bottom: 2px solid #4285F4; padding-bottom: 10px;">
            Buen día, hablemos de nuestras plataformas de Core
        </h2>
        
        <h3 style="color: #555;">¿Qué te gustaría consultar el día de hoy?</h3>
        
        <form method="post" style="margin-top: 30px;">
            <button type="submit" name="opcion" value="1" class="menu-button">
                1. Alarmas de plataformas
            </button><br>
            
            <button type="submit" name="opcion" value="2" class="menu-button">
                2. Documentación de las plataformas
            </button><br>
            
            <button type="submit" name="opcion" value="3" class="menu-button">
                3. Incidentes activos de las plataformas
            </button><br>
            
            <button type="submit" name="opcion" value="4" class="menu-button">
                4. Estado operativo de las plataformas
            </button><br>
            
            <button type="submit" name="opcion" value="5" class="menu-button">
                5. Cambios activos en las plataformas
            </button><br>
            
            <button type="submit" name="opcion" value="6" class="menu-button">
                6. Hablar con el administrador de la plataforma
            </button>
        </form>
        
        <style>
            .menu-button {
                width: 100%;
                padding: 15px;
                margin: 8px 0;
                background-color: #f8f9fa;
                border: 1px solid #dadce0;
                border-radius: 4px;
                color: #202124;
                font-size: 16px;
                cursor: pointer;
                text-align: left;
                transition: all 0.3s;
            }
            .menu-button:hover {
                background-color: #e8f0fe;
                border-color: #d2e3fc;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
        </style>
    </div>
    '''

@app.route('/consultar_alarma', methods=['GET', 'POST'])
def consultar_alarma():
    if request.method == 'POST':
        numero_alarma = request.form.get('numero_alarma', '').strip()
        session['numero_alarma'] = numero_alarma
        
        if not numero_alarma:
            return '''
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h3 style="color: #d32f2f;">Error: Debes ingresar un número de alarma</h3>
                <a href="/consultar_alarma" class="back-button">Volver a intentar</a>
            </div>
            '''
        
        if numero_alarma not in alarmas_db:
            log_interaction('alarma_no_encontrada', numero_alarma)
            return f'''
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h3>Alarma {numero_alarma} no encontrada en el catálogo</h3>
                <p>Por favor verifica el número e intenta nuevamente.</p>
                <a href="/consultar_alarma" class="back-button">Volver a intentar</a>
                <a href="/inicio" class="back-button" style="background-color: #757575;">Volver al inicio</a>
            </div>
            '''
        
        log_interaction('alarma_encontrada', numero_alarma)
        return redirect(url_for('verificar_elemento'))
    
    return '''
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h3 style="color: #333;">Por favor ingrese el número de alarma que desea consultar:</h3>
        
        <form action="/consultar_alarma" method="post" style="margin-top: 20px;">
            <input type="text" name="numero_alarma" required 
                   style="width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 4px;">
            
            <button type="submit" style="padding: 10px 20px; background-color: #4285F4; color: white; 
                    border: none; border-radius: 4px; cursor: pointer;">
                Continuar
            </button>
            
            <a href="/inicio" style="padding: 10px 20px; background-color: #757575; color: white; 
               text-decoration: none; border-radius: 4px; margin-left: 10px;">
                Cancelar
            </a>
        </form>
    </div>
    '''

@app.route('/verificar_elemento', methods=['GET', 'POST'])
def verificar_elemento():
    numero_alarma = session.get('numero_alarma')
    
    if not numero_alarma or numero_alarma not in alarmas_db:
        return redirect(url_for('consultar_alarma'))
    
    if request.method == 'POST':
        elemento = request.form.get('elemento', '').strip()
        session['elemento'] = elemento
        
        if not elemento:
            return '''
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h3 style="color: #d32f2f;">Error: Debes ingresar un elemento</h3>
                <a href="/verificar_elemento" class="back-button">Volver a intentar</a>
            </div>
            '''
        
        log_interaction('elemento_verificado', {'alarma': numero_alarma, 'elemento': elemento})
        return redirect(url_for('mostrar_alarma'))
    
    return f'''
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h3 style="color: #333;">Por favor ingresa el nombre del elemento que reporta la alarma {numero_alarma}:</h3>
        
        <form action="/verificar_elemento" method="post" style="margin-top: 20px;">
            <input type="text" name="elemento" required 
                   style="width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 4px;">
            
            <button type="submit" style="padding: 10px 20px; background-color: #4285F4; color: white; 
                    border: none; border-radius: 4px; cursor: pointer;">
                Buscar
            </button>
            
            <a href="/consultar_alarma" style="padding: 10px 20px; background-color: #757575; color: white; 
               text-decoration: none; border-radius: 4px; margin-left: 10px;">
                Volver
            </a>
        </form>
    </div>
    '''

@app.route('/mostrar_alarma', methods=['GET'])
def mostrar_alarma():
    numero_alarma = session.get('numero_alarma')
    elemento = session.get('elemento')
    
    if not numero_alarma or numero_alarma not in alarmas_db:
        return redirect(url_for('consultar_alarma'))
    
    alarma = alarmas_db[numero_alarma]
    
    documentos_html = ""
    for doc in alarma.get('documentos', []):
        if doc in CONFIG['DOCS_ALARMAS']:
            file_type = doc.split('.')[-1].upper()
            documentos_html += f'''
            <div style="margin: 15px 0;">
                <a href="/descargar/{doc}" class="doc-button">
                    {file_type} - {doc}
                </a>
                <a href="/previsualizar/{doc}" class="preview-button" target="_blank">
                    Previsualizar
                </a>
            </div>
            '''
    
    return f'''
    <div style="max-width: 800px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <h2 style="color: #333; border-bottom: 2px solid #4285F4; padding-bottom: 10px;">
            Información de la Alarma {numero_alarma}
        </h2>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <p><strong>Elemento reportado:</strong> {elemento}</p>
            <p><strong>Fabricante:</strong> {alarma['fabricante']}</p>
            <p><strong>Servicio/Sistema:</strong> {alarma['servicio']}</p>
            <p><strong>Gestor:</strong> {alarma['gestor']}</p>
            <p><strong>Descripción:</strong> {alarma['descripcion']}</p>
            <p><strong>Tipo:</strong> {alarma['tipo']}</p>
            <p><strong>Dominio:</strong> {alarma['dominio']}</p>
            <p><strong>Severidad:</strong> 
                <span style="color: {get_severity_color(alarma['severidad'])}; font-weight: bold;">
                    {alarma['severidad']}
                </span>
            </p>
            <p><strong>Instructivo:</strong> {alarma['instructivo']}</p>
            <p><strong>Tier 1:</strong> {alarma['tier_1']}</p>
            <p><strong>Tier 2:</strong> {alarma['tier_2']}</p>
            <p><strong>Tier 3:</strong> {alarma['tier_3']}</p>
            <p><strong>Tipo de Alarma:</strong> {alarma['tipo_alarma']}</p>
            <p><strong>Grupo de Atención:</strong> {alarma['grupo_atencion']}</p>
            <p><strong>Criticidad:</strong> {alarma['criticidad']}</p>
            <p><strong>Dueño de Plataforma:</strong> {alarma['dueño']}</p>
            <p><strong>Panel Netcool:</strong> {alarma['panel']}</p>
            <p><strong>Contacto:</strong> {alarma['contacto']}</p>
        </div>
        
        <h3 style="color: #333; margin-top: 30px;">Documentación relacionada:</h3>
        {documentos_html}
        
        <div style="margin-top: 40px;">
            <a href="/consultar_alarma" class="action-button" style="background-color: #4285F4;">
                Consultar otra alarma
            </a>
            <a href="/inicio" class="action-button" style="background-color: #757575;">
                Volver al inicio
            </a>
        </div>
    </div>
    
    <style>
        .doc-button {{
            display: inline-block;
            padding: 10px 15px;
            background-color: #34a853;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            margin-right: 10px;
            transition: background-color 0.3s;
        }}
        .doc-button:hover {{
            background-color: #2d9249;
        }}
        .preview-button {{
            display: inline-block;
            padding: 10px 15px;
            background-color: #fbbc05;
            color: #202124;
            text-decoration: none;
            border-radius: 4px;
            transition: background-color 0.3s;
        }}
        .preview-button:hover {{
            background-color: #e8ac04;
        }}
        .action-button {{
            display: inline-block;
            padding: 12px 20px;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            margin-right: 10px;
            transition: all 0.3s;
        }}
        .action-button:hover {{
            opacity: 0.9;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }}
    </style>
    '''

@app.route('/descargar/<nombre_documento>')
def descargar_documento(nombre_documento):
    if not re.match(r'^[\w\s\-\.]+$', nombre_documento) or \
       nombre_documento not in CONFIG['DOCS_ALARMAS']:
        return 'Documento no autorizado', 403
    
    safe_path = secure_path(os.path.join(CONFIG['CARPETA_DOCS_ALARMAS'], nombre_documento))
    
    if not os.path.exists(safe_path):
        return 'Documento no encontrado', 404
    
    log_interaction('documento_descargado', nombre_documento)
    return send_file(safe_path, as_attachment=True)

@app.route('/previsualizar/<nombre_documento>')
def previsualizar_documento(nombre_documento):
    if not re.match(r'^[\w\s\-\.]+$', nombre_documento) or \
       nombre_documento not in CONFIG['DOCS_ALARMAS']:
        return 'Documento no autorizado', 403
    
    safe_path = secure_path(os.path.join(CONFIG['CARPETA_DOCS_ALARMAS'], nombre_documento))
    
    if not os.path.exists(safe_path):
        return 'Documento no encontrado', 404
    
    try:
        text = extract_text(safe_path)
        if not text:
            text = "No se pudo extraer texto para previsualización."
        
        log_interaction('documento_previsualizado', nombre_documento)
        return f'''
        <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
            <h3>Previsualización de {nombre_documento}</h3>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 20px;
                        max-height: 500px; overflow-y: auto; white-space: pre-wrap;">
                {text[:5000]}... [Contenido recortado]
            </div>
            <div style="margin-top: 20px;">
                <a href="/descargar/{nombre_documento}" class="doc-button">Descargar documento completo</a>
                <a href="/mostrar_alarma" class="back-button" style="margin-left: 10px;">Volver a la alarma</a>
            </div>
        </div>
        '''
    except Exception as e:
        logger.error(f"Error en previsualización: {str(e)}")
        return 'Error al generar la previsualización', 500

def create_app():
    # Crear carpeta de documentos si no existe
    os.makedirs(CONFIG['CARPETA_DOCS_ALARMAS'], exist_ok=True)
    
    # Verificar que los documentos existan
    for doc in CONFIG['DOCS_ALARMAS']:
        doc_path = os.path.join(CONFIG['CARPETA_DOCS_ALARMAS'], doc)
        if not os.path.exists(doc_path):
            logger.warning(f"Documento faltante: {doc_path}")
    
    # Verificar archivo Excel
    if not os.path.exists(CONFIG['EXCEL_ALARMAS']):
        logger.error(f"Archivo Excel no encontrado: {CONFIG['EXCEL_ALARMAS']}")
    else:
        try:
            df = pd.read_excel(CONFIG['EXCEL_ALARMAS'])
            logger.info(f"Columnas en el archivo Excel: {df.columns.tolist()}")
        except Exception as e:
            logger.error(f"Error leyendo archivo Excel: {str(e)}")
    
    return app

# Solo para desarrollo local
if __name__ == '__main__':
    app = create_app()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)