from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import pandas as pd
import os
import datetime
from collections import defaultdict

app = Flask(__name__)

# ✅ Habilitar CORS globalmente (mejor para evitar errores)

CORS(app, resources={r"/chat": {"origins": "https://chatbot-claro.onrender.com"}})

usuarios = {}
conversaciones = []
metricas = defaultdict(int)

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


# Sugerencia de mejora profesional:
# Puedes permitir que el usuario consulte alarmas por coincidencia parcial (no solo exacta)
# y mostrar múltiples resultados en una tabla profesional usando render_alarmas_table.

@app.route("/chat", methods=["POST"])
def chat():
    msg = request.json.get("message", "")
    if not isinstance(msg, str):
        msg = str(msg)
    msg = msg.strip().lower()
    user_id = "usuario1"

    if user_id not in usuarios:
        usuarios[user_id] = {"estado": "inicio"}

    estado = usuarios[user_id]["estado"]

    def respuesta_enriquecida(texto, sugerencias=None, extra=None):
        resp = {"response": texto}
        if sugerencias:
            resp["suggestions"] = sugerencias
        if extra:
            resp.update(extra)
        # Registro de conversación
        conversaciones.append({
            "timestamp": datetime.datetime.now().isoformat(),
            "usuario": user_id,
            "mensaje": msg,
            "respuesta": texto,
            "estado": estado
        })
        metricas[user_id] += 1
        if estado == "inicio":
            metricas["inicio"] += 1
        elif estado == "espera_alarma":
            metricas["consulta_alarma"] += 1
        elif estado == "espera_elemento":
            metricas["consulta_elemento"] += 1
        return jsonify(resp)

    # Saludo inicial profesional y menú experto
    if estado == "inicio":
        if msg in ["hola", "buen día", "buenos días", "buenas", "saludo", "inicio"]:
            saludo = (
                "<b>👋 Bienvenido al asistente experto de plataformas Core.</b><br>"
                "¿En qué puedo ayudarte hoy?<br><br>"
                "<ol>"
                "<li><b>Alarmas de plataformas</b>: Consulta alarmas activas, severidad y acciones recomendadas.</li>"
                "<li><b>Documentación</b>: Accede a manuales, procedimientos y recursos técnicos.</li>"
                "<li><b>Incidentes activos</b>: Revisa incidentes críticos y su estado actual.</li>"
                "<li><b>Estado operativo</b>: Verifica el estado de operación de cada plataforma.</li>"
                "<li><b>Cambios activos</b>: Consulta cambios programados y su impacto.</li>"
                "<li><b>Hablar con el administrador</b>: Contacta directamente al responsable técnico.</li>"
                "</ol>"
                "<i>Selecciona una opción (1-6) o describe tu consulta.</i>"
            )
            return respuesta_enriquecida(saludo, ["1", "2", "3", "4", "5", "6"])
        if msg == "1":
            usuarios[user_id]["estado"] = "espera_alarma"
            return respuesta_enriquecida(
                "🔎 <b>Consulta experta de alarmas:</b><br>Por favor ingresa el <b>número de alarma</b> que deseas consultar.<br><i>Ejemplo: 12345</i>",
                ["12345", "67890", "54321"],
                {"help": "Puedes buscar por coincidencia parcial o total."}
            )
        elif msg == "2":
            return respuesta_enriquecida(
                "📄 <b>Documentación técnica disponible:</b><br>"
                "• <a href='https://tu-pdf-hosting.com/manual.pdf' target='_blank'>Manual PDF</a> (Procedimientos, configuraciones)<br>"
                "• <a href='https://jefatura-url-de-alarmas.sharepoint.com'>SharePoint de alarmas</a> (Histórico y reportes)<br>"
                "<i>¿Necesitas ayuda con algún documento específico?</i>",
                ["Manual PDF", "SharePoint de alarmas", "Solicitar procedimiento"]
            )
        elif msg == "3":
            return respuesta_enriquecida(
                "🚨 <b>Incidentes activos:</b><br>"
                "• <span style='color:green;'>Ningún incidente crítico reportado.</span><br>"
                "• Última actualización: <b>09:00 AM</b>.<br>"
                "• <a href='#' onclick='reportarIncidente()'>Reportar nuevo incidente</a><br>"
                "<i>¿Deseas ver el historial o detalles de algún incidente?</i>",
                ["Reportar incidente", "Ver historial", "Ver detalles"]
            )
        elif msg == "4":
            return respuesta_enriquecida(
                "🟢 <b>Estado operativo:</b><br>"
                "• Todas las plataformas se encuentran <b>operativas</b>.<br>"
                "• No se detectan degradaciones ni eventos críticos.<br>"
                "<i>¿Quieres ver el estado detallado de una plataforma específica?</i>",
                ["Ver detalles", "Contactar administrador", "Ver histórico"]
            )
        elif msg == "5":
            return respuesta_enriquecida(
                "🔄 <b>Cambios activos:</b><br>"
                "• No hay cambios activos en este momento.<br>"
                "• Última revisión: <b>08:30 AM</b>.<br>"
                "<i>¿Deseas consultar el historial de cambios o programar uno nuevo?</i>",
                ["Ver historial de cambios", "Programar cambio"]
            )
        elif msg == "6":
            return respuesta_enriquecida(
                "👨‍💼 <b>Contacto administrador:</b><br>"
                "• Puedes contactar al administrador en <a href='mailto:38514121@claro.com.co'>38514121@claro.com.co</a>.<br>"
                "• <a href='tel:+573213445747'>Llamar al +573213445747</a><br>"
                "<i>¿Necesitas soporte técnico o agendar una reunión?</i>",
                ["Enviar correo", "Ver otros contactos", "Agendar reunión"]
            )
        else:
            return respuesta_enriquecida(
                "<b>❓ No entendí tu consulta.</b><br>Por favor selecciona una opción del menú o describe tu requerimiento.",
                ["1", "2", "3", "4", "5", "6", "Ayuda"]
            )

    elif estado == "espera_alarma":
        usuarios[user_id]["numero_alarma"] = msg
        usuarios[user_id]["estado"] = "espera_elemento"
        metricas["alarma_solicitada"] += 1
        return respuesta_enriquecida(
            "Por favor ingresa el nombre del elemento que reporta la alarma.",
            ["Motor principal", "Válvula de seguridad", "Sensor de temperatura"]
        )

    elif estado == "espera_elemento":
        numero = usuarios[user_id]["numero_alarma"]
        elemento = msg.strip().lower()
        usuarios[user_id]["estado"] = "inicio"
        metricas["elemento_solicitado"] += 1

        resultado = df[
            df["numero alarma"].str.contains(numero) &
            df["nombre del elemento"].str.contains(elemento)
        ]

        def color_severidad(sev):
            sev = str(sev).strip().lower()
            if sev == 'baja':
                return 'sev sev-baja'
            elif sev == 'media':
                return 'sev sev-media'
            elif sev == 'alta':
                return 'sev sev-alta'
            elif sev == 'major':
                return 'sev sev-alta'
            elif sev == 'critical':
                return 'sev sev-alta'
            return 'sev'

        def alerta_critica(severidad):
            sev = str(severidad).strip().lower()
            if sev == 'critical':
                return '<div class="alert alert-danger" style="margin-bottom:8px;"><b>⚠️ Alerta CRÍTICA:</b> Esta alarma requiere atención inmediata.</div>'
            elif sev == 'major':
                return '<div class="alert alert-warning" style="margin-bottom:8px;"><b>⚠️ Alerta MAYOR:</b> Revisa este evento lo antes posible.</div>'
            return ''

        if not resultado.empty:
            filas = resultado.to_dict(orient="records")
            if len(filas) == 1:
                fila = filas[0]
                alerta = alerta_critica(fila.get('severidad',''))
                tabla = f'''
                <div class="tabla-alarma-responsive">
                  <table class="tabla-alarma">
                    <tr>
                      <th>Número alarma</th>
                      <th>Nombre del elemento</th>
                      <th>Descripción</th>
                      <th>Severidad</th>
                      <th>Significado</th>
                      <th>Acciones</th>
                    </tr>
                    <tr class="destacada">
                      <td data-tooltip="Identificador único de la alarma" data-copiar="{fila.get('numero alarma','')}"><b>{fila.get('numero alarma','')}</b> <span class='copiar-celda'>📋</span></td>
                      <td data-tooltip="Elemento afectado por la alarma">{fila.get('nombre del elemento','')}</td>
                      <td data-tooltip="Descripción técnica de la alarma">{fila.get('descripción alarma','')}</td>
                      <td data-tooltip="Nivel de severidad: baja, media, alta, major o critical"><span class="sev {color_severidad(fila.get('severidad',''))}">{fila.get('severidad','')}</span></td>
                      <td data-tooltip="Significado técnico de la alarma">{fila.get('significado','')}</td>
                      <td data-tooltip="Acciones recomendadas para resolver la alarma">{fila.get('acciones','')}</td>
                    </tr>
                  </table>
                </div>
                '''
                respuesta = f"<b>🔔 Alarma detectada:</b><br>{alerta}{tabla}"
            else:
                tabla = render_alarmas_table(filas)
                respuesta = f"<b>🔔 Resultados encontrados ({len(filas)}):</b><br>{tabla}"
            sugerencias = ["Consultar otra alarma", "Volver al menú principal"]
        else:
            respuesta = "❌ No se encontró una alarma con ese número y nombre de elemento."
            sugerencias = ["Intentar de nuevo", "Volver al menú principal"]

        if "❌" in respuesta:
            respuesta += "<br><br>" + menu_principal()

        return respuesta_enriquecida(respuesta, sugerencias)

    return respuesta_enriquecida("❌ Algo salió mal. Intenta de nuevo.", ["Volver al menú principal"])

