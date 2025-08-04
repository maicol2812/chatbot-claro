from flask import Flask, render_template, request, send_from_directory, jsonify
import pandas as pd
import os
import logging
import re
from pathlib import Path
from werkzeug.middleware.proxy_fix import ProxyFix

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)

# Configuración
UPLOAD_FOLDER = Path('static/instructivos')
CSV_PATH = Path('CatalogoAlarmas.csv')

# Mapeo de columnas esperadas
EXPECTED_COLUMNS = {
    'KM_TITULO': ['KM (TITULO DEL INSTRUCTIVO)', 'KM', 'TITULO_INSTRUCTIVO', 'INSTRUCTIVO'],
    'FABRICANTE': ['Fabricante', 'FABRICANTE', 'VENDOR'],
    'SERVICIO': ['SERVICIO Y/O SISTEMA GESTIONADO', 'SERVICIO', 'SISTEMA'],
    'TEXTO_ALARMA': ['TEXTO 1 DE LA ALARMA', 'TEXTO_ALARMA', 'DESCRIPCION'],
    'SEVERIDAD': ['SEVERIDAD', 'CRITICIDAD', 'SEVERITY']
}

# Variable global para el DataFrame
df_alarmas = None

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
    """Carga y valida el CSV con manejo robusto de errores"""
    try:
        csv_path = Path('CatalogoAlarmas.csv')
        if not csv_path.exists():
            logger.error(f"❌ Archivo no encontrado: {csv_path}")
            return None

        # Leer CSV en chunks para optimizar memoria
        chunks = []
        for chunk in pd.read_csv(csv_path, 
                               encoding='utf-8',
                               sep=';',
                               chunksize=1000,
                               dtype=str):
            # Normalizar nombres de columnas
            chunk.columns = [normalize_column_name(col) for col in chunk.columns]
            chunks.append(chunk)
        
        df = pd.concat(chunks, ignore_index=True)
        
        # Verificar columnas requeridas
        required_columns = [
            'Fabricante',
            'SERVICIO Y/O SISTEMA GESTIONADO',
            'TEXTO 1 DE LA ALARMA',
            'KM (TITULO DEL INSTRUCTIVO)'
        ]
        
        missing_cols = [col for col in required_columns 
                       if not any(normalize_column_name(col) == normalize_column_name(df_col) 
                                for df_col in df.columns)]
        
        if missing_cols:
            logger.warning(f"⚠️ Columnas faltantes: {missing_cols}")
            # Agregar columnas faltantes con valor por defecto
            for col in missing_cols:
                df[col] = "NO ESPECIFICADO"
        
        # Limpiar datos
        df = df.fillna("NO ESPECIFICADO")
        
        logger.info(f"✅ CSV cargado exitosamente - {len(df)} filas")
        logger.info(f"📊 Columnas encontradas: {df.columns.tolist()}")
        
        return df
        
    except Exception as e:
        logger.error(f"❌ Error cargando CSV: {str(e)}", exc_info=True)
        return None

@app.before_serving
def init_app():
    """Inicializa la aplicación y carga el CSV"""
    global df_alarmas
    
    logger.info("🚀 Iniciando aplicación...")
    
    # Crear directorio de instructivos
    UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
    logger.info(f"📁 Directorio de instructivos creado: {UPLOAD_FOLDER}")
    
    # Cargar CSV
    df_alarmas = load_csv()
    if df_alarmas is None:
        logger.error("❌ Error crítico: No se pudo cargar el catálogo de alarmas")
    else:
        logger.info("✅ Aplicación iniciada correctamente")

# Rutas
@app.route('/')
def home():
    return render_template('home.html')

@app.route('/buscar_alarma', methods=['GET', 'POST'])
def buscar_alarma():
    if request.method == 'POST':
        numero = request.form.get('numero', '').strip()
        elemento = request.form.get('elemento', '').strip()
        
        if df_alarmas is None:
            return render_template('resultados.html', 
                                error="Error del sistema: Base de datos no disponible")
        
        try:
            # Búsqueda flexible
            mask = (
                df_alarmas['NUMERO_ALARMA'].astype(str).str.contains(numero, case=False, na=False) &
                df_alarmas['ELEMENTO'].astype(str).str.contains(elemento, case=False, na=False)
            )
            resultados = df_alarmas[mask]
            
            if len(resultados) > 0:
                alarma = resultados.iloc[0]
                
                # Verificar PDF
                pdf_name = None
                if alarma['INSTRUCTIVO'] != "NO_ESPECIFICADO":
                    pdf_name = f"{alarma['INSTRUCTIVO']}.pdf"
                    pdf_path = UPLOAD_FOLDER / pdf_name
                    if not pdf_path.exists():
                        logger.warning(f"PDF no encontrado: {pdf_path}")
                        pdf_name = None
                
                return render_template('resultados.html',
                                    alarma=alarma,
                                    pdf_path=pdf_name)
            
        except Exception as e:
            logger.error(f"Error en búsqueda: {str(e)}", exc_info=True)
            return render_template('resultados.html',
                                error="Error procesando la búsqueda")
        
        return render_template('resultados.html',
                            error=f"No se encontró la alarma: {numero} - {elemento}")
    
    return render_template('buscar_alarma.html')

@app.route('/static/instructivos/<path:filename>')
def serve_pdf(filename):
    """Sirve archivos PDF de forma segura"""
    try:
        return send_from_directory(UPLOAD_FOLDER, filename)
    except Exception as e:
        logger.error(f"Error sirviendo PDF {filename}: {str(e)}")
        return "PDF no encontrado", 404

@app.route('/api/buscar_alarma', methods=['POST'])
def api_buscar_alarma():
    """API para búsqueda de alarmas"""
    if df_alarmas is None:
        return jsonify({'error': 'Catálogo no disponible'}), 500
        
    data = request.get_json()
    numero = data.get('numero', '').strip()
    elemento = data.get('elemento', '').strip()
    
    try:
        # Búsqueda insensible a mayúsculas/minúsculas
        mask = (
            df_alarmas['TEXTO_ALARMA'].str.contains(numero, case=False, na=False) &
            df_alarmas['FABRICANTE'].str.contains(elemento, case=False, na=False)
        )
        
        resultados = df_alarmas[mask]
        
        if len(resultados) > 0:
            alarma = resultados.iloc[0].to_dict()
            
            # Verificar PDF del instructivo
            if alarma['KM_TITULO'] != "NO ESPECIFICADO":
                pdf_path = UPLOAD_FOLDER / f"{alarma['KM_TITULO']}.pdf"
                if pdf_path.exists():
                    alarma['pdf_url'] = f"/static/instructivos/{alarma['KM_TITULO']}.pdf"
            
            return jsonify({'encontrada': True, 'alarma': alarma})
            
        return jsonify({'encontrada': False, 'mensaje': 'Alarma no encontrada'})
        
    except Exception as e:
        logger.error(f"Error en búsqueda: {str(e)}", exc_info=True)
        return jsonify({'error': 'Error procesando la búsqueda'}), 500

if __name__ == '__main__':
    # Puerto dinámico para Render
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port)