from flask import Flask, render_template, request, jsonify, send_from_directory
import pandas as pd
import os
import logging

app = Flask(__name__)

# Configuración de logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Ruta del archivo Excel
EXCEL_FILE = "alarmasCMM.xlsx"

# Cargar el Excel en memoria
def cargar_excel():
    if os.path.exists(EXCEL_FILE):
        try:
            df = pd.read_excel(EXCEL_FILE)
            logger.info(f"Archivo {EXCEL_FILE} cargado correctamente. Filas: {len(df)}")
            return df
        except Exception as e:
            logger.error(f"Error al leer {EXCEL_FILE}: {e}")
            return None
    else:
        logger.error(f"Archivo {EXCEL_FILE} no encontrado.")
        return None

df_alarmas = cargar_excel()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/buscar", methods=["POST"])
def buscar():
    global df_alarmas
    if df_alarmas is None:
        return jsonify({"error": "No se pudo cargar el archivo de alarmas."}), 500

    data = request.json
    numero_alarma = str(data.get("numero", "")).strip()
    elemento = str(data.get("elemento", "")).strip()

    if not numero_alarma and not elemento:
        return jsonify({"error": "Debes ingresar al menos un criterio de búsqueda."}), 400

    resultados = df_alarmas.copy()

    if numero_alarma:
        resultados = resultados[resultados["NUMERO"].astype(str).str.contains(numero_alarma, case=False, na=False)]
    if elemento:
        resultados = resultados[resultados["ELEMENTO"].astype(str).str.contains(elemento, case=False, na=False)]

    if resultados.empty:
        return jsonify({"resultados": []})

    resultados_json = resultados.to_dict(orient="records")
    return jsonify({"resultados": resultados_json})

@app.route("/instructivos/<path:nombre>")
def servir_instructivo(nombre):
    carpeta_pdf = os.path.join(os.getcwd(), "instructivos")
    return send_from_directory(carpeta_pdf, nombre)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
