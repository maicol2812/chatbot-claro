from flask import Flask, request, jsonify, render_template, session, url_for
from flask_cors import CORS
import pandas as pd
import os
import uuid
from datetime import datetime

app = Flask(__name__)
app.secret_key = "clave-super-segura"
CORS(app, resources={r"/chat": {"origins": "https://chatbot-claro.onrender.com"}})

usuarios = {}

ruta_excel = os.path.join(os.path.dirname(__file__), "Ejemplo de alarmas CMM.xlsx")
if not os.path.exists(ruta_excel):
    raise FileNotFoundError(f"Archivo no encontrado: {ruta_excel}")

df = pd.read_excel(ruta_excel, engine="openpyxl")
df.columns = df.columns.str.strip().str.lower()

if "numero alarma" not in df.columns or "nombre del elemento" not in df.columns:
    raise KeyError("Columnas necesarias faltantes en el Excel")

df["numero alarma"] = df["numero alarma"].astype(str).str.strip()
df["nombre del elemento"] = df["nombre del elemento"].str.lower().str.strip()

logs = []

def registrar_log(user_id, mensaje):
    logs.append({
        "usuario": user_id,
        "mensaje": mensaje,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    })

def menu_principal():
    return (
        "📋 Menú principal:\n"
        "1. Alarmas de plataformas.\n"
        "2. Documentación de las plataformas.\n"
        "3. Incidentes activos.\n"
        "4. Estado operativo.\n"
        "5. Cambios activos.\n"
        "6. Hablar con administrador."
    )

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/estado-alarmas")
def estado_alarmas():
    alarmas = [
        {"codigo": "101", "descripcion": "Nodo X fuera de servicio"},
        {"codigo": "112", "descripcion": "Latencia elevada en plataforma Z"},
        {"codigo": "203", "descripcion": "Caída parcial en CORE Bogotá"}
    ]
    fecha = datetime.now().strftime("%d/%m/%Y %H:%M")
    return render_template("estado_alarmas.html", alarmas=alarmas, fecha=fecha)

@app.route("/chat", methods=["POST"])
def chat():
    user_id = session.get("user_id")
    if not user_id:
        user_id = str(uuid.uuid4())
        session["user_id"] = user_id

    msg = request.json.get("message", "").strip().lower()
    if user_id not in usuarios:
        usuarios[user_id] = {"estado": "inicio", "historial": []}

    estado = usuarios[user_id]["estado"]
    usuarios[user_id]["historial"].append(msg)
    registrar_log(user_id, msg)

    if estado == "inicio":
        if msg in ["1", "uno", "alarmas", "ver alarmas", "quiero ver alarmas"]:
            usuarios[user_id]["estado"] = "espera_alarma"
            return jsonify({"response": "Por favor ingresa el número de alarma que deseas consultar."})
        else:
            return jsonify({"response": menu_principal()})

    elif estado == "espera_alarma":
        if not msg.isdigit():
            return jsonify({"response": "El número debe contener solo dígitos. Intenta de nuevo."})
        usuarios[user_id]["numero_alarma"] = msg
        usuarios[user_id]["estado"] = "espera_elemento"
        return jsonify({"response": "Ingresa ahora el nombre del elemento asociado a la alarma."})

    elif estado == "espera_elemento":
        numero = usuarios[user_id]["numero_alarma"]
        elemento = msg.strip().lower()
        usuarios[user_id]["estado"] = "inicio"

        resultado = df[(df["numero alarma"] == numero) & (df["nombre del elemento"] == elemento)]

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

@app.route("/logs")
def ver_logs():
    return jsonify(logs)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
