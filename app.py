from flask import Flask, render_template, request, send_from_directory, jsonify
import pandas as pd
import os
import logging
import threading
from pathlib import Path
from werkzeug.middleware.proxy_fix import ProxyFix

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuración de la aplicación
class Config:
    UPLOAD_FOLDER = Path('static/instructivos')
    CSV_PATH = Path('CatalogoAlarmas.csv')
    REQUIRED_COLUMNS = {
        'KM (TITULO DEL INSTRUCTIVO)',
        'Fabricante',
        'TEXTO 1 DE LA ALARMA',
        'SEVERIDAD'
    }

# Variable global para el DataFrame
df_global = None

def load_csv_async():
    """Carga el CSV en un hilo separado para no bloquear el arranque"""
    global df_global

    def worker():
        try:
            logger.info("🚀 Iniciando carga asíncrona del CSV...")
            
            if not Config.CSV_PATH.exists():
                logger.error(f"❌ CSV no encontrado: {Config.CSV_PATH}")
                return
            
            # Leer CSV en chunks
            chunks = []
            total_rows = 0
            
            for chunk in pd.read_csv(
                Config.CSV_PATH,
                encoding='utf-8',
                sep=';',
                dtype=str,
                chunksize=1000
            ):
                chunks.append(chunk)
                total_rows += len(chunk)
                logger.info(f"📊 Cargados {total_rows} registros...")
            
            df = pd.concat(chunks, ignore_index=True)
            
            # Verificar columnas requeridas
            if 'KM (TITULO DEL INSTRUCTIVO)' not in df.columns:
                logger.warning("⚠️ Columna 'KM (TITULO DEL INSTRUCTIVO)' no encontrada")
                df['KM (TITULO DEL INSTRUCTIVO)'] = 'NO_DISPONIBLE'
            
            missing_cols = Config.REQUIRED_COLUMNS - set(df.columns)
            if missing_cols:
                logger.warning(f"⚠️ Columnas faltantes: {missing_cols}")
                for col in missing_cols:
                    df[col] = 'NO_ESPECIFICADO'
            
            df = df.fillna('NO_ESPECIFICADO')
            
            # Actualizar variable global
            global df_global
            df_global = df
            
            logger.info(f"✅ CSV cargado exitosamente: {len(df)} filas")
        except Exception as e:
            logger.error(f"❌ Error cargando CSV: {str(e)}")
    
    # Iniciar el hilo
    thread = threading.Thread(target=worker)
    thread.daemon = True
    thread.start()

def create_app():
    """Factory pattern para crear la app"""
    app = Flask(__name__,
                static_folder='static',
                static_url_path='/static')
    
    # Configurar proxy para Render
    app.wsgi_app = ProxyFix(app.wsgi_app)
    
    # Crear directorio de instructivos si no existe
    Config.UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
    
    # Iniciar carga asíncrona del CSV
    load_csv_async()
    
    return app

# Crear la app
app = create_app()

@app.route('/')
def home():
    """Página principal"""
    return render_template('index.html')

@app.route('/buscar_alarma', methods=['POST'])
def buscar_alarma():
    """Endpoint para buscar alarmas"""
    if df_global is None:
        return jsonify({
            'error': 'Base de datos cargando, intenta en unos segundos'
        }), 503
    
    try:
        numero = request.form.get('numero', '').strip()
        elemento = request.form.get('elemento', '').strip()
        
        # Búsqueda case-insensitive
        mask = (
            df_global['TEXTO 1 DE LA ALARMA'].str.contains(numero, case=False, na=False) &
            df_global['Fabricante'].str.contains(elemento, case=False, na=False)
        )
        
        resultados = df_global[mask]
        
        if len(resultados) > 0:
            alarma = resultados.iloc[0]
            response = {
                'encontrada': True,
                'datos': alarma.to_dict(),
                'pdf_path': None
            }
            
            # Verificar PDF
            if alarma['KM (TITULO DEL INSTRUCTIVO)'] != 'NO_DISPONIBLE':
                pdf_name = f"{alarma['KM (TITULO DEL INSTRUCTIVO)']}.pdf"
                pdf_path = Config.UPLOAD_FOLDER / pdf_name
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

@app.route('/health')
def health():
    """Health check para Render"""
    return jsonify({
        'status': 'ok',
        'csv_loaded': df_global is not None,
        'rows': len(df_global) if df_global is not None else 0
    })