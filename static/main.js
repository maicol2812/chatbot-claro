// static/main.js

// Detectar modo nocturno automático
window.addEventListener('DOMContentLoaded', () => {
  const hour = new Date().getHours();
  if (hour < 6 || hour > 18) document.body.classList.add("night-mode");

  // Mostrar saludo inicial y luego menú principal
  const chatBox = document.querySelector(".chat-box");
  setTimeout(() => {
    const saludo = `<div class="bot-msg">👋 Buen día, hablemos de nuestras plataformas de Core.<br>¡¿Qué te gustaría consultar hoy?</div>`;
    chatBox.insertAdjacentHTML("beforeend", saludo);
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 1000);

  setTimeout(() => {
    showMainMenu();
  }, 5000);
});

// Enviar opción rápida
window.sendOption = (val) => {
  document.querySelector("#chat-input").value = val;
  document.querySelector("#chat-form").dispatchEvent(new Event("submit"));
};

function showMainMenu() {
  const opciones = [
    ["1","Alarmas de plataformas"],
    ["2","Documentación de plataformas"],
    ["3","Incidentes activos"],
    ["4","Estado operativo"],
    ["5","Cambios activos"],
    ["6","Hablar con el administrador"],
    ["arreglar alerta", "🔧 Arreglar alerta"],
    ["configurar alerta", "⚙️ Configurar alerta"],
    ["solucion alerta", "💡 Solución de alerta"]
  ];
  const chatBox = document.querySelector(".chat-box");
  let html = '<div class="bot-msg"><b>📋 Menú principal:</b><br>';
  opciones.forEach(([val,text]) => {
    html += `<button class="btn btn-outline-danger btn-sm m-1" onclick="sendOption('${val}')">${text}</button>`;
  });
  html += '</div>';
  chatBox.insertAdjacentHTML("beforeend", html);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Mostrar/ocultar chat
const burbuja = document.querySelector(".burbuja-chat");
const contenedor = document.querySelector(".chat-container");
burbuja.addEventListener("click", () => {
  contenedor.classList.toggle("mostrar");
});

// Cerrar y limpiar al recargar
window.addEventListener("beforeunload", () => {
  localStorage.clear();
});
