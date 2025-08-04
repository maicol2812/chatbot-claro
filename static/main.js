// Estado global del chatbot
const chatState = {
  isOpen: false,
  currentStep: 'menu',
  waitingForElement: false,
  currentAlarma: null,
  historial: []
};

// Elementos del DOM
const DOM = {
  chatBubble: document.getElementById('chatBubble'),
  chatWindow: document.getElementById('chatWindow'),
  chatMessages: document.getElementById('chatMessages'),
  messageInput: document.getElementById('messageInput'),
  sendBtn: document.getElementById('sendBtn'),
  closeChat: document.getElementById('closeChat'),
  minimizeChat: document.getElementById('minimizeChat'),
  maximizeChat: document.getElementById('maximizeChat'),
  typingIndicator: document.getElementById('typingIndicator'),
  bubbleNotification: document.getElementById('bubbleNotification'),
  attachBtn: document.getElementById('attachBtn')
};

// Base de datos simulada de alarmas (se reemplazará con llamadas al backend)
const alarmasDB = {
  'ROUTER-CORE-01': {
    id: 'ALM-001',
    elemento: 'ROUTER-CORE-01',
    severidad: 'CRITICA',
    descripcion: 'Falla en el enlace principal del router core. Pérdida de conectividad en el segmento de red crítico.',
    codigo: 'NET-001',
    acciones: '1. Verificar estado físico del enlace\n2. Contactar proveedor de conectividad\n3. Activar enlace de respaldo',
    contacto: 'soporte.redes@claro.com.co',
    documentos: ['Manual_Routers_Core.pdf', 'Procedimientos_Red.pdf']
  },
  'SWITCH-ACCESS-15': {
    id: 'ALM-002',
    elemento: 'SWITCH-ACCESS-15',
    severidad: 'ALTA',
    descripcion: 'Alta utilización de CPU en switch de acceso. Procesamiento de paquetes degradado.',
    codigo: 'SW-015',
    acciones: '1. Monitorear tráfico\n2. Redistribuir carga\n3. Considerar upgrade de hardware',
    contacto: 'soporte.acceso@claro.com.co',
    documentos: ['Guia_Switches_Acceso.pdf']
  }
};

// Inicialización del chatbot
function initChatbot() {
  setupEventListeners();
  showWelcomeNotification();
  
  // Cargar historial si existe
  const savedHistorial = localStorage.getItem('chatHistorial');
  if (savedHistorial) {
    chatState.historial = JSON.parse(savedHistorial);
    renderHistorial();
  }
}

// Configurar event listeners
function setupEventListeners() {
  // Chat bubble
  DOM.chatBubble.addEventListener('click', toggleChat);
  
  // Controles del chat
  DOM.closeChat.addEventListener('click', closeChat);
  DOM.minimizeChat.addEventListener('click', minimizeChat);
  DOM.maximizeChat.addEventListener('click', maximizeChat);
  DOM.sendBtn.addEventListener('click', sendMessage);
  DOM.attachBtn.addEventListener('click', showAttachmentOptions);
  
  // Input de mensaje
  DOM.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Eventos para el historial
  window.addEventListener('beforeunload', saveHistorial);
}

// Funciones de control del chat
function toggleChat() {
  chatState.isOpen ? closeChat() : openChat();
}

function openChat() {
  chatState.isOpen = true;
  DOM.chatWindow.classList.add('active');
  DOM.chatBubble.style.display = 'none';
  DOM.bubbleNotification.style.display = 'none';
  DOM.chatBubble.classList.remove('nuevo-mensaje');
  
  if (DOM.chatMessages.children.length === 0) {
    showWelcomeMessage();
  }
  
  setTimeout(() => DOM.messageInput.focus(), 300);
}

function closeChat() {
  chatState.isOpen = false;
  DOM.chatWindow.classList.remove('active');
  DOM.chatBubble.style.display = 'flex';
}

function minimizeChat() {
  DOM.chatWindow.classList.add('minimized');
}

function maximizeChat() {
  DOM.chatWindow.classList.remove('minimized');
}

// Funciones de mensajería
function addUserMessage(text) {
  const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  const message = {
    type: 'user',
    text: text,
    timestamp: timestamp
  };
  
  chatState.historial.push(message);
  
  const messageDiv = createMessageElement(message);
  DOM.chatMessages.appendChild(messageDiv);
  scrollToBottom();
}

