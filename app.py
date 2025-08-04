from flask import Flask, render_template, request, send_from_directory, jsonify
import pandas as pd
import os
import logging
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
        'SERVICIO Y/O SISTEMA GESTIONADO',
        'TEXTO 1 DE LA ALARMA',
        'SEVERIDAD',
        'TIER 1',
        'TIER 2',
        'TIER 3'
    }

# Variable global para el DataFrame
df_alarmas = None

def create_app():
    app = Flask(__name__)
    app.wsgi_app = ProxyFix(app.wsgi_app)
    
    # Crear directorio de instructivos si no existe
    Config.UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
    
    # Cargar CSV al iniciar
    global df_alarmas
    df_alarmas = load_csv()
    
    return app

def load_csv():
    """Carga el CSV con manejo optimizado de memoria"""
    try:
        if not Config.CSV_PATH.exists():
            logger.error(f"❌ CSV no encontrado: {Config.CSV_PATH}")
            return None

        logger.info("📊 Iniciando carga del CSV...")
        
        # Leer CSV en chunks para optimizar memoria
        chunks = []
        for chunk in pd.read_csv(
            Config.CSV_PATH,
            encoding='utf-8',
            sep=';',
            dtype=str,
            chunksize=1000,
            on_bad_lines='warn'
        ):
            chunks.append(chunk)
        
        df = pd.concat(chunks, ignore_index=True)
        
        # Verificar columnas requeridas
        missing_cols = Config.REQUIRED_COLUMNS - set(df.columns)
        if missing_cols:
            logger.warning(f"⚠️ Columnas faltantes: {missing_cols}")
            for col in missing_cols:
                df[col] = "NO ESPECIFICADO"
        
        # Limpiar datos
        df = df.fillna("NO ESPECIFICADO")
        
        logger.info(f"✅ CSV cargado exitosamente - {len(df)} filas")
        return df
        
    except Exception as e:
        logger.error(f"❌ Error cargando CSV: {str(e)}")
        return None

# Crear app
app = create_app()

@app.route('/')
def home():
    """Página principal con menú de opciones"""
    return render_template('index.html')

@app.route('/buscar_alarma', methods=['GET', 'POST'])
def buscar_alarma():
    """Endpoint para búsqueda de alarmas"""
    if request.method == 'POST':
        if df_alarmas is None:
            return jsonify({'error': 'Base de datos no disponible'}), 500
            
        try:
            numero = request.form.get('numero', '').strip()
            elemento = request.form.get('elemento', '').strip()
            
            # Búsqueda case-insensitive
            mask = (
                df_alarmas['TEXTO 1 DE LA ALARMA'].str.contains(numero, case=False, na=False) &
                df_alarmas['Fabricante'].str.contains(elemento, case=False, na=False)
            )
            
            resultados = df_alarmas[mask]
            
            if len(resultados) > 0:
                alarma = resultados.iloc[0]
                response = {
                    'encontrada': True,
                    'datos': alarma.to_dict(),
                    'pdf_path': None
                }
                
                # Verificar PDF
                if alarma['KM (TITULO DEL INSTRUCTIVO)'] != "NO ESPECIFICADO":
                    pdf_name = f"{alarma['KM (TITULO DEL INSTRUCTIVO)']}.pdf"
                    if (Config.UPLOAD_FOLDER / pdf_name).exists():
                        response['pdf_path'] = f"/static/instructivos/{pdf_name}"
                
                return jsonify(response)
            
            return jsonify({
                'encontrada': False,
                'mensaje': 'No se encontró la alarma'
            })
            
        except Exception as e:
            logger.error(f"Error en búsqueda: {str(e)}")
            return jsonify({'error': 'Error procesando la búsqueda'}), 500
    
    return render_template('buscar_alarma.html')

@app.route('/static/instructivos/<path:filename>')
def serve_pdf(filename):
    """Sirve archivos PDF de forma segura"""
    try:
        return send_from_directory(Config.UPLOAD_FOLDER, filename)
    except Exception as e:
        logger.error(f"Error sirviendo PDF {filename}: {str(e)}")
        return "PDF no encontrado", 404

if __name__ == '__main__':
    # Puerto para desarrollo
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port, debug=True)