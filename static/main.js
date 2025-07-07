document.addEventListener('DOMContentLoaded', () => {
  /* ─────────────────────────────────────────
     Referencias DOM y estado                */
  const burbuja   = document.getElementById('burbuja-chat');
  const chat      = document.getElementById('chat-container');
  const expand    = document.getElementById('expand-chat');
  const chatBox   = document.getElementById('chat-box');
  const chatForm  = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');

  /* ①  Mantén SIEMPRE el mismo userId en
        todos los fetch → se genera sólo una vez */
  const userId = localStorage.getItem('asesorClaroUserId') ||
                 (() => {
                   const id = 'user_' + Math.random().toString(36).slice(2, 10);
                   localStorage.setItem('asesorClaroUserId', id);
                   return id;
                 })();

  let chatAbierto     = false;
  let timeoutMenuId   = null;   // ← para limpiar el timer

  /* ────────────────────────────────
     Menú principal (HTML)           */
  const menuHtml = `
    📋 <strong>Opciones disponibles:</strong><br>
    1️⃣ Alarmas de plataformas.<br>
    2️⃣ Documentación de las plataformas.<br>
    3️⃣ Incidentes activos de las plataformas.<br>
    4️⃣ Estado operativo de las plataformas.<br>
    5️⃣ Cambios activos en las plataformas.<br>
    6️⃣ Hablar con el administrador de la plataforma.
  `;

  function mostrarMenu() {
    agregarMensaje(menuHtml, 'bot', 'menu');
  }

  /* ────────────────────────────────
     Abrir / cerrar chat             */
  function toggleChat() {
    chatAbierto = !chatAbierto;
    chat.classList.toggle('mostrar', chatAbierto);
    burbuja.style.display = chatAbierto ? 'none' : 'flex';

    /* Limpia cualquier temporizador pendiente
       y arranca uno nuevo sólo cuando se abre */
    clearTimeout(timeoutMenuId);
    if (chatAbierto) {
      chatInput.focus();
      timeoutMenuId = setTimeout(mostrarMenu, 5000);
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
  function agregarMensaje(msg, tipo = 'bot', extra = '') {
    const div = document.createElement('div');
    div.className = `${tipo}-msg${extra ? ' ' + extra : ''}`;
    div.innerHTML = msg;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  /* ────────────────────────────────
     Envía mensaje al backend        */
  async function enviarMensaje(e) {
    e.preventDefault();
    const texto = chatInput.value.trim();
    if (!texto) return;

    agregarMensaje(texto.replace(/\n/g, '<br>'), 'user');
    chatInput.value = '';

    try {
      const res  = await fetch('/chat', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          message  : texto,
          user_id  : userId,      // ② SIEMPRE envía el mismo id
          timestamp: Date.now()
        })
      });
      const data = await res.json();
      agregarMensaje(data.response.replace(/\n/g, '<br>'), 'bot');
    } catch {
      agregarMensaje('❌ Error de conexión', 'bot');
    }
  }

  /* ────────────────────────────────
     Acciones rápidas                */
  function enviarAccionRapida(texto) {
    chatInput.value = texto;
    chatForm.dispatchEvent(new Event('submit'));
  }

  // Eventos
  burbuja.addEventListener('click', toggleChat);
  expand.addEventListener('click',  toggleExpand);
  chatForm.addEventListener('submit', enviarMensaje);
  window.enviarAccionRapida = enviarAccionRapida;
});
