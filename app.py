from flask import Flask, render_template, jsonify, request, session, send_file, redirect, url_for
import pandas as pd
import os
from datetime import datetime
import logging
import re
from werkzeug.utils import secure_filename
from flask_cors import CORS
import PyPDF2
import docx
from pathlib import Path
import uuid

app = Flask(__name__, 
    static_url_path='/static',
    template_folder='templates',
    static_folder='static'
)
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

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('alarmas.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def cargar_alarmas_desde_excel():
    try:
        # Verificar si el archivo existe
        if not os.path.exists(CONFIG['EXCEL_ALARMAS']):
            logger.error(f"Archivo Excel no encontrado: {CONFIG['EXCEL_ALARMAS']}")
            return {}

        # Leer el archivo Excel
        df = pd.read_excel(CONFIG['EXCEL_ALARMAS'])
        logger.info(f"Excel cargado. Columnas encontradas: {list(df.columns)}")
        
        # Verificar columnas mínimas requeridas
        required_cols = ['Fabricante', 'SERVICIO Y/O SISTEMA GESTIONADO', 'GESTOR']
        for col in required_cols:
            if col not in df.columns:
                logger.error(f"Columna requerida faltante: {col}")
                return {}

        alarmas = {}
        
        for index, row in df.iterrows():
            try:
                alarma_id = str(uuid.uuid4())[:8]
                
                # Obtener valores con manejo de errores
                def get_value(col_name, default=""):
                    try:
                        val = str(row[col_name]) if col_name in df.columns and pd.notna(row[col_name]) else default
                        return val.strip()
                    except:
                        return default
                
                # Construir descripción
                desc_parts = [
                    get_value('TEXTO 1 DE LA ALARMA'),
                    get_value('TEXTO 2 DE LA ALARMA'),
                    get_value('TEXTO 3 DE LA ALARMA'),
                    get_value('TEXTO 4 DE LA ALARMA')
                ]
                descripcion = " | ".join(filter(None, desc_parts)) or "Sin descripción"
                
                alarmas[alarma_id] = {
                    "id": alarma_id,
                    "fabricante": get_value('Fabricante'),
                    "servicio": get_value('SERVICIO Y/O SISTEMA GESTIONADO'),
                    "gestor": get_value('GESTOR'),
                    "descripcion": descripcion,
                    "tipo": get_value('BAJA / ALTA / BLOQUEO'),
                    "dominio": get_value('DOMINIO'),
                    "severidad": get_value('SEVERIDAD'),
                    "instructivo": get_value('KM (TITULO DEL INSTRUCTIVO)'),
                    "tier_1": get_value('TIER 1'),
                    "tier_2": get_value('TIER 2'),
                    "tier_3": get_value('TIER 3'),
                    "tipo_alarma": get_value('TIPO DE ALARMA'),
                    "grupo_atencion": get_value('GRUPO DE ATENCIÓN'),
                    "criticidad": get_value('CRITICIDAD'),
                    "dueño": get_value('DUEÑO DE PLATAFORMA'),
                    "panel": get_value('PANEL NETCOOL'),
                    "documentos": CONFIG['DOCS_ALARMAS'],
                    "contacto": f"{get_value('GRUPO DE ATENCIÓN', 'soporte')}@empresa.com"
                }
                
            except Exception as row_error:
                logger.error(f"Error procesando fila {index+2}: {str(row_error)}")
                continue
        
        logger.info(f"Se cargaron {len(alarmas)} alarmas correctamente")
        return alarmas
        
    except Exception as e:
        logger.error(f"Error crítico al cargar Excel: {str(e)}", exc_info=True)
        return {}

# Cargar alarmas al iniciar
alarmas_db = cargar_alarmas_desde_excel()

# Helpers
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in CONFIG['ALLOWED_EXTENSIONS']

def secure_path(path):
    return os.path.abspath(os.path.join(os.getcwd(), path))

def extract_text(filepath):
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
        logger.error(f"Error extrayendo texto: {str(e)}")
        return ""

def get_severity_color(severidad):
    colors = {
        'CRITICA': '#d32f2f',
        'ALTA': '#f57c00',
        'MEDIA': '#fbc02d',
        'BAJA': '#7cb342',
        'INFORMATIVA': '#4285F4'
    }
    return colors.get(severidad.upper(), '#757575')

# Rutas
@app.route('/')
def home():
    return redirect(url_for('inicio'))

@app.route('/health')
def health_check():
    return jsonify({
        "status": "healthy" if alarmas_db else "warning",
        "alarmas_cargadas": len(alarmas_db),
        "timestamp": datetime.now().isoformat(),
        "service": "asesor-claro-ia",
        "version": "1.0.0"
    }), 200

@app.route('/inicio', methods=['GET', 'POST'])
def inicio():
    return render_template('index.html', 
                         alarmas_totales=len(alarmas_db),
                         alarmas_criticas=len([a for a in alarmas_db.values() if a['severidad'].upper() == 'CRITICA']))

@app.route('/consultar_alarma', methods=['GET', 'POST'])
def consultar_alarma():
    if request.method == 'POST':
        numero_alarma = request.form.get('numero_alarma', '').strip()
        if not numero_alarma:
            return render_template('error.html', mensaje="Debes ingresar un número de alarma")
        
        if numero_alarma not in alarmas_db:
            return render_template('error.html', 
                                 mensaje=f"Alarma {numero_alarma} no encontrada",
                                 subtitulo="Verifica el número e intenta nuevamente")
        
        session['numero_alarma'] = numero_alarma
        return redirect(url_for('verificar_elemento'))
    
    return render_template('consultar_alarma.html')

@app.route('/verificar_elemento', methods=['GET', 'POST'])
def verificar_elemento():
    numero_alarma = session.get('numero_alarma')
    if not numero_alarma or numero_alarma not in alarmas_db:
        return redirect(url_for('consultar_alarma'))
    
    if request.method == 'POST':
        elemento = request.form.get('elemento', '').strip()
        if not elemento:
            return render_template('error.html', mensaje="Debes ingresar un elemento")
        
        session['elemento'] = elemento
        return redirect(url_for('mostrar_alarma'))
    
    return render_template('verificar_elemento.html', numero_alarma=numero_alarma)

@app.route('/mostrar_alarma')
def mostrar_alarma():
    numero_alarma = session.get('numero_alarma')
    elemento = session.get('elemento')
    
    if not numero_alarma or numero_alarma not in alarmas_db:
        return redirect(url_for('consultar_alarma'))
    
    alarma = alarmas_db[numero_alarma]
    return render_template('mostrar_alarma.html', 
                         alarma=alarma,
                         elemento=elemento,
                         get_severity_color=get_severity_color)

@app.route('/descargar/<nombre_documento>')
def descargar_documento(nombre_documento):
    if not re.match(r'^[\w\s\-\.]+$', nombre_documento) or nombre_documento not in CONFIG['DOCS_ALARMAS']:
        return 'Documento no autorizado', 403
    
    safe_path = secure_path(os.path.join(CONFIG['CARPETA_DOCS_ALARMAS'], nombre_documento))
    if not os.path.exists(safe_path):
        return 'Documento no encontrado', 404
    
    return send_file(safe_path, as_attachment=True)

@app.route('/previsualizar/<nombre_documento>')
def previsualizar_documento(nombre_documento):
    if not re.match(r'^[\w\s\-\.]+$', nombre_documento) or nombre_documento not in CONFIG['DOCS_ALARMAS']:
        return 'Documento no autorizado', 403
    
    safe_path = secure_path(os.path.join(CONFIG['CARPETA_DOCS_ALARMAS'], nombre_documento))
    if not os.path.exists(safe_path):
        return 'Documento no encontrado', 404
    
    text = extract_text(safe_path)
    if not text:
        text = "No se pudo extraer texto para previsualización."
    
    return render_template('previsualizar.html', 
                         nombre_documento=nombre_documento,
                         texto=text[:5000])

@app.route('/api/alarmas', methods=['GET'])
def get_alarmas():
    query = request.args.get('query', '').upper()
    if query:
        resultados = {
            id: alarma for id, alarma in alarmas_db.items() 
            if query in alarma['fabricante'].upper() or 
               query in alarma['servicio'].upper() or 
               query in alarma['descripcion'].upper()
        }
        return jsonify(resultados)
    return jsonify(alarmas_db)

@app.route('/api/alarmas/<alarma_id>')
def get_alarma(alarma_id):
    if alarma_id in alarmas_db:
        return jsonify(alarmas_db[alarma_id])
    return jsonify({'error': 'Alarma no encontrada'}), 404

def create_app():
    os.makedirs(CONFIG['CARPETA_DOCS_ALARMAS'], exist_ok=True)
    for doc in CONFIG['DOCS_ALARMAS']:
        doc_path = os.path.join(CONFIG['CARPETA_DOCS_ALARMAS'], doc)
        if not os.path.exists(doc_path):
            logger.warning(f"Documento faltante: {doc_path}")
    
    if not os.path.exists(CONFIG['EXCEL_ALARMAS']):
        logger.error(f"Archivo Excel no encontrado: {CONFIG['EXCEL_ALARMAS']}")
    else:
        try:
            df = pd.read_excel(CONFIG['EXCEL_ALARMAS'])
            logger.info(f"Columnas en Excel: {df.columns.tolist()}")
        except Exception as e:
            logger.error(f"Error leyendo Excel: {str(e)}")
    
    return app

if __name__ == '__main__':
    app = create_app()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)