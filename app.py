# app.py
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
    BASE_DIR = Path(__file__).resolve().parent
    UPLOAD_FOLDER = BASE_DIR / 'static' / 'instructivos'
    CSV_DEFAULT = BASE_DIR / 'instructivos' / 'data' / 'CatalogoAlarmas.csv'
    REQUIRED_COLUMNS = {
        'KM (TITULO DEL INSTRUCTIVO)',
        'Fabricante',
        'TEXTO 1 DE LA ALARMA',
        'SEVERIDAD'
    }

# Variable global para el DataFrame
df_global = None
csv_lock = threading.Lock()

# ======================
# UTILIDADES DE CSV
# ======================
def find_csv_path():
    """Busca el CSV en varias rutas comunes dentro del repo."""
    candidates = [
        Config.BASE_DIR / 'static' / 'data' / 'CatalogoAlarmas.csv',
        Config.BASE_DIR / 'instructivos' / 'data' / 'CatalogoAlarmas.csv',
        Config.BASE_DIR / 'static' / 'instructivos' / 'data' / 'CatalogoAlarmas.csv',
        Config.BASE_DIR / 'static' / 'CatalogoAlarmas.csv',
        Config.BASE_DIR / 'CatalogoAlarmas.csv',
        Config.CSV_DEFAULT
    ]
    for p in candidates:
        logger.info(f"Buscando archivo CSV en: {p}")
        if p.exists():
            logger.info(f"✅ CSV encontrado en: {p}")
            return p
    logger.warning("⚠️ No se encontró el CSV en rutas esperadas.")
    return None

def try_read_csv(path: Path):
    """Intenta leer el CSV con varios separadores/encodings y devolviendo DataFrame o None."""
    read_attempts = [
        {'sep': ';', 'encoding': 'utf-8'},
        {'sep': ',', 'encoding': 'utf-8'},
        {'sep': ';', 'encoding': 'latin-1'},
        {'sep': ',', 'encoding': 'latin-1'},
    ]
    for attempt in read_attempts:
        try:
            logger.info(f"Intentando leer CSV con sep='{attempt['sep']}' encoding='{attempt['encoding']}'")
            chunks = []
            for chunk in pd.read_csv(
                path,
                encoding=attempt['encoding'],
                sep=attempt['sep'],
                dtype=str,
                chunksize=2000,
                on_bad_lines='skip',
                low_memory=False
            ):
                chunks.append(chunk)
            if not chunks:
                continue
            df = pd.concat(chunks, ignore_index=True)
            df.columns = [str(c).strip() for c in df.columns]
            logger.info(f"Lectura exitosa -> {len(df)} filas, columnas: {list(df.columns)[:10]}...")
            return df
        except Exception as e:
            logger.warning(f"Lectura fallida con sep='{attempt['sep']}' encoding='{attempt['encoding']}': {e}")
            continue
    return None

# ======================
# CARGA ASÍNCRONA DEL CSV
# ======================
def load_csv_async():
    """Carga el CSV en un hilo separado para no bloquear el arranque"""
    global df_global

    def worker():
        global df_global
        with csv_lock:
            try:
                logger.info("🚀 Iniciando carga asíncrona del CSV...")
                found = find_csv_path()
                if not found:
                    logger.error("❌ CSV no encontrado en las rutas buscadas.")
                    df_global = None
                    return

                Config.CSV_PATH = found
                df = try_read_csv(found)
                if df is None:
                    logger.error("❌ No se pudo leer el CSV.")
                    df_global = None
                    return

                # Asegurar columnas requeridas
                missing_cols = Config.REQUIRED_COLUMNS - set(df.columns)
                for col in missing_cols:
                    logger.warning(f"⚠️ Columna faltante en el CSV: {col} -> se creará con valor 'NO_ESPECIFICADO'")
                    df[col] = 'NO_ESPECIFICADO'

                # Normalizar valores: trim y reemplazar NaN
                for col in df.columns:
                    try:
                        df[col] = df[col].astype(str).str.strip().fillna('NO_ESPECIFICADO')
                    except Exception:
                        df[col] = df[col].fillna('NO_ESPECIFICADO').astype(str)

                df_global = df
                logger.info(f"✅ CSV cargado exitosamente: {len(df_global)} filas")
            except Exception as e:
                logger.error(f"❌ Error cargando CSV: {e}")
                df_global = None

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()

