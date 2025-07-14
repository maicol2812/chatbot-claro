// ========= CONFIGURACIÓN DEL SISTEMA =========
const EMERGENCY_KEYWORDS = ['emergencia', 'urgente', 'ayuda', 'error', 'falla', 'crítico', 'alarma'];

document.addEventListener('DOMContentLoaded', () => {
  // ========= CONFIGURACIÓN =========
  const config = {
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 8000,
    inactivityTimeout: 300000, // 5 minutos
    typingDuration: 1500,
    welcomeDelay: 3000,
    menuDelay: 5000
  };

  // ========= ELEMENTOS DOM =========
  const elements = {
    chatBubble: document.getElementById('chat-bubble'),
    chatContainer: document.getElementById('chat-container'),
    chatMessages: document.getElementById('chat-messages'),
    chatForm: document.getElementById('chat-form'),
    chatInput: document.getElementById('chat-input'),
    sendBtn: document.getElementById('send-btn'),
    expandBtn: document.getElementById('expand-chat'),
    statusIndicator: document.getElementById('status-indicator'),
    statusText: document.getElementById('status-text'),
    aiIndicator: document.getElementById('ai-indicator'),
    metricsOverlay: document.getElementById('metrics-overlay'),
    metricsContent: document.getElementById('metrics-content'),
    notificationsContainer: document.getElementById('notifications-container')
  };

  // ========= ESTADO DEL SISTEMA =========
  const state = {
    isOpen: false,
    isExpanded: false,
    isTyping: false,
    isEmergency: false,
    userId: generateUserId(),
    lastActivity: Date.now(),
    messageQueue: [],
    conversationStarted: false,
    metrics: {
      messagesSent: 0,
      alarmsChecked: 0,
      emergencies: 0,
      satisfaction: 4.5,
      responseTime: 0,
      sessionsToday: 1
    }
  };

  // ========= INICIALIZACIÓN =========
  initEventListeners();
  initParticles();
  startInactivityCheck();
  updateSystemStatus();
  
  // Actualizar tiempo cada segundo
  setInterval(() => {
    updateCurrentTime();
    updateSystemStatus();
  }, 1000);

  // ========= EVENT LISTENERS =========
  function initEventListeners() {
    // Chat controls
    elements.chatBubble.addEventListener('click', toggleChat);
    elements.chatForm.addEventListener('submit', handleSubmit);
    elements.chatInput.addEventListener('input', handleInput);
    elements.chatInput.addEventListener('keypress', handleKeyPress);
    elements.expandBtn.addEventListener('click', expandChat);
    
    // Double click para métricas
    elements.chatBubble.addEventListener('dblclick', showMetrics);
    
    // Cerrar métricas al hacer click fuera
    elements.metricsOverlay.addEventListener('click', (e) => {
      if (e.target === elements.metricsOverlay) {
        closeMetrics();
      }
    });
    
    // Prevenir cierre accidental
    window.addEventListener('beforeunload', (e) => {
      if (state.isOpen) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  // ========= FUNCIONES PRINCIPALES =========
  function toggleChat() {
    state.isOpen = !state.isOpen;
    elements.chatContainer.classList.toggle('mostrar', state.isOpen);
    elements.chatBubble.style.display = state.isOpen ? 'none' : 'flex';
    
    if (state.isOpen) {
      elements.chatInput.focus();
      updateLastActivity();
      if (!state.conversationStarted) {
        startConversation();
      }
    } else {
      // Limpiar estados al cerrar
      state.isTyping = false;
      state.messageQueue = [];
    }
  }

  function expandChat() {
    state.isExpanded = !state.isExpanded;
    elements.chatContainer.classList.toggle('expandido', state.isExpanded);
    elements.expandBtn.textContent = state.isExpanded ? '⤡' : '⤢';
    scrollToBottom();
  }

  function startConversation() {
    state.conversationStarted = true;
    
    // Mensaje de bienvenida
    setTimeout(() => {
      addMessage(getWelcomeMessage(), 'bot', 'welcome');
    }, 1000);
    
    // Menú automático después del saludo
    setTimeout(() => {
      if (state.isOpen) {
        addMessage(getMenuMessage(), 'bot', 'system');
      }
    }, config.menuDelay);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const message = elements.chatInput.value.trim();
    if (!message || state.isTyping) return;

    // Añadir mensaje del usuario
    addMessage(message, 'user');
    elements.chatInput.value = '';
    state.metrics.messagesSent++;
    updateLastActivity();

    // Procesar mensaje
    await processMessage(message);
  }

  function handleInput(e) {
    updateLastActivity();
    
    // Auto-completar comandos
    const value = e.target.value.toLowerCase();
    if (value.startsWith('/')) {
      showCommandSuggestions(value);
    }
  }

  function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      elements.chatForm.dispatchEvent(new Event('submit'));
    }
  }

  // ========= PROCESAMIENTO DE MENSAJES =========
  async function processMessage(message, retryCount = 0) {
    const startTime = Date.now();
    
    // Verificar comandos locales primero
    if (handleLocalCommands(message)) {
      return;
    }
    
    showTyping();
    
    try {
      const isEmergency = checkEmergency(message);
      
      const response = await fetchWithTimeout('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          user_id: state.userId,
          isEmergency,
          timestamp: new Date().toISOString(),
          sessionData: getSessionData()
        })
      }, config.timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      hideTyping();
      
      // Calcular tiempo de respuesta
      const responseTime = Date.now() - startTime;
      state.metrics.responseTime = responseTime;
      
      // Manejar respuesta
      handleBotResponse(data);
      
      // Procesar cola de mensajes
      if (state.messageQueue.length > 0) {
        const nextMessage = state.messageQueue.shift();
        setTimeout(() => processMessage(nextMessage), 500);
      }
      
    } catch (error) {
      hideTyping();
      console.error('Error procesando mensaje:', error);
      
      if (retryCount < config.maxRetries) {
        showNotification(`Reintentando... (${retryCount + 1}/${config.maxRetries})`, 'warning');
        setTimeout(() => processMessage(message, retryCount + 1), config.retryDelay);
      } else {
        addMessage(getErrorMessage(error), 'bot', 'error');
        showNotification('Error de conexión persistente', 'error');
      }
    }
  }

  function handleBotResponse(data) {
    // Manejar comandos especiales
    if (data.command) {
      handleSpecialCommands(data);
    }
    
    // Añadir mensaje de respuesta
    addMessage(data.response, 'bot', data.type || 'normal');
    
    // Actualizar métricas
    if (data.alarms_checked) {
      state.metrics.alarmsChecked += data.alarms_checked;
    }
    
    // Manejar emergencias
    if (data.type === 'emergency') {
      activateEmergencyMode(true);
    }
  }

  function handleLocalCommands(message) {
    const cmd = message.toLowerCase().trim();
    
    switch (cmd) {
      case 'menu':
      case 'ayuda':
        addMessage(getMenuMessage(), 'bot', 'system');
        return true;
        
      case 'limpiar':
      case 'clear':
        clearChat();
        return true;
        
      case 'salir':
      case 'cerrar':
        toggleChat();
        return true;
        
      case 'expandir':
        expandChat();
        return true;
        
      case 'metricas':
        showMetrics();
        return true;
        
      default:
        return false;
    }
  }

  // ========= FUNCIONES DE UI =========
  function addMessage(content, sender, type = 'normal') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `${sender}-message`;
    
    if (type !== 'normal') {
      messageDiv.classList.add(`message-${type}`);
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = formatMessage(content);
    
    messageDiv.appendChild(contentDiv);
    
    // Añadir timestamp
    const timestamp = document.createElement('div');
    timestamp.className = 'message-timestamp';
    timestamp.textContent = new Date().toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    messageDiv.appendChild(timestamp);
    
    elements.chatMessages.appendChild(messageDiv);
    
    // Animación de entrada
    messageDiv.style.opacity = '0';
    messageDiv.style.transform = 'translateY(10px)';
    
    requestAnimationFrame(() => {
      messageDiv.style.transition = 'all 0.3s ease';
      messageDiv.style.opacity = '1';
      messageDiv.style.transform = 'translateY(0)';
    });
    
    scrollToBottom();
  }

  function formatMessage(content) {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/~~(.*?)~~/g, '<del>$1</del>')
      .replace(/\n/g, '<br>')
      .replace(/---/g, '<hr class="message-divider">')
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
  }

  function showTyping() {
    if (state.isTyping) return;
    
    state.isTyping = true;
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.innerHTML = `
      <span></span>
      <span></span>
      <span></span>
      <span class="typing-text">IA procesando...</span>
    `;
    
    elements.chatMessages.appendChild(typingDiv);
    scrollToBottom();
  }

  function hideTyping() {
    state.isTyping = false;
    const typingIndicator = elements.chatMessages.querySelector('.typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  function scrollToBottom() {
    if (elements.chatMessages) {
      elements.chatMessages.scrollTo({ 
        top: elements.chatMessages.scrollHeight, 
        behavior: 'smooth' 
      });
    }
  }

  function clearChat() {
    elements.chatMessages.innerHTML = '';
    state.conversationStarted = false;
    addMessage('Chat limpiado. ¿En qué puedo ayudarte?', 'bot', 'system');
  }

  // ========= MENSAJES PREDEFINIDOS =========
  function getWelcomeMessage() {
    const currentTime = new Date().toLocaleString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return `🤖 <strong>Asesor Claro IA v2.1</strong>
            ---
            📅 ${currentTime}
            ---
            🚀 <em>Sistema de análisis predictivo activado</em>
            ---
            ¡Hola! Soy tu asistente inteligente. ¿En qué puedo ayudarte hoy?`;
  }

  function getMenuMessage() {
    return `📋 <strong>Comandos Disponibles:</strong>
            ---
            🔹 <strong>estado sistema</strong> - Ver estado del sistema
            🔹 <strong>alarmas</strong> - Consultar alarmas activas
            🔹 <strong>dashboard</strong> - Ver métricas y estadísticas
            🔹 <strong>emergencia</strong> - Activar protocolo de emergencia
            🔹 <strong>análisis predictivo</strong> - Análisis IA avanzado
            🔹 <strong>menu</strong> - Mostrar este menú
            🔹 <strong>limpiar</strong> - Limpiar conversación
            ---
            💡 <em>También puedes escribir consultas en lenguaje natural</em>`;
  }

  function getErrorMessage(error) {
    const errorMessages = [
      '⚠️ Error de conexión. Verificando sistemas...',
      '🔧 Problema temporal. Reintentando automáticamente...',
      '📡 Conexión inestable. Intentando reconectar...',
      '⚡ Error del servidor. Escalando a soporte técnico...'
    ];
    
    const randomMessage = errorMessages[Math.floor(Math.random() * errorMessages.length)];
    return `${randomMessage}\n\n<em>Detalles técnicos: ${error.message}</em>`;
  }

  // ========= SISTEMA DE NOTIFICACIONES =========
  function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icon = getNotificationIcon(type);
    notification.innerHTML = `
      <span class="notification-icon">${icon}</span>
      <span class="notification-message">${message}</span>
    `;
    
    elements.notificationsContainer.appendChild(notification);
    
    // Auto-remover después del tiempo especificado
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  function getNotificationIcon(type) {
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    return icons[type] || icons.info;
  }

  // ========= MÉTRICAS Y SISTEMA =========
  function showMetrics() {
    const metricsHTML = `
      <div class="metric-card">
        <h3>📨 Mensajes Enviados</h3>
        <p>${state.metrics.messagesSent}</p>
      </div>
      <div class="metric-card">
        <h3>🚨 Alarmas Consultadas</h3>
        <p>${state.metrics.alarmsChecked}</p>
      </div>
      <div class="metric-card">
        <h3>⚠️ Emergencias</h3>
        <p>${state.metrics.emergencies}</p>
      </div>
      <div class="metric-card">
        <h3>⚡ Tiempo de Respuesta</h3>
        <p>${state.metrics.responseTime}ms</p>
      </div>
      <div class="metric-card">
        <h3>😊 Satisfacción</h3>
        <p>${state.metrics.satisfaction}/5</p>
      </div>
      <div class="metric-card">
        <h3>📊 Sesiones Hoy</h3>
        <p>${state.metrics.sessionsToday}</p>
      </div>
    `;
    
    elements.metricsContent.innerHTML = metricsHTML;
    elements.metricsOverlay.classList.add('active');
  }

  function updateSystemStatus() {
    const status = getSystemStatus();
    elements.statusText.textContent = status.text;
    elements.statusIndicator.style.background = status.color;
    elements.aiIndicator.style.background = status.color;
  }

  function getSystemStatus() {
    if (state.isEmergency) {
      return { text: 'Emergencia Activa', color: 'var(--error-color)' };
    } else if (state.isTyping) {
      return { text: 'IA Procesando', color: 'var(--warning-color)' };
    } else if (state.isOpen) {
      return { text: 'Chat Activo', color: 'var(--success-color)' };
    } else {
      return { text: 'Sistema Operativo', color: 'var(--success-color)' };
    }
  }

  // ========= UTILIDADES =========
  function updateLastActivity() {
    state.lastActivity = Date.now();
  }

  function startInactivityCheck() {
    setInterval(() => {
      if (state.isOpen) {
        const inactiveTime = Date.now() - state.lastActivity;
        if (inactiveTime > config.inactivityTimeout) {
          addMessage('⏳ Cerrando chat por inactividad...', 'bot', 'system');
          setTimeout(() => {
            toggleChat();
            showNotification('Chat cerrado por inactividad', 'info');
          }, 2000);
        }
      }
    }, 60000); // Verificar cada minuto
  }

  function checkEmergency(message) {
    const isEmergency = EMERGENCY_KEYWORDS.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
    
    if (isEmergency) {
      state.metrics.emergencies++;
      activateEmergencyMode(true);
    }
    
    return isEmergency;
  }

  function activateEmergencyMode(enable) {
    state.isEmergency = enable;
    document.body.classList.toggle('emergency-mode', enable);
    
    if (enable) {
      showNotification('🚨 Modo de emergencia activado', 'error', 5000);
    } else {
      showNotification('✅ Modo de emergencia desactivado', 'success');
    }
  }

  function handleSpecialCommands(data) {
    switch (data.command) {
      case 'emergency':
        activateEmergencyMode(true);
        break;
      case 'normal':
        activateEmergencyMode(false);
        break;
      case 'metrics':
        showMetrics();
        break;
      case 'clear':
        clearChat();
        break;
      case 'expand':
        expandChat();
        break;
    }
  }

  function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function getSessionData() {
    return {
      userId: state.userId,
      startTime: Date.now(),
      messagesCount: state.metrics.messagesSent,
      isEmergency: state.isEmergency
    };
  }

  function fetchWithTimeout(url, options, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timeout de conexión'));
      }, timeout);
      
      fetch(url, options)
        .then(response => {
          clearTimeout(timer);
          resolve(response);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  function updateCurrentTime() {
    const timeElements = document.querySelectorAll('#current-time');
    const currentTime = new Date().toLocaleString('es-ES');
    timeElements.forEach(el => el.textContent = currentTime);
  }

  function initParticles() {
    // Crear partículas animadas de fondo
    const particlesContainer = document.getElementById('particles-js');
    if (!particlesContainer) return;
    
    for (let i = 0; i < 50; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.cssText = `
        position: absolute;
        width: 2px;
        height: 2px;
        background: rgba(255,255,255,0.1);
        border-radius: 50%;
        top: ${Math.random() * 100}vh;
        left: ${Math.random() * 100}vw;
        animation: float ${3 + Math.random() * 4}s ease-in-out infinite;
        animation-delay: ${Math.random() * 2}s;
      `;
      particlesContainer.appendChild(particle);
    }
  }

  function showCommandSuggestions(input) {
    const suggestions = [
      '/estado', '/alarmas', '/dashboard', '/emergencia', 
      '/menu', '/limpiar', '/metricas', '/salir'
    ];
    
    const filtered = suggestions.filter(cmd => 
      cmd.startsWith(input.toLowerCase())
    );
    
    // Implementar UI para sugerencias si es necesario
    console.log('Sugerencias:', filtered);
  }

  // ========= FUNCIONES GLOBALES =========
  window.sendQuickAction = (action) => {
    if (!state.isOpen) {
      toggleChat();
      setTimeout(() => {
        elements.chatInput.value = action;
        elements.chatForm.dispatchEvent(new Event('submit'));
      }, 500);
    } else {
      elements.chatInput.value = action;
      elements.chatForm.dispatchEvent(new Event('submit'));
    }
  };

  window.closeMetrics = () => {
    elements.metricsOverlay.classList.remove('active');
  };

  window.clearChat = clearChat;
  window.expandChat = expandChat;
  window.showMetrics = showMetrics;

  // ========= INICIALIZACIÓN FINAL =========
  console.log('🚀 Asesor Claro IA v2.1 inicializado correctamente');
  showNotification('Sistema iniciado correctamente', 'success');
});