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

# Inicialización de variables globales
df_alarmas = None
UPLOAD_FOLDER = Path('static/instructivos')

def create_app():
    """Factory pattern para crear la aplicación Flask"""
    app = Flask(__name__)
    app.wsgi_app = ProxyFix(app.wsgi_app)
    
    # Crear directorio de instructivos
    UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
    
    # Cargar CSV dentro del contexto de la app
    with app.app_context():
        global df_alarmas
        df_alarmas = load_csv()
    
    return app

def load_csv():
    """Carga el CSV con manejo robusto de errores"""
    try:
        csv_path = Path('CatalogoAlarmas.csv')
        if not csv_path.exists():
            logger.error(f"❌ CSV no encontrado: {csv_path}")
            return None

        logger.info("📊 Iniciando carga del CSV...")
        
        # Leer CSV en chunks
        chunks = []
        chunk_size = 1000
        
        for chunk in pd.read_csv(
            csv_path,
            encoding='utf-8',
            sep=';',
            dtype=str,
            chunksize=chunk_size,
            on_bad_lines='warn'
        ):
            chunks.append(chunk)
        
        df = pd.concat(chunks, ignore_index=True)
        
        # Verificar columna de instructivo
        km_variants = ['KM (TITULO DEL INSTRUCTIVO)', 'KM', 'INSTRUCTIVO']
        km_col = None
        
        for col in df.columns:
            normalized_col = col.strip().upper()
            if any(variant.upper() in normalized_col for variant in km_variants):
                km_col = col
                break
        
        if not km_col:
            logger.warning("⚠️ Columna de instructivo no encontrada")
            df['KM (TITULO DEL INSTRUCTIVO)'] = 'NO_DISPONIBLE'
        
        # Limpiar datos
        df = df.fillna('NO_DISPONIBLE')
        
        logger.info(f"✅ CSV cargado: {len(df)} filas")
        return df
        
    except Exception as e:
        logger.error(f"❌ Error cargando CSV: {str(e)}")
        return None

# Crear app usando factory pattern
app = create_app()

@app.route('/')
def home():
    """Ruta principal para verificación de salud"""
    return render_template('home.html')

@app.route('/health')
def health():
    """Endpoint de health check"""
    return jsonify({
        'status': 'ok',
        'csv_loaded': df_alarmas is not None
    })

@app.route('/buscar_alarma', methods=['GET', 'POST'])
def buscar_alarma():
    if request.method == 'POST':
        if df_alarmas is None:
            return render_template('resultados.html', 
                                error="Base de datos no disponible")
        
        try:
            numero = request.form.get('numero', '').strip()
            elemento = request.form.get('elemento', '').strip()
            
            # Búsqueda case-insensitive
            mask = (
                df_alarmas['TEXTO 1 DE LA ALARMA'].str.contains(numero, 
                    case=False, na=False) &
                df_alarmas['FABRICANTE'].str.contains(elemento, 
                    case=False, na=False)
            )
            
            resultados = df_alarmas[mask]
            
            if len(resultados) > 0:
                alarma = resultados.iloc[0]
                pdf_path = None
                
                # Verificar PDF de forma segura
                if alarma['KM (TITULO DEL INSTRUCTIVO)'] != 'NO_DISPONIBLE':
                    try:
                        pdf_name = f"{alarma['KM (TITULO DEL INSTRUCTIVO)']}.pdf"
                        if (UPLOAD_FOLDER / pdf_name).exists():
                            pdf_path = pdf_name
                    except Exception as e:
                        logger.error(f"Error verificando PDF: {str(e)}")
                
                return render_template('resultados.html',
                                    alarma=alarma,
                                    pdf_path=pdf_path)
            
            return render_template('resultados.html',
                                error=f"No se encontró la alarma")
            
        except Exception as e:
            logger.error(f"Error en búsqueda: {str(e)}")
            return render_template('resultados.html',
                                error="Error procesando la búsqueda")
    
    return render_template('buscar_alarma.html')

@app.route('/static/instructivos/<path:filename>')
def serve_pdf(filename):
    """Sirve PDFs de forma segura"""
    try:
        return send_from_directory(UPLOAD_FOLDER, filename)
    except Exception as e:
        logger.error(f"Error sirviendo PDF {filename}: {str(e)}")
        return "PDF no encontrado", 404

# Solo ejecutar en desarrollo
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port, debug=True)