# ======================
# CREAR APP
# ======================
def create_app():
    app = Flask(__name__, static_folder='static', static_url_path='/static', template_folder='templates')
    app.wsgi_app = ProxyFix(app.wsgi_app)
    Config.UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
    load_csv_async()
    return app

app = create_app()

# ======================
# FUNCIONES DE BÚSQUEDA
# ======================
def search_any_column(query: str):
    """Busca la query en cualquier columna del dataframe (case-insensitive)."""
    global df_global
    if df_global is None or not query:
        return pd.DataFrame()
    mask_df = df_global.apply(lambda col: col.astype(str).str.contains(query, case=False, na=False))
    mask_any = mask_df.any(axis=1)
    resultados = df_global[mask_any]
    return resultados

# ======================
# RUTAS
# ======================
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/buscar_alarma', methods=['POST'])
def buscar_alarma():
    if df_global is None:
        return jsonify({'success': False, 'message': 'Base de datos cargando o no disponible, intenta en unos segundos'}), 503
    try:
        data = request.get_json(silent=True) or {}
        numero = str(data.get('numero', '')).strip()
        elemento = str(data.get('elemento', '')).strip()
        logger.info(f"🔍 Buscar alarma - numero:'{numero}' elemento:'{elemento}'")

        if not numero and not elemento:
            return jsonify({'success': False, 'message': 'Debes ingresar un número de alarma o un elemento'})

        resultados = pd.DataFrame()
        if numero:
            resultados = search_any_column(numero)
        if elemento:
            res_elem = search_any_column(elemento)
            resultados = pd.concat([resultados, res_elem]).drop_duplicates().reset_index(drop=True)

        logger.info(f"🔹 Coincidencias encontradas: {len(resultados)}")
        if len(resultados) > 0:
            alarma = resultados.iloc[0].to_dict()
            pdf_path = None
            titulo_pdf = alarma.get('KM (TITULO DEL INSTRUCTIVO)', '') or ''
            if titulo_pdf and titulo_pdf != 'NO_ESPECIFICADO':
                # safe filename (simple)
                pdf_name = f"{titulo_pdf}.pdf"
                pdf_full_path = Config.UPLOAD_FOLDER / pdf_name
                if not pdf_full_path.exists():
                    # crear placeholder
                    create_placeholder_file(pdf_full_path, pdf_name)
                if pdf_full_path.exists():
                    pdf_path = f"/static/instructivos/{pdf_name}"

            return jsonify({'success': True, 'encontrada': True, 'datos': alarma, 'pdf_path': pdf_path})

        return jsonify({'success': True, 'encontrada': False, 'message': 'No encontré resultados para tu búsqueda.'})
    except Exception as e:
        logger.exception("Error en /buscar_alarma")
        return jsonify({'success': False, 'message': 'Error procesando búsqueda'}), 500

