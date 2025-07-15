from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import pandas as pd
import os

app = Flask(__name__)

# ✅ Habilitar CORS globalmente (mejor para evitar errores)

CORS(app, resources={r"/chat": {"origins": "https://chatbot-claro.onrender.com"}})

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

    # Respuestas enriquecidas y sugerencias
    def respuesta_enriquecida(texto, sugerencias=None):
        resp = {"response": texto}
        if sugerencias:
            resp["suggestions"] = sugerencias
        return jsonify(resp)

    if estado == "inicio":
        if msg == "1":
            usuarios[user_id]["estado"] = "espera_alarma"
            return respuesta_enriquecida(
                "Por favor ingresa el número de alarma que deseas consultar.",
                ["12345", "67890", "54321"]
            )
        elif msg == "2":
            return respuesta_enriquecida(
                "📄 <b>Documentación disponible:</b><br>• <a href='https://tu-pdf-hosting.com/manual.pdf' target='_blank'>Manual PDF</a><br>• <a href='https://jefatura-url-de-alarmas.sharepoint.com'>SharePoint de alarmas</a>",
                ["Manual PDF", "SharePoint de alarmas"]
            )
        elif msg == "3":
            return respuesta_enriquecida(
                "🚨 <b>Incidentes activos:</b><br>• Ningún incidente crítico reportado.<br>• Última actualización: 09:00 AM.",
                ["Reportar incidente", "Ver historial"]
            )
        elif msg == "4":
            return respuesta_enriquecida(
                "🟢 Todas las plataformas operativas.",
                ["Ver detalles", "Contactar administrador"]
            )
        elif msg == "5":
            return respuesta_enriquecida(
                "🔄 No hay cambios activos en este momento.",
                ["Ver historial de cambios"]
            )
        elif msg == "6":
            return respuesta_enriquecida(
                "👨‍💼 Puedes contactar al administrador en <a href='mailto:jefe.plataformas@claro.com.co'>jefe.plataformas@claro.com.co</a>.",
                ["Enviar correo", "Ver otros contactos"]
            )
        else:
            return respuesta_enriquecida(menu_principal(), ["1", "2", "3", "4", "5", "6"])

    elif estado == "espera_alarma":
        usuarios[user_id]["numero_alarma"] = msg
        usuarios[user_id]["estado"] = "espera_elemento"
        return respuesta_enriquecida(
            "Ingresa ahora el nombre del elemento asociado a la alarma.",
            ["Motor principal", "Válvula de seguridad", "Sensor de temperatura"]
        )

    elif estado == "espera_elemento":
        numero = usuarios[user_id]["numero_alarma"]
        elemento = msg.strip().lower()
        usuarios[user_id]["estado"] = "inicio"

        resultado = df[
            (df["numero alarma"] == numero) &
            (df["nombre del elemento"] == elemento)
        ]

        def color_severidad(sev):
            sev = str(sev).strip().lower()
            if sev == 'baja':
                return 'sev-baja'
            elif sev == 'media':
                return 'sev-media'
            elif sev == 'alta':
                return 'sev-alta'
            return ''

        def alerta_critica(severidad):
            sev = str(severidad).strip().lower()
            if sev == 'critical':
                return '<div class="alert alert-danger" style="margin-bottom:8px;"><b>⚠️ Alerta CRÍTICA:</b> Esta alarma requiere atención inmediata.</div>'
            elif sev == 'major':
                return '<div class="alert alert-warning" style="margin-bottom:8px;"><b>⚠️ Alerta MAYOR:</b> Revisa este evento lo antes posible.</div>'
            return ''

        if not resultado.empty:
            fila = resultado.iloc[0]
            alerta = alerta_critica(fila.get('severidad',''))
            tabla = f'''
            <div class=\"tabla-alarma-responsive\">
              <table class=\"tabla-alarma\">
                <tr>
                  <th>Número alarma</th>
                  <th>Nombre del elemento</th>
                  <th>Descripción</th>
                  <th>Severidad</th>
                  <th>Significado</th>
                  <th>Acciones</th>
                </tr>
                <tr class=\"destacada\">
                  <td data-tooltip=\"Identificador único de la alarma\" data-copiar=\"{fila.get('numero alarma','')}\"><b>{fila.get('numero alarma','')}</b> <span class='copiar-celda'>📋</span></td>
                  <td data-tooltip=\"Elemento afectado por la alarma\">{fila.get('nombre del elemento','')}</td>
                  <td data-tooltip=\"Descripción técnica de la alarma\">{fila.get('descripción alarma','')}</td>
                  <td data-tooltip=\"Nivel de severidad: baja, media, alta, major o critical\"><span class=\"sev {color_severidad(fila.get('severidad',''))}\">{fila.get('severidad','')}</span></td>
                  <td data-tooltip=\"Significado técnico de la alarma\">{fila.get('significado','')}</td>
                  <td data-tooltip=\"Acciones recomendadas para resolver la alarma\">{fila.get('acciones','')}</td>
                </tr>
              </table>
            </div>
            '''
            respuesta = f"<b>🔔 Alarma detectada:</b><br>{alerta}{tabla}"
            sugerencias = ["Consultar otra alarma", "Volver al menú principal"]
        else:
            respuesta = "❌ No se encontró una alarma con ese número y nombre de elemento."
            sugerencias = ["Intentar de nuevo", "Volver al menú principal"]

        if "❌" in respuesta:
            respuesta += "<br><br>" + menu_principal()

        return respuesta_enriquecida(respuesta, sugerencias)

    return respuesta_enriquecida("❌ Algo salió mal. Intenta de nuevo.", ["Volver al menú principal"])

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)