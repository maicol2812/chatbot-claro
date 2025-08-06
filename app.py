from flask import Flask, render_template, request, send_from_directory, jsonify
import pandas as pd
import os
import logging
import threading
from pathlib import Path
from werkzeug.middleware.proxy_fix import ProxyFix

# ======================
# CONFIGURACIÓN GLOBAL
# ======================

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class Config:
    UPLOAD_FOLDER = Path('static/instructivos')
    CSV_PATH = Path('data/CatalogoAlarmas.csv')  # Ajusta la ruta de tu CSV
    REQUIRED_COLUMNS = {
        'KM (TITULO DEL INSTRUCTIVO)',
        'Fabricante',
        'TEXTO 1 DE LA ALARMA',
        'SEVERIDAD'
    }

# Variable global para el DataFrame
df_global = None

# ======================
# CARGA ASÍNCRONA DEL CSV
# ======================

def load_csv_async():
    """Carga el CSV en un hilo separado para no bloquear el arranque"""
    global df_global

    def worker():
        try:
            logger.info("🚀 Iniciando carga asíncrona del CSV...")

            if not Config.CSV_PATH.exists():
                logger.error(f"❌ CSV no encontrado: {Config.CSV_PATH}")
                return

            chunks = []
            total_rows = 0

            # Leer CSV en chunks
            for chunk in pd.read_csv(
                Config.CSV_PATH,
                encoding='utf-8',
                sep=';',      # Ajusta si tu CSV usa coma
                dtype=str,
                chunksize=1000
            ):
                chunks.append(chunk)
                total_rows += len(chunk)
                logger.info(f"📊 Cargados {total_rows} registros...")

            df = pd.concat(chunks, ignore_index=True)

            # Validar columnas requeridas
            missing_cols = Config.REQUIRED_COLUMNS - set(df.columns)
            for col in missing_cols:
                logger.warning(f"⚠️ Columna faltante: {col}")
                df[col] = 'NO_ESPECIFICADO'

            df = df.fillna('NO_ESPECIFICADO')
            df_global = df

            logger.info(f"✅ CSV cargado exitosamente: {len(df)} filas")
        except Exception as e:
            logger.error(f"❌ Error cargando CSV: {str(e)}")

    thread = threading.Thread(target=worker)
    thread.daemon = True
    thread.start()

# ======================
# CREAR APP
# ======================

def create_app():
    app = Flask(__name__,
                static_folder='static',
                static_url_path='/static')

    app.wsgi_app = ProxyFix(app.wsgi_app)
    Config.UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)

    # Carga asíncrona de CSV
    load_csv_async()

    return app

app = create_app()

# ======================
# RUTAS PRINCIPALES
# ======================

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
        # Soporta JSON y FormData
        data = request.get_json(silent=True) or request.form
        numero = str(data.get('numero', '')).strip()
        elemento = str(data.get('elemento', '')).strip()

        logger.info(f"🔍 Buscando alarma - Número: {numero}, Elemento: {elemento}")

        # Búsqueda case-insensitive
        mask = (
            df_global['TEXTO 1 DE LA ALARMA'].str.contains(numero, case=False, na=False) &
            df_global['Fabricante'].str.contains(elemento, case=False, na=False)
        )

        resultados = df_global[mask]

        if len(resultados) > 0:
            alarma = resultados.iloc[0].to_dict()
            pdf_path = None

            # Validar PDF asociado
            titulo_pdf = alarma.get('KM (TITULO DEL INSTRUCTIVO)', 'NO_DISPONIBLE')
            if titulo_pdf != 'NO_DISPONIBLE':
                pdf_name = f"{titulo_pdf}.pdf"
                pdf_full_path = Config.UPLOAD_FOLDER / pdf_name
                if pdf_full_path.exists():
                    pdf_path = f"/static/instructivos/{pdf_name}"
                else:
                    create_placeholder_file(pdf_full_path, pdf_name)
                    pdf_path = f"/static/instructivos/{pdf_name}"

            return jsonify({
                'encontrada': True,
                'datos': alarma,
                'pdf_path': pdf_path
            })

        return jsonify({
            'encontrada': False,
            'mensaje': 'Alarma no encontrada'
        })

    except Exception as e:
        logger.error(f"Error en búsqueda: {str(e)}")
        return jsonify({'error': 'Error procesando búsqueda'}), 500


@app.route('/chat_message', methods=['POST'])
def chat_message():
    """Endpoint principal del chatbot"""
    data = request.get_json(silent=True) or {}
    user_message = data.get('message', '').strip()
    state = data.get('state', 'menu')

    # Simulación de respuesta del bot
    if not user_message or state == 'menu':
        return jsonify({
            'response': "👋 ¡Hola! Soy el Asistente Virtual Claro.\n\nEscribe un número de alarma o un elemento para comenzar.",
            'state': 'awaiting_input',
            'options': []
        })

    # Ejemplo: búsqueda simple
    if df_global is not None:
        mask = df_global['TEXTO 1 DE LA ALARMA'].str.contains(user_message, case=False, na=False)
        resultados = df_global[mask]
        if len(resultados) > 0:
            alarma = resultados.iloc[0].to_dict()
            pdf_path = None

            titulo_pdf = alarma.get('KM (TITULO DEL INSTRUCTIVO)', 'NO_DISPONIBLE')
            if titulo_pdf != 'NO_DISPONIBLE':
                pdf_name = f"{titulo_pdf}.pdf"
                pdf_full_path = Config.UPLOAD_FOLDER / pdf_name
                if pdf_full_path.exists():
                    pdf_path = f"/static/instructivos/{pdf_name}"
                else:
                    create_placeholder_file(pdf_full_path, pdf_name)
                    pdf_path = f"/static/instructivos/{pdf_name}"

            options = []
            if pdf_path:
                options.append({
                    'text': '📄 Ver instructivo',
                    'value': 'pdf',
                    'file_path': pdf_path
                })

            return jsonify({
                'response': f"✅ Alarma encontrada: {alarma['TEXTO 1 DE LA ALARMA']}",
                'state': 'menu',
                'options': options
            })

    return jsonify({
        'response': "❌ No encontré resultados para tu búsqueda. Intenta con otro número de alarma.",
        'state': 'menu',
        'options': []
    })


@app.route('/static/instructivos/<filename>')
def serve_instructivo(filename):
    """Sirve archivos PDF/Word de instructivos"""
    file_path = Config.UPLOAD_FOLDER / filename
    if not file_path.exists():
        create_placeholder_file(file_path, filename)
    return send_from_directory(Config.UPLOAD_FOLDER, filename)

@app.route('/health')
def health():
    """Health check para Render"""
    return jsonify({
        'status': 'ok',
        'csv_loaded': df_global is not None,
        'rows': len(df_global) if df_global is not None else 0
    })

# ======================
# UTILIDADES
# ======================

def create_placeholder_file(file_path, filename):
    """Crear archivo placeholder para demo"""
    try:
        if filename.endswith('.pdf'):
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(f"Placeholder PDF para {filename}\n")
        else:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(f"Placeholder file para {filename}")
        logger.info(f"📝 Creado archivo placeholder: {filename}")
    except Exception as e:
        logger.error(f"❌ Error al crear placeholder: {str(e)}")

# ======================
# RUN LOCAL
# ======================

if __name__ == '__main__':
    logger.info("🚀 Iniciando Chatbot Claro...")
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=True)
