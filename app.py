from flask import Flask, render_template, request, send_from_directory, jsonify
import pandas as pd
import os
import logging
from pathlib import Path
from werkzeug.middleware.proxy_fix import ProxyFix
import PyPDF2
import pdfkit
from docx import Document
from deep_translator import GoogleTranslator
import spacy

# ======================
# CONFIGURACIÓN GLOBAL
# ======================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_FOLDER = BASE_DIR / "uploads"
PDF_FOLDER = BASE_DIR / "pdfs"

# Crear carpetas si no existen
UPLOAD_FOLDER.mkdir(exist_ok=True)
PDF_FOLDER.mkdir(exist_ok=True)

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)

# ======================
# CARGAR XLSX DE ALARMAS
# ======================
try:
    # --- CAMBIO MINIMO: intentamos primero en la raíz y luego en static/data ---
    xlsx_primary = BASE_DIR / "CatalogoAlarmas.xlsx"
    xlsx_fallback = BASE_DIR / "static" / "data" / "alarmasCMM.xlsx"

    if xlsx_primary.exists():
        xlsx_path = xlsx_primary
    elif xlsx_fallback.exists():
        xlsx_path = xlsx_fallback
    else:
        xlsx_path = None

    if xlsx_path is not None:
        logger.info(f"Cargando XLSX desde: {xlsx_path}")
        # Usamos openpyxl (ya lo tienes en requirements)
        df_alarmas = pd.read_excel(xlsx_path, engine="openpyxl")
        logger.info(f"XLSX cargado correctamente con {len(df_alarmas)} registros.")
    else:
        logger.warning(
            f"No se encontró el archivo XLSX en {xlsx_primary} ni en {xlsx_fallback}."
        )
        df_alarmas = pd.DataFrame()
except Exception as e:
    logger.error(f"Error cargando el XLSX: {e}")
    df_alarmas = pd.DataFrame()

# ======================
# RUTA PRINCIPAL
# ======================
@app.route("/")
def index():
    return render_template("index.html")

# ======================
# BUSCAR ALARMA
# ======================
@app.route("/buscar", methods=["GET"])
def buscar():
    numero_alarma = request.args.get("numero")
    elemento = request.args.get("elemento")
    logger.info(f"Buscando alarma: {numero_alarma}, elemento: {elemento}")

    if df_alarmas.empty:
        return jsonify({"error": "Base de datos no cargada"}), 500

    resultado = df_alarmas[
        (df_alarmas["NUMERO"].astype(str) == str(numero_alarma)) &
        (df_alarmas["ELEMENTO"].str.contains(str(elemento), case=False, na=False))
    ]

    if resultado.empty:
        return jsonify({"mensaje": "No se encontraron coincidencias"}), 404

    datos = resultado.to_dict(orient="records")
    return jsonify(datos)

# ======================
# DESCARGAR PDF POR NOMBRE
# ======================
@app.route("/pdf/<nombre>")
def descargar_pdf(nombre):
    try:
        return send_from_directory(PDF_FOLDER, f"{nombre}.pdf", as_attachment=True)
    except Exception as e:
        logger.error(f"Error descargando PDF {nombre}: {e}")
        return jsonify({"error": "Archivo no encontrado"}), 404

# ======================
# TRADUCCIÓN DE TEXTO
# ======================
@app.route("/traducir", methods=["POST"])
def traducir():
    data = request.get_json()
    texto = data.get("texto", "")
    idioma_destino = data.get("idioma", "en")

    if not texto:
        return jsonify({"error": "Texto vacío"}), 400

    try:
        traduccion = GoogleTranslator(source="auto", target=idioma_destino).translate(texto)
        return jsonify({"traduccion": traduccion})
    except Exception as e:
        logger.error(f"Error en traducción: {e}")
        return jsonify({"error": "No se pudo traducir"}), 500

# ======================
# PROCESAR PDF
# ======================
@app.route("/procesar_pdf", methods=["POST"])
def procesar_pdf():
    if "file" not in request.files:
        return jsonify({"error": "No se envió archivo"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "Nombre de archivo vacío"}), 400

    filepath = UPLOAD_FOLDER / file.filename
    file.save(filepath)

    try:
        with open(filepath, "rb") as pdf_file:
            reader = PyPDF2.PdfReader(pdf_file)
            texto = ""
            for page in reader.pages:
                texto += page.extract_text() + "\n"
        return jsonify({"texto": texto})
    except Exception as e:
        logger.error(f"Error procesando PDF: {e}")
        return jsonify({"error": "No se pudo procesar el PDF"}), 500

# ======================
# MODELO NLP SPACY
# ======================
try:
    nlp = spacy.load("es_core_news_sm")
except OSError:
    logger.warning("Modelo 'es_core_news_sm' no encontrado. Ejecuta: python -m spacy download es_core_news_sm")
    nlp = None

@app.route("/analizar", methods=["POST"])
def analizar_texto():
    if nlp is None:
        return jsonify({"error": "Modelo NLP no cargado"}), 500

    data = request.get_json()
    texto = data.get("texto", "")

    if not texto:
        return jsonify({"error": "Texto vacío"}), 400

    doc = nlp(texto)
    tokens = [{"texto": token.text, "pos": token.pos_, "lemma": token.lemma_} for token in doc]

    return jsonify({"tokens": tokens})

# ======================
# EJECUTAR APP
# ======================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
