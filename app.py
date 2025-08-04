from flask import Flask, render_template, request, jsonify, send_from_directory
import pandas as pd
import logging
import os
import re
from pathlib import Path
from werkzeug.middleware.proxy_fix import ProxyFix

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Inicialización de variables globales
df_alarmas = None
UPLOAD_FOLDER = Path('static/instructivos')

def create_app():
    """Factory pattern para crear la aplicación Flask"""
    app = Flask(__name__)
    app.wsgi_app = ProxyFix(app.wsgi_app)
    
    # Crear directorio de instructivos si no existe
    UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
    
    # Cargar CSV al iniciar
    global df_alarmas
    df_alarmas = load_csv()
    
    return app

def normalize_column_name(name):
    """Normaliza nombres de columnas eliminando caracteres especiales"""
    if not isinstance(name, str):
        return str(name)
    # Limpia espacios, comillas y saltos de línea
    clean_name = re.sub(r'[\n\r\t"]', ' ', name)
    clean_name = re.sub(r'\s+', ' ', clean_name)
    return clean_name.strip()

def find_matching_column(columns, variants):
    """Busca una columna que coincida con las variantes especificadas"""
    normalized_columns = {normalize_column_name(col): col for col in columns}
    
    for variant in variants:
        normalized_variant = normalize_column_name(variant)
        if normalized_variant in normalized_columns:
            return normalized_columns[normalized_variant]
            
    return None

def load_csv():
    """Carga el CSV con manejo robusto de errores"""
    try:
        csv_path = Path('CatalogoAlarmas.csv')
        if not csv_path.exists():
            logger.error(f"❌ Archivo no encontrado: {csv_path}")
            return None

        logger.info("📊 Iniciando carga del CSV...")
        
        # Leer CSV en chunks para optimizar memoria
        chunks = []
        for chunk in pd.read_csv(
            csv_path,
            encoding='utf-8',
            sep=';',
            dtype=str,
            chunksize=1000
        ):
            # Normalizar nombres de columnas
            chunk.columns = [normalize_column_name(col) for col in chunk.columns]
            chunks.append(chunk)
        
        df = pd.concat(chunks, ignore_index=True)
        
        # Verificar columna de instructivo
        km_variants = [
            'KM (TITULO DEL INSTRUCTIVO)',
            'KM(TITULO DEL INSTRUCTIVO)',
            'KM TITULO DEL INSTRUCTIVO',
            'INSTRUCTIVO',
            'KM'
        ]
        
        km_col = None
        for variant in km_variants:
            normalized = variant.strip().replace('\n', ' ').replace('"', '')
            matching_cols = [col for col in df.columns 
                           if normalized.lower() in col.lower()]
            if matching_cols:
                km_col = matching_cols[0]
                break
        
        if not km_col:
            logger.warning("⚠️ Columna de instructivo no encontrada. Usando valor por defecto.")
            df['KM (TITULO DEL INSTRUCTIVO)'] = 'NO_DISPONIBLE'
        else:
            df['KM (TITULO DEL INSTRUCTIVO)'] = df[km_col]
            
        # Limpiar datos
        df = df.fillna('NO_DISPONIBLE')
        
        logger.info(f"✅ CSV cargado exitosamente - {len(df)} filas")
        logger.info(f"📋 Columnas: {', '.join(df.columns)}")
        
        return df
        
    except Exception as e:
        logger.error(f"❌ Error cargando CSV: {str(e)}", exc_info=True)
        return None

# Crear app
app = create_app()

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/buscar_alarma', methods=['GET', 'POST'])
def buscar_alarma():
    if request.method == 'POST':
        numero = request.form.get('numero', '').strip()
        elemento = request.form.get('elemento', '').strip()
        
        if df_alarmas is None:
            return jsonify({
                'error': 'Base de datos no disponible'
            }), 500
            
        try:
            # Búsqueda insensible a mayúsculas/minúsculas
            mask = (
                df_alarmas['TEXTO 1 DE LA ALARMA'].str.contains(numero, 
                    case=False, na=False) &
                df_alarmas['FABRICANTE'].str.contains(elemento, 
                    case=False, na=False)
            )
            
            resultados = df_alarmas[mask]
            
            if len(resultados) > 0:
                alarma = resultados.iloc[0]
                response = {
                    'encontrada': True,
                    'datos': {
                        'fabricante': alarma['FABRICANTE'],
                        'servicio': alarma['SERVICIO Y/O SISTEMA GESTIONADO'],
                        'descripcion': alarma['TEXTO 1 DE LA ALARMA'],
                        'severidad': alarma['SEVERIDAD'],
                        'instructivo': None
                    }
                }
                
                # Verificar PDF
                if alarma['KM (TITULO DEL INSTRUCTIVO)'] != 'NO_DISPONIBLE':
                    pdf_name = f"{alarma['KM (TITULO DEL INSTRUCTIVO)']}.pdf"
                    pdf_path = UPLOAD_FOLDER / pdf_name
                    if pdf_path.exists():
                        response['datos']['instructivo'] = pdf_name
                
                return jsonify(response)
            
            return jsonify({
                'encontrada': False,
                'mensaje': f'No se encontró la alarma: {numero} - {elemento}'
            })
            
        except Exception as e:
            logger.error(f"Error en búsqueda: {str(e)}", exc_info=True)
            return jsonify({
                'error': 'Error procesando la búsqueda'
            }), 500
    
    return render_template('buscar_alarma.html')

@app.route('/static/instructivos/<path:filename>')
def serve_pdf(filename):
    """Sirve archivos PDF de forma segura"""
    try:
        return send_from_directory(UPLOAD_FOLDER, filename)
    except Exception as e:
        logger.error(f"Error sirviendo PDF {filename}: {str(e)}")
        return "PDF no encontrado", 404

# Error handlers
@app.errorhandler(404)
def not_found_error(error):
    return jsonify({'error': 'Recurso no encontrado'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Error interno del servidor'}), 500

if __name__ == '__main__':
    # Puerto para desarrollo/producción
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port)