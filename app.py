from flask import Flask, render_template, request, send_from_directory, jsonify
import pandas as pd
import os
import logging
from pathlib import Path
from werkzeug.middleware.proxy_fix import ProxyFix
import spacy

# ======================
# CONFIGURACIÓN GLOBAL
# ======================
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_FOLDER = BASE_DIR / "instructivos"
CSV_FILE = BASE_DIR / "CatalogoAlarmas.csv"

# ======================
# INICIALIZAR FLASK
# ======================
app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)

# ======================
# CARGAR NLP
# ======================
try:
    nlp = spacy.load("es_core_news_sm")
except OSError:
    logger.warning("Modelo 'es_core_news_sm' no encontrado. Intenta instalarlo con: python -m spacy download es_core_news_sm")
    nlp = None

# ======================
# RUTAS
# ======================

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/buscar", methods=["GET"])
def buscar():
    """Busca una alarma por número o elemento en el CSV."""
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "Parámetro 'q' es requerido"}), 400

    if not CSV_FILE.exists():
        return jsonify({"error": f"No se encontró el archivo {CSV_FILE}"}), 404

    try:
        df = pd.read_csv(CSV_FILE, encoding="utf-8")
    except UnicodeDecodeError:
        df = pd.read_csv(CSV_FILE, encoding="latin-1")

    # Normalizar columnas
    df.columns = [col.strip() for col in df.columns]
    col_km = "KM (TITULO DEL INSTRUCTIVO)"
    if col_km not in df.columns:
        return jsonify({"error": f"No existe la columna '{col_km}' en el CSV"}), 500

    # Filtrar
    resultados = df[df.apply(lambda row: query.lower() in row.astype(str).str.lower().to_list(), axis=1)]
    resultados = resultados.to_dict(orient="records")

    return jsonify(resultados)

@app.route("/instructivo/<nombre>")
def descargar_instructivo(nombre):
    """Descarga un PDF de instructivo."""
    file_path = UPLOAD_FOLDER / nombre
    if not file_path.exists():
        return jsonify({"error": f"No se encontró el archivo {nombre}"}), 404

    return send_from_directory(app.config["UPLOAD_FOLDER"], nombre)

@app.route("/health")
def health():
    """Ruta para que Render detecte que la app está viva."""
    return jsonify({"status": "ok"}), 200

# ======================
# MAIN
# ======================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