function addBotMessage(text, options = {}) {
  const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  const message = {
    type: 'bot',
    text: text,
    timestamp: timestamp,
    options: options.options,
    actions: options.actions
  };
  
  chatState.historial.push(message);
  
  const messageDiv = createMessageElement(message);
  DOM.chatMessages.appendChild(messageDiv);
  scrollToBottom();
}

function createMessageElement(message) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${message.type}`;
  
  const avatarIcon = message.type === 'user' ? 'fa-user' : 'fa-robot';
  
  messageDiv.innerHTML = `
    <div class="message-avatar">
      <i class="fas ${avatarIcon}"></i>
    </div>
    <div class="message-content">
      <div class="message-text">${formatMessageText(message.text)}</div>
      <div class="message-timestamp">${message.timestamp}</div>
    </div>
  `;
  
  // Agregar opciones si existen
  if (message.options) {
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'suggestions-container';
    
    message.options.forEach(option => {
      const btn = document.createElement('button');
      btn.className = 'suggestion-btn';
      btn.textContent = option.text;
      btn.dataset.value = option.value;
      btn.addEventListener('click', () => handleOptionSelect(option.value));
      optionsDiv.appendChild(btn);
    });
    
    messageDiv.querySelector('.message-content').appendChild(optionsDiv);
  }
  
  // Agregar acciones si existen
  if (message.actions) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'action-buttons';
    
    message.actions.forEach(action => {
      const btn = document.createElement('button');
      btn.className = `action-btn ${action.class}`;
      btn.innerHTML = `<i class="fas fa-${getActionIcon(action.action)}"></i> ${action.text}`;
      btn.dataset.action = action.action;
      btn.addEventListener('click', () => handleActionClick(action.action));
      actionsDiv.appendChild(btn);
    });
    
    messageDiv.querySelector('.message-content').appendChild(actionsDiv);
  }
  
  return messageDiv;
}

// Funciones de interacción
function sendMessage() {
  const message = DOM.messageInput.value.trim();
  if (!message) return;
  
  addUserMessage(message);
  DOM.messageInput.value = '';
  
  // Procesar según el estado actual
  setTimeout(() => {
    if (chatState.waitingForElement) {
      processElementSearch(message);
    } else {
      showTyping();
      setTimeout(() => {
        hideTyping();
        handleGenericResponse(message);
      }, 1500);
    }
  }, 300);
}

function handleOptionSelect(optionValue) {
  const optionText = getOptionText(optionValue);
  addUserMessage(optionText);
  
  setTimeout(() => {
    switch(optionValue) {
      case '1': handleSearchOption(); break;
      case '2': handleCatalogOption(); break;
      case '3': handleCriticalAlarms(); break;
      case '4': handleStatsOption(); break;
      case '5': handleDocsOption(); break;
      case 'menu': showWelcomeMessage(); break;
      default: handleGenericOption(optionValue);
    }
  }, 500);
}

function handleActionClick(action) {
  showTyping();
  setTimeout(() => {
    hideTyping();
    switch(action) {
      case 'view-docs':
        if (chatState.currentAlarma && chatState.currentAlarma.documentos) {
          showDocumentOptions(chatState.currentAlarma.documentos);
        } else {
          addBotMessage('❌ No hay documentos disponibles para esta alarma.');
        }
        break;
      case 'contact-support':
        if (chatState.currentAlarma && chatState.currentAlarma.contacto) {
          window.location.href = `mailto:${chatState.currentAlarma.contacto}`;
        } else {
          addBotMessage('❌ No se encuentra información de contacto.');
        }
        break;
      default:
        handleGenericAction(action);
    }
  }, 1000);
}

async function processElementSearch(elementName) {
    chatState.waitingForElement = false;
    
    showTyping();
    try {
        const response = await fetch('/buscar_alarma', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                numero: chatState.currentAlarma,
                elemento: elementName
            })
        });
        
        const data = await response.json();
        hideTyping();
        
        if (data.encontrada) {
            showAlarmDetails(data.datos, data.pdf_path);
        } else {
            addBotMessage(`❌ No se encontró la alarma. ¿Deseas intentar con otro elemento?`, {
                options: [
                    { text: '🔍 Nueva búsqueda', value: '1' },
                    { text: '🏠 Volver al menú', value: 'menu' }
                ]
            });
        }
    } catch (error) {
        console.error('Error:', error);
        hideTyping();
        addBotMessage('❌ Error al buscar la alarma. Por favor intenta nuevamente.');
    }
}

function showAlarmDetails(alarma) {
    const severityEmoji = {
        'CRITICA': '🔴',
        'ALTA': '🟠',
        'MEDIA': '🟡',
        'BAJA': '🟢',
        'INFORMATIVA': 'ℹ️'
    };

    addBotMessage(`✅ **Alarma encontrada: ${alarma.id}**

