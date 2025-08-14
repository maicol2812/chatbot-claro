from flask import Flask, render_template, request, send_from_directory, jsonify
import pandas as pd
import os
import logging
from pathlib import Path
from werkzeug.middleware.proxy_fix import ProxyFix

# ======================
# CONFIGURACIÓN GLOBAL
# ======================
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "static" / "data"
EXCEL_FILE = DATA_DIR / "alarmasCMM.xlsx"
INSTRUCTIVOS_DIR = BASE_DIR / "instructivos"

# ======================
# APP FLASK
# ======================
app = Flask(__name__, template_folder="templates", static_folder="static")
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)

# ======================
# CARGA DE DATOS
# ======================
if EXCEL_FILE.exists():
    try:
        df = pd.read_excel(EXCEL_FILE, dtype=str).fillna("")
        logger.info(f"Archivo {EXCEL_FILE.name} cargado con éxito ({len(df)} registros)")
    except Exception as e:
        logger.error(f"Error al leer {EXCEL_FILE.name}: {e}")
        df = pd.DataFrame()
else:
    logger.error(f"No se encontró el archivo {EXCEL_FILE}")
    df = pd.DataFrame()

# ======================
# RUTAS
# ======================
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/buscar", methods=["GET"])
def buscar():
    numero = request.args.get("numero", "").strip()
    elemento = request.args.get("elemento", "").strip()

    if df.empty:
        return jsonify({"error": "No hay datos cargados"}), 500

    resultados = df[
        (df["NUMERO"].str.contains(numero, case=False, na=False)) &
        (df["ELEMENTO"].str.contains(elemento, case=False, na=False))
    ]

    return jsonify(resultados.to_dict(orient="records"))

@app.route("/instructivo/<nombre>")
def obtener_instructivo(nombre):
    archivo = f"{nombre}.pdf"
    ruta = INSTRUCTIVOS_DIR / archivo

    if ruta.exists():
        return send_from_directory(INSTRUCTIVOS_DIR, archivo)
    else:
        return jsonify({"error": "Instructivo no encontrado"}), 404

# ======================
# RUTA DE HEALTH CHECK
# ======================
@app.route("/health")
def health():
    return "OK", 200

# ======================
# MAIN
# ======================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
