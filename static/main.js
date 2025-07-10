window.addEventListener('DOMContentLoaded', () => {
  const burbujaChat  = document.getElementById('burbuja-chat');
  const chatContainer = document.getElementById('chat-container');
  const chatBox      = document.getElementById('chat-box');
  const chatForm     = document.getElementById('chat-form');
  const chatInput    = document.getElementById('chat-input');
  const expandBtn    = document.getElementById('expand-chat');
  const sendBtn      = document.getElementById('send-btn');
  const accionesRapidas = document.querySelector('.acciones-rapidas');

  let chatAbierto = false;
  let saludoMostrado = false;
  const userId = 'user_' + Math.random().toString(36).substr(2, 9);

  function mostrarMenu() {
    const opciones = `
      📋 <strong>Opciones disponibles:</strong><br>
      1️⃣ Alarmas de plataformas.<br>
      2️⃣ Documentación de las plataformas.<br>
      3️⃣ Incidentes activos de las plataformas.<br>
      4️⃣ Estado operativo de las plataformas.<br>
      5️⃣ Cambios activos en las plataformas.<br>
      6️⃣ Hablar con el administrador de la plataforma.`;
    agregarMensaje(opciones, 'bot');
    accionesRapidas.style.display = 'flex';
  }

  function toggleChat() {
    chatAbierto = !chatAbierto;
    chatContainer.classList.toggle('mostrar', chatAbierto);
    burbujaChat.style.display = chatAbierto ? 'none' : 'flex';

    if (chatAbierto && !saludoMostrado) {
      saludoMostrado = true;
      const saludo = `🤖 <strong>Asesor Claro IA activado</strong><br>Sistema de análisis predictivo en línea.<br>¿En qué puedo ayudarte hoy?`;
      agregarMensaje(saludo, 'bot');
      setTimeout(mostrarMenu, 3000);
    }
  }

  function agregarMensaje(mensaje, tipo = 'bot') {
    const div = document.createElement('div');
    div.className = `${tipo}-msg`;
    div.innerHTML = mensaje.replace(/\n/g, '<br>');
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  async function enviarMensaje(e) {
    e.preventDefault();
    const texto = chatInput.value.trim();
    if (!texto) return;

    agregarMensaje(texto, 'user');
    chatInput.value = '';
    sendBtn.disabled = true;

    try {
      const res = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: texto,
          user_id: userId,
          timestamp: Date.now()
        })
      });
      const data = await res.json();
      agregarMensaje(data.response, 'bot');
    } catch (error) {
      agregarMensaje('❌ Error de conexión.', 'bot');
    } finally {
      sendBtn.disabled = false;
    }
  }

  burbujaChat.addEventListener('click', toggleChat);
  chatForm.addEventListener('submit', enviarMensaje);
});
