document.addEventListener('DOMContentLoaded', () => {
  // === Referencias DOM ===
  const burbuja   = document.getElementById('burbuja-chat');
  const chat      = document.getElementById('chat-container');
  const expand    = document.getElementById('expand-chat');
  const chatBox   = document.getElementById('chat-box');
  const chatForm  = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');

  // === Estado ===
  let chatAbierto = false;
  // ⬇️  ID único para mantener la sesión en el servidor
  const userId = 'user_' + Math.random().toString(36).substr(2, 9);

  /* ────────────────────────────────
     Muestra el menú principal       */
  function mostrarMenu() {
    const menuHTML = `
      📋 <strong>Opciones disponibles:</strong><br>
      1️⃣ Alarmas de plataformas.<br>
      2️⃣ Documentación de las plataformas.<br>
      3️⃣ Incidentes activos de las plataformas.<br>
      4️⃣ Estado operativo de las plataformas.<br>
      5️⃣ Cambios activos en las plataformas.<br>
      6️⃣ Hablar con el administrador de la plataforma.
    `;
    agregarMensaje(menuHTML, 'bot', 'menu');
  }

  /* ────────────────────────────────
     Abrir / cerrar chat             */
  function toggleChat() {
    chatAbierto = !chatAbierto;
    chat.classList.toggle('mostrar', chatAbierto);
    burbuja.style.display = chatAbierto ? 'none' : 'flex';
    if (chatAbierto) {
      chatInput.focus();
      // Muestra el menú 5 s después de abrir
      setTimeout(mostrarMenu, 5000);
    }
  }

  /* ────────────────────────────────
     Expandir / minimizar contenedor */
  function toggleExpand() {
    chat.classList.toggle('expandido');
    expand.textContent = chat.classList.contains('expandido') ? '⤡' : '⤢';
  }

  /* ────────────────────────────────
     Agrega mensaje al chat          */
  function agregarMensaje(msg, tipo = 'bot', extraClass = '') {
    const div = document.createElement('div');
    div.className = `${tipo}-msg${extraClass ? ' ' + extraClass : ''}`;
    div.innerHTML = msg.replace(/\n/g, '<br>');
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  /* ────────────────────────────────
     Envía mensaje a Flask           */
  async function enviarMensaje(e) {
    e.preventDefault();
    const texto = chatInput.value.trim();
    if (!texto) return;

    agregarMensaje(texto, 'user');
    chatInput.value = '';

    try {
      const res  = await fetch('/chat', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          message : texto,
          user_id : userId,        // 💡 ahora se envía el user_id
          timestamp: Date.now()
        })
      });
      const data = await res.json();
      agregarMensaje(data.response, 'bot');
    } catch (err) {
      agregarMensaje('❌ Error de conexión', 'bot');
    }
  }

  /* ────────────────────────────────
     Acciones rápidas                */
  function enviarAccionRapida(texto) {
    chatInput.value = texto;
    chatForm.dispatchEvent(new Event('submit'));
  }

  // === Eventos ===
  burbuja.addEventListener('click', toggleChat);
  expand.addEventListener('click', toggleExpand);
  chatForm.addEventListener('submit', enviarMensaje);

  // Exponer global
  window.enviarAccionRapida = enviarAccionRapida;
});