**Elemento:** ${alarma.elemento || alarma.fabricante}
**Severidad:** ${severityEmoji[alarma.severidad.toUpperCase()] || '⚪'} ${alarma.severidad}
**Servicio:** ${alarma.servicio}

**📝 Descripción:**
${alarma.descripcion}

**👥 Grupos de atención:**
• Tier 1: ${alarma.tier_1}
• Tier 2: ${alarma.tier_2}
• Tier 3: ${alarma.tier_3}

**📞 Contacto:** ${alarma.contacto}`, {
        actions: [
            { text: '📄 Ver documentos', action: 'view-docs', class: 'primary' },
            { text: '📧 Contactar soporte', action: 'contact-support', class: 'secondary' }
        ]
    });
}

function showDocumentOptions(documentos) {
    let message = "📚 **Documentos disponibles:**\n\n";
    documentos.forEach(doc => {
        message += `• [${doc}](/descargar/${encodeURIComponent(doc)})\n`;
    });
    
    addBotMessage(message, {
        actions: [
            { text: '🔍 Buscar otra alarma', action: 'search', class: 'primary' },
            { text: '🏠 Volver al menú', action: 'menu', class: 'secondary' }
        ]
    });
}

// Funciones de UI
function showTyping() {
  DOM.typingIndicator.classList.add('active');
  scrollToBottom();
}

function hideTyping() {
  DOM.typingIndicator.classList.remove('active');
}

function scrollToBottom() {
  setTimeout(() => {
    DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
  }, 100);
}

function showWelcomeNotification() {
  setTimeout(() => {
    if (!chatState.isOpen) {
      DOM.bubbleNotification.style.display = 'flex';
      DOM.chatBubble.classList.add('nuevo-mensaje');
    }
  }, 3000);
}

// Actualizar función showWelcomeMessage para usar el nuevo diseño
function showWelcomeMessage() {
    chatState.currentStep = 'menu';
    
    addBotMessage(`🚀 **¡Buen día, hablemos de nuestras plataformas de Core!**
    
¿Qué te gustaría consultar hoy?`, {
        options: [
            { text: '1️⃣ Alarmas de plataformas', value: '1' },
            { text: '2️⃣ Documentación de las plataformas', value: '2' },
            { text: '3️⃣ Incidentes activos de las plataformas', value: '3' },
            { text: '4️⃣ Estado operativo de las plataformas', value: '4' },
            { text: '5️⃣ Cambios activos en las plataformas', value: '5' },
            { text: '6️⃣ Hablar con el administrador', value: '6' }
        ]
    });
}

// Funciones auxiliares
function formatMessageText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function getOptionText(optionValue) {
  const options = {
    '1': '🔍 Buscar alarma',
    '2': '📋 Ver catálogo',
    '3': '🚨 Alarmas críticas',
    '4': '📊 Estadísticas',
    '5': '📚 Documentación',
    'menu': '🏠 Menú principal'
  };
  return options[optionValue] || optionValue;
}

function getActionIcon(action) {
  const icons = {
    'view-docs': 'file-alt',
    'contact-support': 'headset',
    'download': 'download',
    'share': 'share'
  };
  return icons[action] || 'question-circle';
}

// Manejo del historial
function renderHistorial() {
  DOM.chatMessages.innerHTML = '';
  chatState.historial.forEach(message => {
    const messageDiv = createMessageElement(message);
    DOM.chatMessages.appendChild(messageDiv);
  });
  scrollToBottom();
}

function saveHistorial() {
  if (chatState.historial.length > 0) {
    localStorage.setItem('chatHistorial', JSON.stringify(chatState.historial));
  }
}

// Funciones de integración
function openChatAndSelectOption(option) {
  openChat();
  setTimeout(() => handleOptionSelect(option), 500);
}

// Inicializar el chatbot cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initChatbot);

// Funciones de manejo de opciones del menú y catálogo:
function handleSearchOption() {
  chatState.currentStep = 'searching';
  chatState.waitingForElement = true;
  
  addBotMessage(`🔍 **Búsqueda de Alarmas**

Por favor, ingresa el nombre del elemento que deseas consultar.

