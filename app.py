from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import pandas as pd
import os
import difflib
from datetime import datetime
import locale

app = Flask(__name__)
CORS(app, resources={r"/chat": {"origins": "https://chatbot-claro.onrender.com"}})

usuarios = {}

# Cargar Excel
ruta_excel = os.path.join(os.path.dirname(__file__), "Ejemplo de alarmas CMM.xlsx")
if not os.path.exists(ruta_excel):
    raise FileNotFoundError(f"Archivo no encontrado en: {ruta_excel}")

df = pd.read_excel(ruta_excel, engine="openpyxl")
df.columns = df.columns.str.strip().str.lower()
df["numero alarma"] = df["numero alarma"].astype(str).str.strip()
df["nombre del elemento"] = df["nombre del elemento"].str.lower().str.strip()

# Palabras claves para corrección
comandos_validos = ["1", "2", "3", "4", "5", "6", "arreglar alerta", "configurar alerta", "solucion alerta"]

# Corrección inteligente
def corregir_input(texto):
    if texto in comandos_validos:
        return texto
    match = difflib.get_close_matches(texto, comandos_validos, n=1, cutoff=0.6)
    return match[0] if match else texto

def menu_principal():
    return (
        "\n📋 Menú principal:\n"
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
    msg = corregir_input(msg)
    user_id = "usuario1"

    if user_id not in usuarios:
        usuarios[user_id] = {"estado": "inicio"}

    estado = usuarios[user_id]["estado"]

    if msg in ["arreglar alerta", "configurar alerta", "solucion alerta"]:
        respuestas = {
            "arreglar alerta": "🔧 Para arreglar una alerta, asegúrate de validar los logs y reiniciar el proceso afectado.",
            "configurar alerta": "⚙️ Las alertas se configuran desde el módulo de monitoreo. Indícame el tipo de alerta a configurar.",
            "solucion alerta": "💡 Una solución típica a las alertas es verificar conectividad, servicios activos y uso de CPU/RAM."
        }
        return jsonify({"response": respuestas[msg]})

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
