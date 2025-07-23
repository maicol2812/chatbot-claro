document.addEventListener('DOMContentLoaded', function() {
  // Verificar elementos críticos
  const requiredElements = ['chat-container', 'message-input', 'send-btn'];
  const missingElements = requiredElements.filter(id => !document.getElementById(id));
  
  if (missingElements.length > 0) {
    console.error('Elementos faltantes:', missingElements);
    // Crear elementos faltantes o mostrar error
    createMissingElements();
    return;
  }
  
  // Resto de tu código...
    console.log('Todos los elementos necesarios están presentes, continuando con la inicialización...');
  // --------------------------
  // Configuración inicial
  // --------------------------
  const elements = {
    // Chat container principal
    chatContainer: document.getElementById('chat-container') || document.querySelector('.chat-window'),
    burbujaChat: document.getElementById('chat-bubble'),
    closeBtn: document.getElementById('close-chat'),
    chatBox: document.getElementById('chat-messages'),
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

  // Estados del chat
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
    console.log('Inicializando chatbot...');
    setupEventListeners();
    handleWelcomeScreen();
    
    // Crear elementos faltantes si no existen
    createMissingElements();
    
    // Mantener chat abierto al volver de detalle_alarma.html
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('volver') && urlParams.get('volver') === 'chat') {
      openChat();
      setTimeout(() => {
        addMessage('👋 ¡Bienvenido de nuevo! ¿En qué más puedo ayudarte?', 'bot');
      }, 300);
    } else {
      // Notificación después de 10 segundos
      setTimeout(() => {
        if (!chatState.isOpen) {
          showNotification();
        }
      }, 10000);
    }
  }

  function createMissingElements() {
    // Crear chat container si no existe
    if (!elements.chatContainer) {
      const chatWindow = document.createElement('div');
      chatWindow.className = 'chat-window';
      chatWindow.id = 'chat-container';
      document.body.appendChild(chatWindow);
      elements.chatContainer = chatWindow;
    }

    // Crear chat messages container si no existe
    if (!elements.chatBox) {
      const messagesDiv = document.createElement('div');
      messagesDiv.className = 'chat-messages';
      messagesDiv.id = 'chat-messages';
      elements.chatContainer.appendChild(messagesDiv);
      elements.chatBox = messagesDiv;
    }
  }

  function setupEventListeners() {
    console.log('Configurando event listeners...');
    
    // Eventos básicos del chat
    if (elements.sendBtn) {
      elements.sendBtn.addEventListener('click', sendMessage);
    }

    if (elements.messageInput) {
      elements.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }

    if (elements.burbujaChat) {
      elements.burbujaChat.addEventListener('click', toggleChat);
    }

    if (elements.closeBtn) {
      elements.closeBtn.addEventListener('click', closeChat);
    }

    // Eventos del chat premium
    if (elements.minimizeBtn) {
      elements.minimizeBtn.addEventListener('click', minimizeChat);
    }
    
    if (elements.maximizeBtn) {
      elements.maximizeBtn.addEventListener('click', maximizeChat);
    }
    
    // Manejar botones de acción
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('suggestion-btn')) {
        if (elements.messageInput) {
          elements.messageInput.value = e.target.textContent;
          sendMessage();
        }
      }

      if (e.target.classList.contains('action-btn')) {
        const action = e.target.getAttribute('data-action');
        handleActionButton(action);
      }
    });

    // Escape key para cerrar
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && chatState.isOpen) {
        closeChat();
      }
    });
  }

  function handleWelcomeScreen() {
    if (!elements.welcomeScreen) return;
    
    // Simular carga
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
    console.log('Toggle chat - Estado actual:', chatState.isOpen);
    if (chatState.isOpen) {
      if (chatState.isMinimized) {
        restoreChat();
      } else {
        closeChat();
      }
    } else {
      openChat();
    }
  }

  function openChat() {
    console.log('Abriendo chat...');
    chatState.isOpen = true;
    chatState.isMinimized = false;
    chatState.unreadMessages = 0;
    updateNotification();
    
    if (elements.chatContainer) {
      elements.chatContainer.classList.add('mostrar');
      elements.chatContainer.style.display = 'flex';
      elements.chatContainer.style.transform = 'translateY(0) scale(1)';
      elements.chatContainer.style.opacity = '1';
    }
    
    if (elements.burbujaChat) {
      elements.burbujaChat.classList.remove('nuevo-mensaje');
    }
    
    // Focus en el input
    setTimeout(() => {
      if (elements.messageInput) {
        elements.messageInput.focus();
      }
    }, 300);
    
    // Iniciar conversación si es la primera vez
    if (flujo.paso === 0 && chatState.messageCount === 0) {
      setTimeout(() => flujoExperto(''), 500);
    }
    
    scrollToBottom();
  }

  function closeChat() {
    console.log('Cerrando chat...');
    chatState.isOpen = false;
    
    if (elements.chatContainer) {
      elements.chatContainer.classList.remove('mostrar');
      elements.chatContainer.style.transform = 'translateY(100%) scale(0.8)';
      elements.chatContainer.style.opacity = '0';
    }
  }

  function minimizeChat() {
    chatState.isMinimized = true;
    console.log('Chat minimizado');
  }

  function restoreChat() {
    chatState.isMinimized = false;
    console.log('Chat restaurado');
  }

  function maximizeChat() {
    chatState.isMaximized = !chatState.isMaximized;
    console.log('Chat maximizado:', chatState.isMaximized);
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
    console.log('Flujo experto - Paso:', flujo.paso, 'Mensaje:', message);
    
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
    switch (message.trim()) {
      case '1':
        addMessage('Por favor ingresa el número de alarma que deseas consultar:', 'bot');
        flujo.paso = 2;
        break;
      case '2':
        showDocumentation();
        break;
      case '3':
        showIncidentes();
        break;
      case '4':
        showEstadoOperativo();
        break;
      case '5':
        showCambiosActivos();
        break;
      case '6':
        showContactoAdmin();
        break;
      default:
        addMessage('Por favor selecciona una opción válida del 1 al 6.', 'bot');
    }
  }

  function handleActionButton(action) {
    switch (action) {
      case 'alarmas':
        if (elements.messageInput) {
          elements.messageInput.value = '1';
          sendMessage();
        }
        break;
      case 'documentacion':
        if (elements.messageInput) {
          elements.messageInput.value = '2';
          sendMessage();
        }
        break;
      case 'incidentes':
        if (elements.messageInput) {
          elements.messageInput.value = '3';
          sendMessage();
        }
        break;
    }
  }

  // --------------------------
  // Funciones de manejo de alarmas
  // --------------------------
  function buscarAlarma(id, elemento) {
    showTyping();
    
    console.log('Buscando alarma:', id, elemento);
    
    // Simular datos de alarma para pruebas
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
      
      // Guardar datos simulados para detalle_alarma.html
      localStorage.setItem('alarmaDetalle', JSON.stringify(datosSimulados));
      
      addMessage(`✅ Alarma encontrada: ${datosSimulados.Severidad} en ${datosSimulados.Elemento}`, 'bot');
      addMessage('Redirigiendo a detalle completo...', 'bot');
      
      // Redirigir manteniendo parámetro para volver al chat
      setTimeout(() => {
        window.location.href = `detalle_alarma.html?volver=chat`;
      }, 1500);
    }, 2000);
  }

  // --------------------------
  // Funciones de respuesta del bot
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
  // Funciones de utilidad
  // --------------------------
  function addMessage(text, sender) {
    if (!elements.chatBox) {
      console.error('Chat box no encontrado');
      return;
    }

    const msgDiv = document.createElement('div');
    msgDiv.className = `${sender}-msg`;
    msgDiv.innerHTML = text;
    elements.chatBox.appendChild(msgDiv);
    
    // Animación de entrada
    msgDiv.style.opacity = '0';
    msgDiv.style.transform = 'translateY(10px)';
    setTimeout(() => {
      msgDiv.style.transition = 'all 0.3s ease';
      msgDiv.style.opacity = '1';
      msgDiv.style.transform = 'translateY(0)';
    }, 10);
    
    scrollToBottom();
    
    // Actualizar contador de mensajes
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
    setTimeout(() => {
      if (elements.chatBox) {
        elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
      }
    }, 100);
  }

  function sendMessage() {
    if (!elements.messageInput) {
      console.error('Input de mensaje no encontrado');
      return;
    }

    const message = elements.messageInput.value.trim();
    if (message.length === 0 || chatState.waitingForResponse) return;
    
    console.log('Enviando mensaje:', message);
    
    addMessage(message, 'user');
    elements.messageInput.value = '';
    
    // Manejar mensajes de usuario
    setTimeout(() => {
      if (chatState.currentFlow === 'alarmas') {
        handleAlarmFlow(message);
      } else {
        flujoExperto(message);
      }
    }, 300);
  }

  function handleAlarmFlow(message) {
    // Lógica específica para flujo de alarmas
    console.log('Manejando flujo de alarmas:', message);
  }

  // --------------------------
  // API Calls (si es necesario)
  // --------------------------
  async function fetchFromAPI(endpoint, data) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      console.error('Error en API:', error);
      return null;
    }
  }

  // --------------------------
  // Inicializar la aplicación
  // --------------------------
  console.log('DOM cargado, inicializando...');
  initialize();

  // Exponer funciones globales si es necesario
  window.chatbot = {
    openChat,
    closeChat,
    addMessage,
    sendMessage
  };
});