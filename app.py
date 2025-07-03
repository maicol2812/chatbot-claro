from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import pandas as pd
import os
from difflib import get_close_matches

app = Flask(__name__)
CORS(app, resources={r"/chat": {"origins": "*"}})

usuarios = {}

ruta_excel = os.path.join(os.path.dirname(__file__), "Ejemplo de alarmas CMM.xlsx")
if not os.path.exists(ruta_excel):
    raise FileNotFoundError(f"⚠️ Archivo no encontrado en: {ruta_excel}")

df = pd.read_excel(ruta_excel, engine="openpyxl")
df.columns = df.columns.str.strip().str.lower()

if "numero alarma" not in df.columns or "nombre del elemento" not in df.columns:
    raise KeyError("❌ Las columnas necesarias no existen en el archivo Excel.")

df["numero alarma"] = df["numero alarma"].astype(str).str.strip()
df["nombre del elemento"] = df["nombre del elemento"].str.lower().str.strip()

def menu_principal():
    return (
        "📋 Menú principal:\n"
        "1. Alarmas de plataformas.\n"
        "2. Documentación de las plataformas.\n"
        "3. Incidentes activos de las plataformas.\n"
        "4. Estado operativo de las plataformas.\n"
        "5. Cambios activos de las plataformas.\n"
        "6. Hablar con el administrador de la plataforma.\n"
        "🔧 Arreglar alerta\n"
        "⚙️ Configurar alerta\n"
        "💡 Solución de alerta"
    )

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    msg = request.json.get("message", "").strip().lower()
    user_id = "usuario1"

    if user_id not in usuarios:
        usuarios[user_id] = {"estado": "inicio"}

    estado = usuarios[user_id]["estado"]

    respuestas_rapidas = {
        "arreglar alerta": "🔧 Para arreglar una alerta, asegúrate de validar los logs y reiniciar el proceso afectado.",
        "configurar alerta": "⚙️ Las alertas se configuran desde el módulo de monitoreo. Indícame el tipo de alerta a configurar.",
        "solucion alerta": "💡 Una solución típica a las alertas es verificar conectividad, servicios activos y uso de CPU/RAM."
    }

    if msg in respuestas_rapidas:
        return jsonify({"response": respuestas_rapidas[msg]})

    if estado == "inicio":
        if msg == "1":
            usuarios[user_id]["estado"] = "espera_alarma"
            return jsonify({"response": "Por favor ingresa el número de alarma que deseas consultar."})
        else:
            return jsonify({"response": menu_principal()})

    elif estado == "espera_alarma":
        usuarios[user_id]["numero_alarma"] = msg
        usuarios[user_id]["estado"] = "espera_elemento"
        return jsonify({"response": "Ingresa ahora el nombre del elemento asociado a la alarma."})

    elif estado == "espera_elemento":
        numero = usuarios[user_id]["numero_alarma"]
        elemento = msg
        usuarios[user_id]["estado"] = "inicio"

        df["distancia"] = df["nombre del elemento"].apply(lambda x: similarity(x, elemento))
        resultado = df[(df["numero alarma"] == numero) & (df["distancia"] > 0.6)]

        if not resultado.empty:
            fila = resultado.sort_values("distancia", ascending=False).iloc[0]
            respuesta = (
                f"🔔 Alarma detectada:\n\n"
                f"📋 Descripción: {fila.get('descripción alarma', 'N/A')}\n"
                f"⚠️ Severidad: {fila.get('severidad', 'N/A')}\n"
                f"🧠 Significado: {fila.get('significado', 'N/A')}\n"
                f"🛠 Acciones: {fila.get('acciones', 'N/A')}"
            )
        else:
            respuesta = "❌ No se encontró una alarma con ese número y nombre de elemento."

        return jsonify({"response": respuesta + "\n\n" + menu_principal()})

    return jsonify({"response": "❌ Algo salió mal. Intenta de nuevo."})

def similarity(a, b):
    return max([similarity_ratio(a, x) for x in get_close_matches(b, [a], n=1, cutoff=0)]) if a and b else 0

def similarity_ratio(a, b):
    return len(set(a.split()) & set(b.split())) / max(len(set(a.split())), 1)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
