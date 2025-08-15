from flask import Flask, render_template, request, jsonify, send_from_directory
import pandas as pd
import os
from pathlib import Path
from werkzeug.middleware.proxy_fix import ProxyFix

# ======================
# CONFIGURACIÓN GLOBAL
# ======================
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_FOLDER = BASE_DIR / "pdfs"
EXCEL_FILE = BASE_DIR / "alarmasCMM.xlsx"

app = Flask(__name__, static_folder="static", template_folder="templates")
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)

# ======================
# RUTAS
# ======================
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/buscar_alarma", methods=["GET"])
def buscar_alarma():
    numero = request.args.get("numero")
    elemento = request.args.get("elemento")

    if not numero or not elemento:
        return jsonify({"error": "Debe proporcionar número y elemento"}), 400

    try:
        df = pd.read_excel(EXCEL_FILE, dtype=str)
        df = df.fillna("")

        # Filtrar por número y elemento (insensible a mayúsculas)
        resultados = df[
            (df["NUMERO"].str.contains(numero, case=False)) &
            (df["ELEMENTO"].str.contains(elemento, case=False))
        ]

        if resultados.empty:
            return jsonify({"mensaje": "No se encontró la alarma"}), 404

        respuesta = []
        for _, row in resultados.iterrows():
            respuesta.append({
                "numero": row["NUMERO"],
                "elemento": row["ELEMENTO"],
                "descripcion": row.get("DESCRIPCION", ""),
                "km": row.get("KM (TITULO DEL INSTRUCTIVO)", "")
            })

        return jsonify(respuesta)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/pdf/<path:nombre_pdf>")
def servir_pdf(nombre_pdf):
    try:
        return send_from_directory(UPLOAD_FOLDER, nombre_pdf, as_attachment=False)
    except FileNotFoundError:
        return jsonify({"error": "Archivo no encontrado"}), 404

# ======================
# MAIN
# ======================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
