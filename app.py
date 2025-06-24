from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import pandas as pd
import os

app = Flask(__name__)

# ✅ Habilitar CORS globalmente (mejor para evitar errores)
CORS(app)

usuarios = {}

# ✅ Ruta robusta que funciona tanto en local como en Render
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
        "6. Hablar con el administrador de la plataforma."
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
        elemento = msg.strip().lower()
        usuarios[user_id]["estado"] = "inicio"

        resultado = df[
            (df["numero alarma"] == numero) &
            (df["nombre del elemento"] == elemento)
        ]

        if not resultado.empty:
            fila = resultado.iloc[0]
            respuesta = (
                f"🔔 Alarma detectada:\n\n"
                f"📋 Descripción: {fila.get('descripción alarma', 'N/A')}\n"
                f"⚠️ Severidad: {fila.get('severidad', 'N/A')}\n"
                f"🧠 Significado: {fila.get('significado', 'N/A')}\n"
                f"🛠 Acciones: {fila.get('acciones', 'N/A')}"
            )
        else:
            respuesta = "❌ No se encontró una alarma con ese número y nombre de elemento."

        if "❌" in respuesta:
            respuesta += "\n\n" + menu_principal()

        return jsonify({"response": respuesta})

    return jsonify({"response": "❌ Algo salió mal. Intenta de nuevo."})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
