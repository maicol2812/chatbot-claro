window.addEventListener('DOMContentLoaded', () => {
  const burbujaChat = document.getElementById('burbuja-chat');
  const chatContainer = document.getElementById('chat-container');
  const chatBox = document.getElementById('chat-box');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const expandBtn = document.getElementById('expand-chat');
  const sendBtn = document.getElementById('send-btn');

  sendBtn.addEventListener('click', () => {
    chatBox.scrollTop = chatBox.scrollHeight; // Asegurarse de que el chat siempre se desplace hacia abajo
  });

  let chatAbierto = false;
  let menuMostrado = false;
  const userId = 'user_' + Math.random().toString(36).substr(2, 9);

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

  function toggleChat() {
    chatAbierto = !chatAbierto;
    chatContainer.classList.toggle('mostrar', chatAbierto);
    burbujaChat.style.display = chatAbierto ? 'none' : 'flex';  // Cambia la visibilidad del ícono del chat

    if (chatAbierto) {
      // Si el chat se abre, automáticamente mueve el foco al input
      document.getElementById('chat-input').focus();
      
      // Mostrar menú inmediatamente si el chat está vacío
      if (!chatBox.innerText.trim()) {
        // Pequeño delay para que se vea la animación de apertura
        setTimeout(() => {
          mostrarMenu();
        }, 300);
      }
    } else {
      // Resetear cuando se cierre el chat
      menuMostrado = false;
    }
  }

  function toggleExpandChat() {
    chatContainer.classList.toggle('expandido');
    expandBtn.textContent = chatContainer.classList.contains('expandido') ? '⤡' : '⤢';
    
    // Asegurar que el input siga siendo visible después de expandir
    setTimeout(() => {
      chatInput.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  }

  function agregarMensaje(mensaje, tipo = 'bot') {
    const div = document.createElement('div');
    div.className = `${tipo}-msg`;
    div.innerHTML = mensaje.replace(/\n/g, '<br>');
    chatBox.appendChild(div);
    
    // Scroll suave al final
    chatBox.scrollTop = chatBox.scrollHeight;
    
    // Asegurar que el input siga visible
    setTimeout(() => {
      chatInput.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  }

  async function enviarMensaje(e) {
    e.preventDefault();
    const texto = chatInput.value.trim();
    if (!texto) return;

    agregarMensaje(texto, 'user');
    chatInput.value = '';
    sendBtn.disabled = true;

    // Mostrar indicador de escritura
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
      
      // Remover indicador de escritura
      chatBox.removeChild(escribiendo);
      
      agregarMensaje(data.response, 'bot');

      // Mostrar las opciones después de 5 segundos
      setTimeout(() => {
        mostrarMenu();
      }, 5000);

    } catch (error) {
      // Remover indicador de escritura
      if (chatBox.contains(escribiendo)) {
        chatBox.removeChild(escribiendo);
      }
      agregarMensaje('❌ Error de conexión. Inténtalo de nuevo.', 'bot');
    } finally {
      sendBtn.disabled = false;
      chatInput.focus();
      
      // Asegurar que el botón de envío esté visible
      setTimeout(() => {
        chatInput.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 200);
    }
  }

  function enviarAccionRapida(texto) {
    chatInput.value = texto;
    chatForm.dispatchEvent(new Event('submit'));
  }

  // Asegurar que el input se mantenga visible al escribir
  chatInput.addEventListener('input', () => {
    // Auto-resize del input si es necesario
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
});

// Función adicional para mantener el botón siempre visible
function asegurarInputVisible() {
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }
}

// Exportar función para uso externo si es necesario
window.asegurarInputVisible = asegurarInputVisible;