@app.route('/chat_message', methods=['POST'])
def chat_message():
    data = request.get_json(silent=True) or {}
    user_message = str(data.get('message', '')).strip()
    if not user_message:
        # saludo inicial con menú
        menu_text = (
            "Buen día, hablemos de nuestras plataformas de Core. ¿Qué te gustaría consultar hoy?\n\n"
            "1. Alarmas de plataformas.\n"
            "2. Documentación de las plataformas.\n"
            "3. Incidentes activos de las plataformas.\n"
            "4. Estado operativo de las plataformas.\n"
            "5. Cambios activos en las plataformas.\n"
            "6. Hablar con el administrador de la plataforma."
        )
        # options are used by frontend (text + value)
        options = [
            {'text': '🚨 Alarmas de plataformas', 'value': '1'},
            {'text': '📚 Documentación de las plataformas', 'value': '2'},
            {'text': '⚠️ Incidentes activos', 'value': '3'},
            {'text': '✅ Estado operativo', 'value': '4'},
            {'text': '🔄 Cambios activos', 'value': '5'},
            {'text': '👤 Administrador', 'value': '6'},
        ]
        return jsonify({'response': menu_text, 'state': 'menu', 'options': options})

    # si hay mensaje, intentar búsqueda simple en el csv
    if df_global is not None:
        resultados = search_any_column(user_message)
        logger.info(f"🔹 Búsqueda chatbot para '{user_message}' -> {len(resultados)} coincidencias")
        if len(resultados) > 0:
            alarma = resultados.iloc[0].to_dict()
            pdf_path = None
            titulo_pdf = alarma.get('KM (TITULO DEL INSTRUCTIVO)', '') or ''
            if titulo_pdf and titulo_pdf != 'NO_ESPECIFICADO':
                pdf_name = f"{titulo_pdf}.pdf"
                pdf_full_path = Config.UPLOAD_FOLDER / pdf_name
                if not pdf_full_path.exists():
                    create_placeholder_file(pdf_full_path, pdf_name)
                if pdf_full_path.exists():
                    pdf_path = f"/static/instructivos/{pdf_name}"

            options = []
            if pdf_path:
                options.append({'text': '📄 Ver instructivo', 'value': 'open_pdf', 'file_path': pdf_path})

            response_text = f"✅ Alarma encontrada: {alarma.get('TEXTO 1 DE LA ALARMA', 'Descripción no disponible')}"
            return jsonify({'response': response_text, 'state': 'menu', 'options': options})
    return jsonify({'response': "❌ No encontré resultados para tu búsqueda. Intenta con otro número de alarma.", 'state': 'menu', 'options': []})

@app.route('/static/instructivos/<path:filename>')
def serve_instructivo(filename):
    file_path = Config.UPLOAD_FOLDER / filename
    if not file_path.exists():
        create_placeholder_file(file_path, filename)
    logger.info(f"📥 Serviendo instructivo: {filename}")
    return send_from_directory(Config.UPLOAD_FOLDER, filename, as_attachment=False)

@app.route('/health')
def health():
    return jsonify({
        'status': 'ok',
        'csv_loaded': df_global is not None,
        'rows': len(df_global) if df_global is not None else 0,
        'csv_path': str(getattr(Config, 'CSV_PATH', Config.CSV_DEFAULT))
    })

@app.route('/reload_csv', methods=['POST'])
def reload_csv():
    threading.Thread(target=load_csv_async, daemon=True).start()
    return jsonify({'reloading': True})

# ======================
# UTILIDADES
# ======================
def create_placeholder_file(file_path: Path, filename: str):
    """Crear un PDF placeholder para que el frontend pueda abrir una ruta válida."""
    try:
        file_path.parent.mkdir(parents=True, exist_ok=True)
        pdf_bytes = (
            b"%PDF-1.1\n"
            b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
            b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
            b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
            b"4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 10 180 Td (Instructivo placeholder) Tj ET\nendstream\nendobj\n"
            b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
            b"xref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000061 00000 n \n0000000110 00000 n \n0000000201 00000 n \n0000000301 00000 n \n"
            b"trailer\n<< /Root 1 0 R >>\nstartxref\n400\n%%EOF\n"
        )
        with open(file_path, 'wb') as f:
            f.write(pdf_bytes)
        logger.info(f"📝 Creado placeholder PDF: {filename}")
    except Exception as e:
        logger.exception(f"❌ Error creando placeholder para {filename}: {e}")

# ======================
# RUN LOCAL
# ======================
if __name__ == '__main__':
    logger.info("🚀 Iniciando Chatbot Claro (modo local)...")
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=True)
