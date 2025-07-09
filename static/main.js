window.addEventListener('DOMContentLoaded', () => {
  const burbujaChat  = document.getElementById('burbuja-chat');
  const chatContainer = document.getElementById('chat-container');
  const chatBox      = document.getElementById('chat-box');
  const chatForm     = document.getElementById('chat-form');
  const chatInput    = document.getElementById('chat-input');
  const expandBtn    = document.getElementById('expand-chat');
  const sendBtn      = document.getElementById('send-btn');

  let chatAbierto = false; // Estado del chat
  let menuMostrado = false; // Para evitar duplicación del menú
  let saludoRealizado = false; // Para controlar el saludo inicial
  const userId = 'user_' + Math.random().toString(36).substr(2, 9);

  // Función para mostrar el menú después de 5 segundos
  function mostrarMenu() {
    if (menuMostrado) return; // Evitar duplicados
    const opciones = ` 
      📋 <strong>Opciones disponibles:</strong><br>
      1️⃣ Alarmas de plataformas.<br>
      2️⃣ Documentación de las plataformas.<br>
      3️⃣ Incidentes activos de las plataformas.<br>
      4️⃣ Estado operativo de las plataformas.<br>
      5️⃣ Cambios activos en las plataformas.<br>
      6️⃣ Hablar con el administrador de la plataforma.
    `;
    agregarMensaje(opciones, 'bot');
    menuMostrado = true;
  }

  // Mostrar/Ocultar el chat cuando se hace clic en la burbuja
  function toggleChat() {
  chatAbierto = !chatAbierto;

  if (chatAbierto) {
    // Mostrar el chat
    chatContainer.classList.add('mostrar');
    burbujaChat.style.display = 'none';
    chatInput.focus();

    // Mostrar el mensaje de bienvenida solo la primera vez
    if (!saludoRealizado) {
      setTimeout(() => {
        agregarMensaje("🤖 <strong>Asesor Claro IA activado</strong><br>Sistema de análisis predictivo en línea.<br>¿En qué puedo ayudarte hoy?", 'bot');
        saludoRealizado = true;

        // Mostrar las opciones después de 5 segundos del saludo
        setTimeout(() => {
          mostrarMenu();
        }, 5000);  // Opciones aparecerán después de 5 segundos
      }, 300);
    }
  } else {
    // Ocultar el chat
    chatContainer.classList.remove('mostrar');
    burbujaChat.style.display = 'flex';
    menuMostrado = false;  // Resetear menú al cerrar el chat
  }
}



  // Mostrar el chat expandido
  function toggleExpandChat() {
    chatContainer.classList.toggle('expandido');
    expandBtn.textContent = chatContainer.classList.contains('expandido') ? '⤡' : '⤢';
    // Asegurar que el input se mantenga visible después de expandir
    setTimeout(() => {
      chatInput.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  }

  // Agregar mensajes al chat
  function agregarMensaje(mensaje, tipo = 'bot') {
    const div = document.createElement('div');
    div.className = `${tipo}-msg`;
    div.innerHTML = mensaje.replace(/\n/g, '<br>');
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;

    // Asegurar que el input siga visible
    setTimeout(() => {
      chatInput.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  }

  // Enviar mensaje
  async function enviarMensaje(e) {
    e.preventDefault();
    const texto = chatInput.value.trim();
    if (!texto) return;

    agregarMensaje(texto, 'user');
    chatInput.value = '';
    sendBtn.disabled = true;

    const escribiendo = document.createElement('div');
    escribiendo.className = 'escribiendo';
    escribiendo.innerHTML = '<span></span><span></span><span></span>';
    chatBox.appendChild(escribiendo);
    chatBox.scrollTop = chatBox.scrollHeight;

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
      chatBox.removeChild(escribiendo);
      agregarMensaje(data.response, 'bot');
      
      // NO mostrar opciones automáticamente después de cada respuesta
      // Solo mostrar el menú después del saludo inicial

    } catch (error) {
      if (chatBox.contains(escribiendo)) {
        chatBox.removeChild(escribiendo);
      }
      agregarMensaje('❌ Error de conexión. Inténtalo de nuevo.', 'bot');
    } finally {
      sendBtn.disabled = false;
      chatInput.focus();
      setTimeout(() => {
        chatInput.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 200);
    }
  }

  // Función para enviar acción rápida
  function enviarAccionRapida(texto) {
    chatInput.value = texto;
    chatForm.dispatchEvent(new Event('submit'));
  }

  // Asegurar que el input se mantenga visible al escribir
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });

  // Manejar Enter para enviar
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event('submit'));
    }
  });

  // Eventos principales
  burbujaChat.addEventListener('click', toggleChat);
  expandBtn.addEventListener('click', toggleExpandChat);
  chatForm.addEventListener('submit', enviarMensaje);

  // Función global para acciones rápidas
  window.enviarAccionRapida = enviarAccionRapida;

  // Observador para mantener el input visible
  const observer = new MutationObserver(() => {
    if (chatAbierto && chatBox.children.length > 0) {
      setTimeout(() => {
        chatInput.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    }
  });

  observer.observe(chatBox, { childList: true, subtree: true });

  // Ajustar layout cuando se redimensiona la ventana
  window.addEventListener('resize', () => {
    if (chatAbierto) {
      setTimeout(() => {
        chatInput.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    }
  });

  // Agregar evento al botón de enviar para scroll
  sendBtn.addEventListener('click', () => {
    setTimeout(() => {
      chatBox.scrollTop = chatBox.scrollHeight;
    }, 100);
  });
});