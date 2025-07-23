from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# Función que responde a los mensajes comunes
def responder(mensaje):
    mensaje = mensaje.lower().strip()

    if "buenos días" in mensaje or "buenos dias" in mensaje:
        return "¡Buenos días! ¿En qué te puedo ayudar?"
    elif "buenas tardes" in mensaje:
        return "¡Buenas tardes! Estoy para ayudarte."
    elif "buenas noches" in mensaje:
        return "¡Buenas noches! ¿Necesitas algo antes de terminar el día?"
    elif "gracias" in mensaje:
        return "¡Con gusto! Si necesitas algo más, aquí estaré."
    elif "hola" in mensaje or "buenas" in mensaje:
        return "Hablas con tu asesor de plataformas CORE, ¿cómo puedo ayudarte?"
    else:
        return "Lo siento, no entendí tu mensaje. ¿Podrías reformularlo?"

# Ruta principal (carga la página HTML)
@app.route("/")
def home():
    return render_template("index.html")

# Ruta para recibir mensajes desde el frontend
@app.route("/mensaje", methods=["POST"])
def mensaje():
    data = request.get_json()
    texto_usuario = data.get("mensaje", "")
    respuesta_bot = responder(texto_usuario)
    return jsonify({"respuesta": respuesta_bot})

# Iniciar el servidor
if __name__ == "__main__":
    app.run(debug=True)
