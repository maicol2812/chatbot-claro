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

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app)

# ======================
# CONFIG
# ======================
class Config:
    BASE_DIR = Path(__file__).resolve().parent
    DATA_FILE = BASE_DIR / "alarmasCMM.xlsx"  # Archivo que tienes
    REQUIRED_COLUMNS = [
        "Nombre del elemento",
        "Numero alarma",
        "Descripción alarma",
        "Severidad",
        "Significado",
        "Acciones"
    ]
    PDF_FOLDER = BASE_DIR / "pdfs"

# ======================
# FUNCIONES
# ======================
def load_data():
    """Carga el archivo Excel o CSV y asegura las columnas."""
    if not Config.DATA_FILE.exists():
        logger.error(f"No se encontró el archivo {Config.DATA_FILE}")
        return pd.DataFrame(columns=Config.REQUIRED_COLUMNS)

    try:
        if Config.DATA_FILE.suffix.lower() in [".xlsx", ".xls"]:
            df = pd.read_excel(Config.DATA_FILE)
        else:
            df = pd.read_csv(Config.DATA_FILE)

        # Asegurar que estén todas las columnas requeridas
        for col in Config.REQUIRED_COLUMNS:
            if col not in df.columns:
                df[col] = ""

        return df[Config.REQUIRED_COLUMNS]

    except Exception as e:
        logger.error(f"Error leyendo el archivo: {e}")
        return pd.DataFrame(columns=Config.REQUIRED_COLUMNS)

# ======================
# RUTAS
# ======================
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/buscar", methods=["GET"])
def buscar():
    numero_alarma = request.args.get("numero")
    nombre_elemento = request.args.get("elemento")

    df = load_data()

    if numero_alarma:
        df = df[df["Numero alarma"].astype(str) == str(numero_alarma)]

    if nombre_elemento:
        df = df[df["Nombre del elemento"].str.contains(nombre_elemento, case=False, na=False)]

    return jsonify(df.to_dict(orient="records"))

@app.route("/pdf/<nombre>")
def abrir_pdf(nombre):
    try:
        return send_from_directory(Config.PDF_FOLDER, f"{nombre}.pdf")
    except FileNotFoundError:
        return jsonify({"error": "Archivo no encontrado"}), 404

# ======================
# MAIN
# ======================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
