const chatContainer = document.getElementById("chat-container");
const chatBox = document.getElementById("chat-box");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const micBtn = document.getElementById("mic-btn");

function toggleChat() {
  chatContainer.classList.toggle("mostrar");
  chatBox.innerHTML = ""; // Borrar historial
  setTimeout(() => {
    bot("🖐️ Buen día, hablemos de nuestras plataformas de Core.<br>¿Qué te gustaría consultar el día de hoy?");
    setTimeout(() => showMainMenu(), 5000);
  }, 500);
}

function toggleExpand() {
  chatContainer.classList.toggle("expandido");
}

function user(msg) {
  chatBox.innerHTML += `<div class="user-msg">${msg}</div>`;
  chatBox.scrollTop = chatBox.scrollHeight;
}

function bot(msg) {
  chatBox.innerHTML += `<div class="bot-msg">${msg}</div>`;
  chatBox.scrollTop = chatBox.scrollHeight;
}

function showMainMenu() {
  const opciones = [
    ["1", "Alarmas de plataformas"],
    ["2", "Documentación de plataformas"],
    ["3", "Incidentes activos"],
    ["4", "Estado operativo"],
    ["5", "Cambios activos"],
    ["6", "Hablar con el administrador"],
    ["arreglar alerta", "🔧 Arreglar alerta"],
    ["configurar alerta", "⚙️ Configurar alerta"],
    ["solucion alerta", "💡 Solución de alerta"]
  ];
  let html = '<div class="bot-msg"><b>📋 Menú principal:</b><br>';
  opciones.forEach(([val, text]) => {
    html += `<button class="btn btn-outline-danger btn-sm m-1" onclick="sendOption('${val}')">${text}</button>`;
  });
  html += "</div>";
  chatBox.insertAdjacentHTML("beforeend", html);
  chatBox.scrollTop = chatBox.scrollHeight;
}

window.sendOption = (val) => {
  chatInput.value = val;
  chatForm.dispatchEvent(new Event("submit"));
};

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if (!msg) return;
  user(msg);
  chatInput.value = "";
  const respuestas = {
    "arreglar alerta": "🔧 Para arreglar una alerta, valida los logs y reinicia el proceso afectado.",
    "configurar alerta": "⚙️ Las alertas se configuran desde el módulo de monitoreo. ¿Qué tipo deseas configurar?",
    "solucion alerta": "💡 Verifica conectividad, servicios activos y uso de CPU/RAM para solucionarlo."
  };
  if (respuestas[msg.toLowerCase()]) {
    bot(respuestas[msg.toLowerCase()]);
    return;
  }

  const res = await fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: msg })
  });
  const data = await res.json();
  bot(data.response);
});

// 🎤 Reconocimiento de voz
if ("webkitSpeechRecognition" in window) {
  const recognition = new webkitSpeechRecognition();
  recognition.lang = "es-ES";
  recognition.continuous = false;
  recognition.interimResults = false;
  micBtn.onclick = () => recognition.start();
  recognition.onresult = (event) => {
    chatInput.value = event.results[0][0].transcript;
    chatForm.dispatchEvent(new Event("submit"));
  };
}

// 🌐 Traducción automática (placeholder)
/*
navigator.language puede usarse para detectar idioma
Se puede enviar a backend para traducir si se desea.
*/

// 🌓 Modo nocturno automático
const hora = new Date().getHours();
if (hora < 6 || hora > 18) {
  document.body.classList.add("night-mode");
}

// Notificaciones push activadas desde el HTML ya con service-worker.js registrado
