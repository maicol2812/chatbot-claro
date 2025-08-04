from flask import Flask, render_template, request, send_from_directory, jsonify
import pandas as pd
import os
import logging
from pathlib import Path
from functools import lru_cache
from werkzeug.middleware.proxy_fix import ProxyFix

# Configuración de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuración
class Config:
    UPLOAD_FOLDER = Path('static/instructivos')
    CSV_PATH = Path('CatalogoAlarmas.csv')
    REQUIRED_COLUMNS = {
        'KM (TITULO DEL INSTRUCTIVO)',
        'Fabricante',
        'TEXTO 1 DE LA ALARMA',
        'SEVERIDAD',
        'TIER 1',
        'TIER 2',
        'TIER 3'
    }

def get_df():
    """Obtiene el DataFrame de forma lazy"""
    if 'df' not in g:
        g.df = load_csv_cached()
    return g.df

# Cache para lectura lazy del CSV
@lru_cache(maxsize=1)
def load_csv_cached():
    """Carga el CSV solo cuando se necesita"""
    try:
        logger.info("📊 Iniciando carga lazy del CSV...")
        chunks = []
        for chunk in pd.read_csv(
            'CatalogoAlarmas.csv',
            encoding='utf-8',
            sep=';',
            dtype=str,
            chunksize=1000
        ):
            chunks.append(chunk)
        df = pd.concat(chunks, ignore_index=True)
        
        # Verificar columna crítica
        if 'KM (TITULO DEL INSTRUCTIVO)' not in df.columns:
            logger.warning("⚠️ Columna 'KM (TITULO DEL INSTRUCTIVO)' no encontrada")
            df['KM (TITULO DEL INSTRUCTIVO)'] = 'NO_DISPONIBLE'
            
        # Verificar otras columnas requeridas
        missing_cols = Config.REQUIRED_COLUMNS - set(df.columns)
        if missing_cols:
            logger.warning(f"⚠️ Columnas faltantes: {missing_cols}")
            for col in missing_cols:
                df[col] = 'NO_ESPECIFICADO'
        
        df = df.fillna('NO_ESPECIFICADO')
        
        logger.info(f"✅ CSV cargado: {len(df)} filas")
        return df
        
    except Exception as e:
        logger.error(f"❌ Error cargando CSV: {str(e)}")
        return None

def create_app():
    """Factory pattern para crear la app"""
    app = Flask(__name__, 
                static_folder='static',
                template_folder='templates')
    
    # Configuración para proxies
    app.wsgi_app = ProxyFix(app.wsgi_app)
    
    # Crear directorio de instructivos
    Config.UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
    
    return app

# Crear app usando factory pattern
app = create_app()

# Rutas
@app.route('/')
def home():
    """Página principal"""
    return render_template('index.html')

@app.route('/buscar_alarma', methods=['POST'])
def buscar_alarma():
    """Búsqueda de alarmas con carga lazy del CSV"""
    df = get_df()
    if df is None:
        return jsonify({'error': 'Base de datos no disponible'}), 500
        
    try:
        numero = request.form.get('numero', '').strip()
        elemento = request.form.get('elemento', '').strip()
        
        # Búsqueda case-insensitive
        mask = (
            df['TEXTO 1 DE LA ALARMA'].str.contains(numero, case=False, na=False) &
            df['Fabricante'].str.contains(elemento, case=False, na=False)
        )
        
        resultados = df[mask]
        
        if len(resultados) > 0:
            alarma = resultados.iloc[0]
            response = {
                'encontrada': True,
                'datos': alarma.to_dict(),
                'pdf_path': None
            }
            
            # Verificar PDF
            if 'KM (TITULO DEL INSTRUCTIVO)' in alarma:
                pdf_name = f"{alarma['KM (TITULO DEL INSTRUCTIVO)']}.pdf"
                pdf_path = Path('static/instructivos') / pdf_name
                if pdf_path.exists():
                    response['pdf_path'] = f"/static/instructivos/{pdf_name}"
            
            return jsonify(response)
        
        return jsonify({
            'encontrada': False,
            'mensaje': 'Alarma no encontrada'
        })
        
    except Exception as e:
        logger.error(f"Error en búsqueda: {str(e)}")
        return jsonify({'error': 'Error procesando búsqueda'}), 500

@app.route('/favicon.ico')
def favicon():
    return send_from_directory('static', 'favicon.ico')

@app.route('/health')
def health():
    """Health check para Render"""
    df = load_csv_cached()
    return jsonify({
        'status': 'ok',
        'csv_loaded': df is not None,
        'rows': len(df) if df is not None else 0
    })

# No ejecutar en modo debug en producción
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port)