# Endpoint opcional para ver métricas y registro de conversaciones
@app.route("/metrics")
def metrics():
    return jsonify({
        "metricas": dict(metricas),
        "conversaciones": conversaciones[-10:]  # últimas 10 conversaciones
    })

def severidad_class(severidad):
    sev = str(severidad).strip().lower()
    if sev == 'baja':
        return 'sev sev-baja'
    elif sev == 'media':
        return 'sev sev-media'
    elif sev == 'alta':
        return 'sev sev-alta'
    return 'sev'

def render_alarmas_table(rows):
    """
    Renderiza una tabla HTML profesional y responsiva para mostrar alarmas,
    con tooltips, copiar, colores y formato experto.
    """
    table = '''
    <div class="tabla-alarma-responsive">
      <table class="tabla-alarma">
        <thead>
          <tr>
            <th>Acciones</th>
            <th>Significado</th>
            <th>Severidad</th>
            <th>Descripción alarma</th>
            <th>Número alarma</th>
            <th>Nombre del elemento</th>
          </tr>
        </thead>
        <tbody>
    '''
    for row in rows:
        acciones = row.get('Acciones', '')
        significado = row.get('Significado', '')
        severidad = row.get('Severidad', '')
        descripcion = row.get('Descripción alarma', '')
        numero = row.get('Número alarma', '')
        elemento = row.get('Nombre del elemento', '')

        table += f'''
          <tr>
            <td data-tooltip="Acción recomendada" data-copiar="{acciones}">{acciones} <span class='copiar-celda'>📋</span></td>
            <td data-tooltip="Significado de la alarma" data-copiar="{significado}">{significado} <span class='copiar-celda'>📋</span></td>
            <td><span class="{color_severidad(severidad)}">{severidad}</span></td>
            <td data-tooltip="Descripción detallada" data-copiar="{descripcion}">{descripcion} <span class='copiar-celda'>📋</span></td>
            <td data-tooltip="Identificador único de la alarma" data-copiar="{numero}"><b>{numero}</b> <span class='copiar-celda'>📋</span></td>
            <td data-tooltip="Elemento afectado" data-copiar="{elemento}">{elemento} <span class='copiar-celda'>📋</span></td>
          </tr>
        '''
    table += '''
        </tbody>
      </table>
    </div>
    '''
    return table

# Ejemplo de uso avanzado en tu endpoint:
# if not resultado.empty:
#     filas = resultado.to_dict(orient="records")
#     tabla_html = render_alarmas_table(filas)
#     respuesta = f"<b>🔔 Resultados encontrados:</b><br>{tabla_html}"
#     return respuesta_enriquecida(respuesta, ["Consultar otra alarma", "Volver al menú principal"])
# else:
#     return respuesta_enriquecida("❌ No se encontraron alarmas para tu búsqueda.<br><br>" + menu_principal(), ["Intentar de nuevo", "Volver al menú principal"])

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)