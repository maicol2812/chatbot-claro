from flask import Flask, render_template, request, jsonify
import pandas as pd
import os

app = Flask(__name__)

# Ruta del archivo Excel
EXCEL_PATH = os.path.join(os.path.dirname(__file__), "alarmasCMM.xlsx")

# Cargar el Excel al iniciar
try:
    df = pd.read_excel(EXCEL_PATH, dtype=str).fillna("")
except Exception as e:
    print(f"❌ Error al leer el Excel: {e}")
    df = pd.DataFrame()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/buscar", methods=["POST"])
def buscar():
    data = request.get_json()
    numero = data.get("numero", "").strip()
    elemento = data.get("elemento", "").strip()

    if df.empty:
        return jsonify({"error": "No se pudo cargar el archivo Excel."}), 500

    resultados = df.copy()

    if numero:
        resultados = resultados[resultados["Numero alarma"].str.contains(numero, case=False, na=False)]
    if elemento:
        resultados = resultados[resultados["Nombre del elemento"].str.contains(elemento, case=False, na=False)]

    return jsonify(resultados.to_dict(orient="records"))

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
