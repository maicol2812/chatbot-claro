from flask import Flask, render_template, request, send_from_directory, jsonify
import pandas as pd
import logging
from pathlib import Path
from werkzeug.middleware.proxy_fix import ProxyFix

# ======================
# CONFIGURACIÓN GLOBAL
# ======================
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
DATA_PRIMARY = BASE_DIR / "CatalogoAlarmas.xlsx"          # Excel principal en raíz
DATA_FALLBACK = BASE_DIR / "static" / "data" / "alarmasCMM.xlsx"  # Fallback opcional
PDF_DIR = BASE_DIR / "pdfs"                                # Carpeta de PDFs
PDF_DIR.mkdir(exist_ok=True)

# ======================
# CARGA DE DATOS (XLSX)
# ======================
def cargar_excel():
    xlsx_path = None
    if DATA_PRIMARY.exists():
        xlsx_path = DATA_PRIMARY
    elif DATA_FALLBACK.exists():
        xlsx_path = DATA_FALLBACK

    if not xlsx_path:
        logger.warning("No se encontró el Excel (CatalogoAlarmas.xlsx o static/data/alarmasCMM.xlsx).")
        return pd.DataFrame()

    try:
        df_loaded = pd.read_excel(xlsx_path, engine="openpyxl")
        logger.info(f"Excel cargado desde {xlsx_path} con {len(df_loaded)} registros.")
        return df_loaded
    except Exception as e:
        logger.error(f"Error al cargar el Excel: {e}")
        return pd.DataFrame()

df = cargar_excel()

# ======================
# INICIALIZAR FLASK
# ======================
app = Flask(__name__, static_folder="static", template_folder="templates")
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)

# ======================
# RUTA PRINCIPAL
# ======================
@app.route("/")
def index():
    return render_template("index.html")

# ======================
# API PARA BUSCAR ALARMAS
# ======================
@app.route("/buscar", methods=["GET"])
def buscar():
    numero = request.args.get("numero", "").strip()
    elemento = request.args.get("elemento", "").strip()

    if df.empty:
        return jsonify({"error": "No hay datos cargados. Verifica el Excel."}), 500

    cols = set(df.columns.str.upper())
    if not {"NUMERO", "ELEMENTO"}.issubset(cols):
        return jsonify({"error": "El Excel debe tener columnas NUMERO y ELEMENTO"}), 500

    # Normalizamos nombres por si vienen en minúsculas/mixtas
    dfn = df.rename(columns={c: c.upper() for c in df.columns})

    resultados = dfn.copy()
    if numero:
        resultados = resultados[resultados["NUMERO"].astype(str).str.contains(numero, case=False, na=False)]
    if elemento:
        resultados = resultados[resultados["ELEMENTO"].astype(str).str.contains(elemento, case=False, na=False)]

    return jsonify(resultados.to_dict(orient="records"))

# ======================
# API PARA DESCARGAR PDF
# ======================
@app.route("/pdf/<nombre>")
def descargar_pdf(nombre):
    # Permite pasar "MiArchivo" o "MiArchivo.pdf"
    filename = nombre if nombre.lower().endswith(".pdf") else f"{nombre}.pdf"
    try:
        return send_from_directory(PDF_DIR, filename, as_attachment=True)
    except Exception:
        return jsonify({"error": f"PDF '{filename}' no encontrado en /pdfs"}), 404

# ======================
# HEALTH CHECK (Render)
# ======================
@app.route("/health")
def health():
    return "OK", 200

# ======================
# MAIN LOCAL
# ======================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