**Ejemplos disponibles:**
• ROUTER-CORE-01
• SWITCH-ACCESS-15
• SERVER-DB-03`, {
    options: [
      { text: '📋 Ver catálogo completo', value: '2' },
      { text: '🏠 Volver al menú', value: 'menu' }
    ]
  });
}

function handleCatalogOption() {
  showTyping();
  setTimeout(() => {
    hideTyping();
    addBotMessage(`📋 **Catálogo de Alarmas**

**Elementos disponibles:**
• ROUTER-CORE-01 (🔴 Crítica)
• SWITCH-ACCESS-15 (🟠 Alta)
• SERVER-DB-03 (🟡 Media)

¿Qué elemento deseas consultar?`, {
      options: [
        { text: 'ROUTER-CORE-01', value: 'ROUTER-CORE-01' },
        { text: 'SWITCH-ACCESS-15', value: 'SWITCH-ACCESS-15' },
        { text: 'SERVER-DB-03', value: 'SERVER-DB-03' },
        { text: '🏠 Volver al menú', value: 'menu' }
      ]
    });
  }, 1000);
}

function handleCriticalAlarms() {
  showTyping();
  setTimeout(() => {
    hideTyping();
    const criticalAlarms = Object.values(alarmasDB)
      .filter(a => a.severidad.toUpperCase() === 'CRITICA');
    
    if (criticalAlarms.length === 0) {
      addBotMessage(`✅ **¡Sistema Estable!**

No hay alarmas críticas activas en este momento.`, {
        options: [
          { text: '🔍 Buscar alarma', value: '1' },
          { text: '📋 Ver catálogo', value: '2' },
          { text: '🏠 Volver al menú', value: 'menu' }
        ]
      });
      return;
    }

    let message = `🚨 **Alarmas Críticas Activas**\n\n`;
    criticalAlarms.forEach(alarma => {
      message += `• **${alarma.elemento}**: ${alarma.descripcion}\n`;
    });

    addBotMessage(message, {
      options: criticalAlarms.map(a => ({
        text: a.elemento,
        value: a.elemento
      })).concat({ text: '🏠 Volver al menú', value: 'menu' })
    });
  }, 1500);
}

function handleStatsOption() {
  showTyping();
  setTimeout(() => {
    hideTyping();
    const stats = {
      total: Object.keys(alarmasDB).length,
      criticas: Object.values(alarmasDB).filter(a => a.severidad === 'CRITICA').length,
      altas: Object.values(alarmasDB).filter(a => a.severidad === 'ALTA').length
    };

    addBotMessage(`📊 **Estadísticas del Sistema**

**Estado Actual:**
• Total de alarmas: ${stats.total}
• Alarmas críticas: ${stats.criticas}
• Alarmas altas: ${stats.altas}
• Disponibilidad: 99.9%

**Elementos más frecuentes:**
1. ROUTER-CORE (${stats.criticas} alarmas)
2. SWITCH-ACCESS (${stats.altas} alarmas)`, {
      options: [
        { text: '🚨 Ver críticas', value: '3' },
        { text: '🔍 Buscar alarma', value: '1' },
        { text: '🏠 Volver al menú', value: 'menu' }
      ]
    });
  }, 1000);
}

function handleDocsOption() {
  showTyping();
  setTimeout(() => {
    hideTyping();
    addBotMessage(`📚 **Documentación Técnica**

**Documentos disponibles:**
• Manual de Alarmas Core
• Procedimientos de Escalamiento
• Guía de Troubleshooting

Selecciona un documento para visualizar:`, {
      options: [
        { text: '📄 Manual de Alarmas', value: 'doc_manual' },
        { text: '📄 Procedimientos', value: 'doc_proc' },
        { text: '📄 Guía Troubleshooting', value: 'doc_guide' },
        { text: '🏠 Volver al menú', value: 'menu' }
      ]
    });
  }, 1000);
}

function handleGenericResponse(message) {
  const lowerMsg = message.toLowerCase();
  
  if (lowerMsg.includes('ayuda') || lowerMsg.includes('help')) {
    showWelcomeMessage();
  } else if (lowerMsg.includes('crítica') || lowerMsg.includes('critica')) {
    handleCriticalAlarms();
  } else if (lowerMsg.includes('documento') || lowerMsg.includes('manual')) {
    handleDocsOption();
  } else {
    addBotMessage(`No he podido entender tu consulta. ¿Puedes ser más específico?

¿Qué deseas hacer?`, {
      options: [
        { text: '🔍 Buscar alarma', value: '1' },
        { text: '📋 Ver catálogo', value: '2' },
        { text: '🚨 Ver críticas', value: '3' },
        { text: '🏠 Volver al menú', value: 'menu' }
      ]
    });
  }
}