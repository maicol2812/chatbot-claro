document.addEventListener('DOMContentLoaded', () => {
  // === Referencias DOM ===
  const burbuja   = document.getElementById('burbuja-chat');
  const chat      = document.getElementById('chat-container');
  const expand    = document.getElementById('expand-chat');
  const chatBox   = document.getElementById('chat-box');
  const chatForm  = document.getElementById('chat-form');
  /// --- NUEVAS VARIABLES
const scrollBtn = document.createElement('button');
scrollBtn.id = 'scroll-bottom-btn';
scrollBtn.innerHTML = '⬇';
document.body.appendChild(scrollBtn);

/// --- OBSERVADOR DE SCROLL
chatBox.addEventListener('scroll', () => {
  // si no estamos al fondo, se muestra el botón
  const resto = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight;
  scrollBtn.style.display = resto > 150 ? 'flex' : 'none';
});
scrollBtn.onclick = () => {
  chatBox.scrollTo({top: chatBox.scrollHeight, behavior:'smooth'});
};

/// --- GUARDA / CARGA HISTORIAL
function saveHist() {
  localStorage.setItem('histChat', chatBox.innerHTML);
}
function loadHist(){
  const h = localStorage.getItem('histChat');
  if (h) chatBox.innerHTML = h;
}
loadHist();

function agregarMensaje(msg, clase='bot'){
  /* …tu código… */
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  saveHist();
}


  // === Estado ===
  let chatAbierto = false;

  /* ─────────────────────────────────────────
     Función para mostrar el menú principal  */
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

  /* ─────────────────────────────────────────
     Abrir / cerrar el chat                 */
  function toggleChat() {
    chatAbierto = !chatAbierto;
    chat.classList.toggle('mostrar', chatAbierto);
    burbuja.style.display = chatAbierto ? 'none' : 'flex';
    if (chatAbierto) {
      chatInput.focus();
      // Muestra el menú después de 5 s cada vez que se abre el chat
      setTimeout(mostrarMenu, 5000);
    }
  }

  /* ─────────────────────────────────────────
     Expandir / minimizar el contenedor      */
  function toggleExpand() {
    chat.classList.toggle('expandido');
    expand.textContent = chat.classList.contains('expandido') ? '⤡' : '⤢';
  }

  /* ─────────────────────────────────────────
     Agrega mensaje al chat                  */
  function agregarMensaje(msg, tipo = 'bot', extraClass = '') {
    const div = document.createElement('div');
    div.className = `${tipo}-msg${extraClass ? ' ' + extraClass : ''}`;
    div.innerHTML = msg.replace(/\n/g, '<br>');
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  /* ─────────────────────────────────────────
     Envía mensaje al backend Flask          */
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
        body   : JSON.stringify({ message: texto })
      });
      const data = await res.json();
      agregarMensaje(data.response, 'bot');
    } catch (err) {
      agregarMensaje('❌ Error de conexión', 'bot');
    }
  }

  /* ─────────────────────────────────────────
     Acciones rápidas                        */
  function enviarAccionRapida(texto) {
    chatInput.value = texto;
    chatForm.dispatchEvent(new Event('submit'));
  }

  // === Eventos ===
  burbuja.addEventListener('click', toggleChat);
  expand.addEventListener('click', toggleExpand);
  chatForm.addEventListener('submit', enviarMensaje);

  // Exponer al global para los botones rápidos
  window.enviarAccionRapida = enviarAccionRapida;
});
