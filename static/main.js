document.addEventListener('DOMContentLoaded', () => {
  const burbuja = document.getElementById('burbuja-chat');
  const chat = document.getElementById('chat-container');
  const expand = document.getElementById('expand-chat');
  const chatBox = document.getElementById('chat-box');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');

  let abierto = false;

  function toggleChat() {
    abierto = !abierto;
    chat.classList.toggle('mostrar', abierto);
    burbuja.style.display = abierto ? 'none' : 'flex';
    if (abierto) chatInput.focus();
  }

  function toggleExpand() {
    chat.classList.toggle('expandido');
    expand.textContent = chat.classList.contains('expandido') ? '⤡' : '⤢';
  }

  function agregarMensaje(msg, clase = 'bot') {
    const div = document.createElement('div');
    div.className = clase + '-msg';
    div.innerHTML = msg.replace(/\n/g, '<br>');
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  async function enviarMensaje(e) {
    e.preventDefault();
    const texto = chatInput.value.trim();
    if (!texto) return;
    agregarMensaje(texto, 'user');
    chatInput.value = '';

    try {
      const res = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: texto })
      });
      const data = await res.json();
      agregarMensaje(data.response, 'bot');
    } catch (err) {
      agregarMensaje('❌ Error de conexión', 'bot');
    }
  }

  function enviarAccionRapida(texto) {
    chatInput.value = texto;
    chatForm.dispatchEvent(new Event('submit'));
  }

  // Eventos
  burbuja.addEventListener('click', toggleChat);
  expand.addEventListener('click', toggleExpand);
  chatForm.addEventListener('submit', enviarMensaje);
  window.enviarAccionRapida = enviarAccionRapida;
});
