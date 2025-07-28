document.addEventListener('DOMContentLoaded', function() {
 
  const urlParams = new URLSearchParams(window.location.search);
  

  // --------------------------
  // Configuración inicial
  // --------------------------
  const elements = {
    // Elementos del chat original
    chatContainer: document.getElementById('chat-container'),
    burbujaChat: document.getElementById('burbuja-chat'),
    closeBtn: document.getElementById('close-chat'),
    chatBox: document.getElementById('chat-box'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    typingIndicator: document.getElementById('typing-indicator'),
    suggestionsContainer: document.querySelector('.suggestions-container'),

    // Elementos del nuevo chat premium
    welcomeScreen: document.getElementById('welcome-screen'),
    bubbleNotification: document.getElementById('bubble-notification'),
    minimizeBtn: document.getElementById('minimize-chat'),
    maximizeBtn: document.getElementById('maximize-chat')
  };

  // Estados combinados
  const chatState = {
    isOpen: false,
    isMinimized: false,
    isMaximized: false,
    waitingForResponse: false,
    currentFlow: null,
    alarmData: null,
    messageCount: 0,
    unreadMessages: 0
  };

  // Flujo de conversación
  let flujo = { paso: 0, alarmaId: '', elemento: '' };

  // --------------------------
  // Funciones de inicialización
  // --------------------------
  function initialize() {
    setupEventListeners();
    handleWelcomeScreen();

    if (urlParams.has('volver') && urlParams.get('volver') === 'chat') {
      openChat();
      setTimeout(() => {
        addMessage('👋 ¡Bienvenido de nuevo! ¿En qué más puedo ayudarte?', 'bot');
      }, 300);
    } else {
      setTimeout(() => {
        if (!chatState.isOpen) {
          showNotification();
        }
      }, 10000);
    }
  }

  function setupEventListeners() {
    if (elements.sendBtn) {
      elements.sendBtn.addEventListener('click', sendMessage);
    }

    if (elements.messageInput) {
      elements.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
      });
    }

    if (elements.burbujaChat) {
      elements.burbujaChat.addEventListener('click', toggleChat);
    }

    if (elements.closeBtn) {
      elements.closeBtn.addEventListener('click', closeChat);
    }

    if (elements.minimizeBtn) {
      elements.minimizeBtn.addEventListener('click', minimizeChat);
    }

    if (elements.maximizeBtn) {
      elements.maximizeBtn.addEventListener('click', maximizeChat);
    }

    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('suggestion-btn')) {
        if (elements.messageInput) {
          elements.messageInput.value = e.target.textContent;
          sendMessage();
        }
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && chatState.isOpen) {
        closeChat();
      }
    });

    // Interacción de like para alarmas
    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('like-btn')) {
        const alarmaId = e.target.getAttribute('data-alarma-id');
        let likedAlarmas = JSON.parse(localStorage.getItem('likedAlarmas') || '{}');
        if (e.target.classList.contains('liked')) {
          e.target.classList.remove('liked');
          delete likedAlarmas[alarmaId];
        } else {
          e.target.classList.add('liked');
          likedAlarmas[alarmaId] = true;
        }
        localStorage.setItem('likedAlarmas', JSON.stringify(likedAlarmas));
      }
    });
  }

  function handleWelcomeScreen() {
    if (!elements.welcomeScreen) return;

    setTimeout(() => {
      elements.welcomeScreen.style.opacity = '0';
      elements.welcomeScreen.style.transform = 'scale(0.95)';

      setTimeout(() => {
        elements.welcomeScreen.remove();
        showNotification();
      }, 1200);
    }, 3000);
  }

  // --------------------------
  // Funciones de UI del chat
  // --------------------------
  function toggleChat() {
    if (chatState.isOpen) {
      if (chatState.isMinimized) {
        restoreChat();
        localStorage.setItem('chatState', 'open');
      } else {
        closeChat();
        localStorage.setItem('chatState', 'closed');
      }
    } else {
      openChat();
      localStorage.setItem('chatState', 'open');
      chatState.unreadMessages = 0;
      updateNotification();
    }
  }

  function openChat() {
    chatState.isOpen = true;
    chatState.isMinimized = false;
    chatState.unreadMessages = 0;
    updateNotification();
    
    // Asegúrate de que el chat sea visible
    if (elements.chatContainer) {
      elements.chatContainer.style.display = 'flex';
      elements.chatContainer.classList.add('mostrar');
    }

    if (elements.burbujaChat) {
      elements.burbujaChat.classList.remove('nuevo-mensaje');
    }

    setTimeout(() => {
      if (elements.messageInput) {
        elements.messageInput.focus();
      }
    }, 300);

    // Iniciar flujo solo si es la primera vez
    if (flujo.paso === 0 && chatState.messageCount === 0) {
      setTimeout(() => flujoExperto(''), 500);
    }

    scrollToBottom();
  }

  function closeChat() {
    chatState.isOpen = false;
    if (elements.chatContainer) {
      elements.chatContainer.style.display = 'none';
      elements.chatContainer.classList.remove('mostrar');
    }
  }

  function minimizeChat() {
    chatState.isMinimized = true;
    if (elements.chatContainer) {
      elements.chatContainer.style.height = '60px';
    }
  }

  function restoreChat() {
    chatState.isMinimized = false;
    if (elements.chatContainer) {
      elements.chatContainer.style.height = 'auto';
    }
  }

  function maximizeChat() {
    chatState.isMaximized = !chatState.isMaximized;
  }

  function showNotification() {
    if (!chatState.isOpen && elements.burbujaChat) {
      elements.burbujaChat.classList.add('nuevo-mensaje');
      chatState.unreadMessages++;
      updateNotification();
    }
  }

  function updateNotification() {
    if (elements.bubbleNotification) {
      if (chatState.unreadMessages > 0) {
        elements.bubbleNotification.textContent =
          chatState.unreadMessages > 9 ? '9+' : chatState.unreadMessages;
        elements.bubbleNotification.style.display = 'flex';
      } else {
        elements.bubbleNotification.style.display = 'none';
      }
    }
  }

  // --------------------------
  // Funciones del flujo de conversación
  // --------------------------
  function flujoExperto(message) {
    if (flujo.paso === 0) {
      addMessage(`Buen día, hablemos de nuestras plataformas de Core.`, 'bot');
      setTimeout(() => {
        addMessage(`¿Qué te gustaría consultar el día de hoy:<br><br>
          1. Alarmas de plataformas.<br>
          2. Documentación de las plataformas.<br>
          3. Incidentes activos de las plataformas.<br>
          4. Estado operativo de las plataformas.<br>
          5. Cambios activos en las plataformas.<br>
          6. Hablar con el administrador de la plataforma.`, 'bot');
        flujo.paso = 1;
      }, 1000);
    } else if (flujo.paso === 1) {
      handleMainOption(message);
    } else if (flujo.paso === 2) {
      flujo.alarmaId = message;
      addMessage('Por favor ingresa el nombre del elemento que reporta la alarma:', 'bot');
      flujo.paso = 3;
    } else if (flujo.paso === 3) {
      flujo.elemento = message;
      buscarAlarma(flujo.alarmaId, flujo.elemento);
      flujo.paso = 0;
    }
  }

  function handleMainOption(message) {
    switch (message) {
      case '1':
        addMessage('Por favor ingresa el número de alarma que deseas consultar:', 'bot');
        flujo.paso = 2;
        break;
      case '2': showDocumentation(); break;
      case '3': showIncidentes(); break;
      case '4': showEstadoOperativo(); break;
      case '5': showCambiosActivos(); break;
      case '6': showContactoAdmin(); break;
      default:
        addMessage('Por favor selecciona una opción válida del 1 al 6.', 'bot');
    }
  }

  // --------------------------
  // Funciones de manejo de alarmas
  // --------------------------
  function buscarAlarma(id, elemento) {
    showTyping();

    const datosSimulados = {
      Severidad: "CRÍTICA",
      Elemento: elemento,
      Fecha: new Date().toLocaleString(),
      Descripción: `Alarma #${id} - Falla crítica en ${elemento}`,
      Significado: "Se ha detectado una interrupción en el servicio que requiere atención inmediata",
      Acciones: "1. Verificar conectividad • 2. Reiniciar servicios • 3. Contactar soporte técnico • 4. Escalar si persiste"
    };

    setTimeout(() => {
      hideTyping();
      localStorage.setItem('alarmaDetalle', JSON.stringify(datosSimulados));
      addMessage(`✅ Alarma encontrada: ${datosSimulados.Severidad} en ${datosSimulados.Elemento}`, 'bot');
      addMessage('Redirigiendo a detalle completo...', 'bot');
      setTimeout(() => {
        window.location.href = `detalle_alarma.html?volver=chat`;
      }, 1500);
    }, 2000);
  }

  // --------------------------
  // Funciones del bot
  // --------------------------
  function showDocumentation() {
    showTyping();
    setTimeout(() => {
      hideTyping();
      addMessage(`
        <strong>📚 Documentación disponible:</strong>
        <div class="suggestions-container">
          <button class="suggestion-btn">Manual técnico</button>
          <button class="suggestion-btn">Guías de configuración</button>
          <button class="suggestion-btn">Procedimientos</button>
        </div>
      `, 'bot');
      flujo.paso = 0;
    }, 1000);
  }

  function showIncidentes() {
    showTyping();
    setTimeout(() => {
      hideTyping();
      addMessage('🚨 Incidentes activos:<br>- Caída parcial en Nodo Central<br>- Latencia elevada en enlace internacional', 'bot');
      flujo.paso = 0;
    }, 1000);
  }

  function showEstadoOperativo() {
    showTyping();
    setTimeout(() => {
      hideTyping();
      addMessage('✅ Estado operativo:<br>- Core Voz: Estable<br>- Core Datos: Mantenimiento<br>- Plataforma 5G: Degradado', 'bot');
      flujo.paso = 0;
    }, 1000);
  }

  function showCambiosActivos() {
    showTyping();
    setTimeout(() => {
      hideTyping();
      addMessage('🛠 Cambios programados:<br>- Actualización firmware (00:00-02:00)<br>- Migración base de datos (Sábado 22:00)', 'bot');
      flujo.paso = 0;
    }, 1000);
  }

  function showContactoAdmin() {
    showTyping();
    setTimeout(() => {
      hideTyping();
      addMessage('👨‍💻 Contacta al administrador:<br>- Teams: equipo_operaciones@empresa.com<br>- Teléfono: +34 912 345 678', 'bot');
      flujo.paso = 0;
    }, 1000);
  }

  // --------------------------
  // Utilidades
  // --------------------------
  function addMessage(text, sender) {
    if (!elements.chatBox) return;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `${sender}-msg`;
    msgDiv.innerHTML = text;
    elements.chatBox.appendChild(msgDiv);

    msgDiv.style.opacity = '0';
    msgDiv.style.transform = 'translateY(10px)';
    setTimeout(() => {
      msgDiv.style.transition = 'all 0.3s ease';
      msgDiv.style.opacity = '1';
      msgDiv.style.transform = 'translateY(0)';
    }, 10);

    scrollToBottom();

    chatState.messageCount++;
    if (sender === 'bot' && !chatState.isOpen) {
      chatState.unreadMessages++;
      updateNotification();
    }
  }

  function showTyping() {
    chatState.waitingForResponse = true;
    if (elements.typingIndicator) {
      elements.typingIndicator.style.display = 'flex';
    }
    scrollToBottom();
  }

  function hideTyping() {
    chatState.waitingForResponse = false;
    if (elements.typingIndicator) {
      elements.typingIndicator.style.display = 'none';
    }
  }

  function scrollToBottom() {
    if (elements.chatBox) {
      setTimeout(() => {
        elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
      }, 100);
    }
  }

  function sendMessage() {
    if (!elements.messageInput) return;
    
    const message = elements.messageInput.value.trim();
    if (message.length === 0 || chatState.waitingForResponse) return;

    addMessage(message, 'user');
    elements.messageInput.value = '';

    // Siempre usar flujoExperto para manejar la conversación
    flujoExperto(message);
  }

  initialize();
});