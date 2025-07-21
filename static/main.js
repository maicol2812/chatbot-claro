document.addEventListener('DOMContentLoaded', function() {
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

  function setupEventListeners() {
    // Eventos del chat original
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    elements.burbujaChat.addEventListener('click', toggleChat);
    elements.closeBtn.addEventListener('click', closeChat);

    // Eventos del chat premium
    if (elements.minimizeBtn) elements.minimizeBtn.addEventListener('click', minimizeChat);
    if (elements.maximizeBtn) elements.maximizeBtn.addEventListener('maximizeChat');
    
    // Manejar sugerencias
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('suggestion-btn')) {
        elements.messageInput.value = e.target.textContent;
        sendMessage();
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
    chatState.isOpen = true;
    chatState.isMinimized = false;
    chatState.unreadMessages = 0;
    updateNotification();
    
    elements.chatContainer.classList.add('mostrar');
    elements.burbujaChat.classList.remove('nuevo-mensaje');
    
    // Focus en el input
    setTimeout(() => {
      elements.messageInput.focus();
    }, 300);
    
    // Iniciar conversación si es la primera vez
    if (flujo.paso === 0 && chatState.messageCount === 0) {
      setTimeout(() => flujoExperto(''), 500);
    }
    
    scrollToBottom();
  }

  function closeChat() {
    chatState.isOpen = false;
    elements.chatContainer.classList.remove('mostrar');
  }

  function minimizeChat() {
    chatState.isMinimized = true;
    // Implementar lógica de minimizado si es necesario
  }

  function restoreChat() {
    chatState.isMinimized = false;
    // Implementar lógica de restauración si es necesario
  }

  function maximizeChat() {
    chatState.isMaximized = !chatState.isMaximized;
    // Implementar lógica de maximizado si es necesario
  }

  function showNotification() {
    if (!chatState.isOpen) {
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

  // --------------------------
  // Funciones de manejo de alarmas
  // --------------------------
  function buscarAlarma(id, elemento) {
    showTyping();
    
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
    elements.typingIndicator.style.display = 'flex';
    scrollToBottom();
  }

  function hideTyping() {
    chatState.waitingForResponse = false;
    elements.typingIndicator.style.display = 'none';
  }

  function scrollToBottom() {
    setTimeout(() => {
      elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
    }, 100);
  }

  function sendMessage() {
    const message = elements.messageInput.value.trim();
    if (message.length === 0 || chatState.waitingForResponse) return;
    
    addMessage(message, 'user');
    elements.messageInput.value = '';
    
    // Manejar mensajes de usuario
    if (chatState.currentFlow === 'alarmas') {
      handleAlarmFlow(message);
    } else {
      flujoExperto(message);
    }
  }

  // Inicializar la aplicación
  initialize();
});