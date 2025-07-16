// Configuración
const config = {
    timeout: 5000,
    maxRetries: 3,
    retryDelay: 2000,
    supportedLanguages: ['es', 'en', 'fr', 'de', 'pt'],
    maxFileSize: 5 * 1024 * 1024, // 5MB
    apiUrl: 'http://localhost:5000'
};

// Estado global
const state = {
    isOpen: false,
    isExpanded: false,
    isTyping: false,
    isEmergency: false,
    userId: generateUserId(),
    lastActivity: Date.now(),
    messageQueue: [],
    conversationStarted: false,
    waitingForAlarmNumber: false,
    waitingForElementName: false,
    currentAlarmNumber: null,
    currentLanguage: navigator.language.split('-')[0] || 'es',
    darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
    voiceRecognition: null,
    currentState: '',
    metrics: {
        messagesSent: 0,
        alarmsChecked: 0,
        emergencies: 0,
        satisfaction: 4.5,
        responseTime: 0,
        sessionsToday: 1,
        voiceCommandsUsed: 0,
        translationsMade: 0,
        filesUploaded: 0
    }
};

// Mapeo de estados backend-frontend
const STATE_MAPPING = {
    'await_alarm_number': 'request_alarm_number',
    'await_element_name': 'request_element_name',
    '': 'provide_alarm_details'
};

// Función para generar ID único de usuario
function generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9);
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    initChat();
    setupEventListeners();
    showWelcomeMessage();
    startConnectionMonitor();
    initVoiceRecognition();
    applyThemePreference();
    initMetricsDashboard();
    checkNotificationPermission();
});

// Funciones principales
function initChat() {
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    // Asegurarse de que el chat esté oculto inicialmente
    chatContainer.classList.add('hidden');
    chatContainer.classList.remove('show');
    
    // Event listeners
    chatBubble.addEventListener('click', toggleChat);
    document.getElementById('expand-chat').addEventListener('click', toggleChatExpand);
    document.getElementById('minimize-chat').addEventListener('click', toggleChat);
    document.getElementById('chat-form').addEventListener('submit', handleSubmit);
    
    // Auto-focus en el input cuando se abre
    chatContainer.addEventListener('transitionend', () => {
        if (state.isOpen) {
            document.getElementById('chat-input').focus();
        }
    });
}

function setupEventListeners() {
    const emergencyBtn = document.getElementById('emergency-btn');
    if (emergencyBtn) {
        emergencyBtn.addEventListener('click', () => {
            activateEmergencyMode(true);
            processMessage("¡Necesito ayuda urgente!");
        });
    }

    // Prevenir cierre accidental del chat
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.isOpen) {
            toggleChat();
        }
    });

    // Inactividad
    setInterval(checkInactivity, 300000); // 5 minutos
    document.addEventListener('mousemove', updateActivity);
    document.addEventListener('keypress', updateActivity);

    // Botón de voz
    const voiceBtn = document.getElementById('voice-btn');
    if (voiceBtn) {
        voiceBtn.addEventListener('click', toggleVoiceRecognition);
    }

    // Botón de adjuntar archivo
    const fileBtn = document.getElementById('file-btn');
    if (fileBtn) {
        fileBtn.addEventListener('click', () => document.getElementById('file-input').click());
    }

    // Input de archivo
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
    }

    // Botón de traducción
    const translateBtn = document.getElementById('translate-btn');
    if (translateBtn) {
        translateBtn.addEventListener('click', showLanguageSelector);
    }

    // Botón de tema oscuro/ligero
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }

    // Botón de métricas
    const metricsBtn = document.getElementById('metrics-btn');
    if (metricsBtn) {
        metricsBtn.addEventListener('click', toggleMetricsDashboard);
    }
}

function showWelcomeMessage() {
    if (!state.conversationStarted) {
        // Iniciar conversación automáticamente
        processMessage("inicio");
    }
}

function toggleChat() {
    state.isOpen = !state.isOpen;
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    if (state.isOpen) {
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('show');
        chatBubble.classList.add('hidden');
        
        // Focus en el input
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);
    } else {
        chatContainer.classList.remove('show');
        chatContainer.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    }
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    const chatContainer = document.getElementById('chat-container');
    
    if (state.isExpanded) {
        chatContainer.classList.add('expanded');
    } else {
        chatContainer.classList.remove('expanded');
    }
}

function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
        processMessage(message);
        input.value = '';
    }
}

async function processMessage(message, retryCount = 0) {
    try {
        // Mostrar mensaje del usuario
        if (message !== "inicio") {
            addMessage(message, 'user');
        }
        
        // Mostrar indicador de escritura
        showTypingIndicator();
        
        // Actualizar métricas
        state.metrics.messagesSent++;
        updateMetricsChart();
        
        // Preparar datos para el servidor
        const requestData = {
            message: message,
            user_id: state.userId,
            isEmergency: state.isEmergency,
            current_state: state.currentState,
            alarm_number: state.currentAlarmNumber
        };
        
        let response;
        
        // Determinar qué endpoint usar
        if (state.currentState === 'await_alarm_number' || state.currentState === 'await_element_name') {
            // Usar endpoint handle_state para estados específicos
            response = await fetch(`${config.apiUrl}/handle_state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        } else {
            // Usar endpoint chat para mensajes generales
            response = await fetch(`${config.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Ocultar indicador de escritura
        hideTypingIndicator();
        
        // Mostrar respuesta del bot
        addMessage(data.response, 'bot', data.type);
        
        // Actualizar estado según la respuesta
        if (data.next_step) {
            state.currentState = data.next_step;
            
            if (data.next_step === 'await_alarm_number') {
                state.waitingForAlarmNumber = true;
                state.waitingForElementName = false;
            } else if (data.next_step === 'await_element_name') {
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = true;
                state.currentAlarmNumber = data.alarm_number;
            }
        } else {
            // Reset states
            state.currentState = '';
            state.waitingForAlarmNumber = false;
            state.waitingForElementName = false;
            state.currentAlarmNumber = null;
        }
        
        // Marcar conversación como iniciada
        state.conversationStarted = true;
        
        // Actualizar métricas si es consulta de alarma
        if (data.type === 'alarm_resolved') {
            state.metrics.alarmsChecked++;
            updateMetricsChart();
        }
        
        // Mostrar sugerencias inteligentes
        showSmartSuggestions({
            lastMessage: message,
            currentState: state.currentState,
            isEmergency: state.isEmergency
        });
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        hideTypingIndicator();

        // Reintentar si es necesario
        if (retryCount < config.maxRetries) {
            setTimeout(() => {
                processMessage(message, retryCount + 1);
            }, config.retryDelay * (retryCount + 1));
        } else {
            addMessage('Lo siento, hubo un problema de conexión. Por favor intenta nuevamente.', 'bot', 'error');
        }
    }
}

function addMessage(message, sender, type = 'normal') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Añadir clases adicionales según el tipo
    if (type === 'error') {
        messageDiv.classList.add('error-message');
    } else if (type === 'system') {
        messageDiv.classList.add('system-message');
    } else if (type === 'alarm_resolved') {
        messageDiv.classList.add('success-message');
    }
    
    // Formatear mensaje (convertir saltos de línea a HTML)
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    if (sender === 'bot' && !state.isOpen) {
        notifyNewMessage();
    }
}

// Notificación visual en la burbuja cuando hay mensaje nuevo y el chat está cerrado
function notifyNewMessage() {
    const chatBubble = document.getElementById('chat-bubble');
    if (!state.isOpen && chatBubble) {
        chatBubble.classList.add('nuevo-mensaje');
        // Opcional: agregar badge de notificación
        if (!chatBubble.querySelector('.badge-notif')) {
            const badge = document.createElement('span');
            badge.className = 'badge-notif';
            badge.textContent = '1';
            chatBubble.appendChild(badge);
        }
    }
}

// Quitar notificación visual al abrir el chat
function clearNewMessageNotification() {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) {
        chatBubble.classList.remove('nuevo-mensaje');
        const badge = chatBubble.querySelector('.badge-notif');
        if (badge) badge.remove();
    }
}

// Llama a clearNewMessageNotification() al abrir el chat
function toggleChat() {
    state.isOpen = !state.isOpen;
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    if (state.isOpen) {
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('show');
        chatBubble.classList.add('hidden');
        
        // Focus en el input
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);

        clearNewMessageNotification();
    } else {
        chatContainer.classList.remove('show');
        chatContainer.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    }
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    const chatContainer = document.getElementById('chat-container');
    
    if (state.isExpanded) {
        chatContainer.classList.add('expanded');
    } else {
        chatContainer.classList.remove('expanded');
    }
}

function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
        processMessage(message);
        input.value = '';
    }
}

async function processMessage(message, retryCount = 0) {
    try {
        // Mostrar mensaje del usuario
        if (message !== "inicio") {
            addMessage(message, 'user');
        }
        
        // Mostrar indicador de escritura
        showTypingIndicator();
        
        // Actualizar métricas
        state.metrics.messagesSent++;
        updateMetricsChart();
        
        // Preparar datos para el servidor
        const requestData = {
            message: message,
            user_id: state.userId,
            isEmergency: state.isEmergency,
            current_state: state.currentState,
            alarm_number: state.currentAlarmNumber
        };
        
        let response;
        
        // Determinar qué endpoint usar
        if (state.currentState === 'await_alarm_number' || state.currentState === 'await_element_name') {
            // Usar endpoint handle_state para estados específicos
            response = await fetch(`${config.apiUrl}/handle_state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        } else {
            // Usar endpoint chat para mensajes generales
            response = await fetch(`${config.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Ocultar indicador de escritura
        hideTypingIndicator();
        
        // Mostrar respuesta del bot
        addMessage(data.response, 'bot', data.type);
        
        // Actualizar estado según la respuesta
        if (data.next_step) {
            state.currentState = data.next_step;
            
            if (data.next_step === 'await_alarm_number') {
                state.waitingForAlarmNumber = true;
                state.waitingForElementName = false;
            } else if (data.next_step === 'await_element_name') {
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = true;
                state.currentAlarmNumber = data.alarm_number;
            }
        } else {
            // Reset states
            state.currentState = '';
            state.waitingForAlarmNumber = false;
            state.waitingForElementName = false;
            state.currentAlarmNumber = null;
        }
        
        // Marcar conversación como iniciada
        state.conversationStarted = true;
        
        // Actualizar métricas si es consulta de alarma
        if (data.type === 'alarm_resolved') {
            state.metrics.alarmsChecked++;
            updateMetricsChart();
        }
        
        // Mostrar sugerencias inteligentes
        showSmartSuggestions({
            lastMessage: message,
            currentState: state.currentState,
            isEmergency: state.isEmergency
        });
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        hideTypingIndicator();

        // Reintentar si es necesario
        if (retryCount < config.maxRetries) {
            setTimeout(() => {
                processMessage(message, retryCount + 1);
            }, config.retryDelay * (retryCount + 1));
        } else {
            addMessage('Lo siento, hubo un problema de conexión. Por favor intenta nuevamente.', 'bot', 'error');
        }
    }
}

function addMessage(message, sender, type = 'normal') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Añadir clases adicionales según el tipo
    if (type === 'error') {
        messageDiv.classList.add('error-message');
    } else if (type === 'system') {
        messageDiv.classList.add('system-message');
    } else if (type === 'alarm_resolved') {
        messageDiv.classList.add('success-message');
    }
    
    // Formatear mensaje (convertir saltos de línea a HTML)
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    if (sender === 'bot' && !state.isOpen) {
        notifyNewMessage();
    }
}

// Notificación visual en la burbuja cuando hay mensaje nuevo y el chat está cerrado
function notifyNewMessage() {
    const chatBubble = document.getElementById('chat-bubble');
    if (!state.isOpen && chatBubble) {
        chatBubble.classList.add('nuevo-mensaje');
        // Opcional: agregar badge de notificación
        if (!chatBubble.querySelector('.badge-notif')) {
            const badge = document.createElement('span');
            badge.className = 'badge-notif';
            badge.textContent = '1';
            chatBubble.appendChild(badge);
        }
    }
}

// Quitar notificación visual al abrir el chat
function clearNewMessageNotification() {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) {
        chatBubble.classList.remove('nuevo-mensaje');
        const badge = chatBubble.querySelector('.badge-notif');
        if (badge) badge.remove();
    }
}

// Llama a clearNewMessageNotification() al abrir el chat
function toggleChat() {
    state.isOpen = !state.isOpen;
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    if (state.isOpen) {
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('show');
        chatBubble.classList.add('hidden');
        
        // Focus en el input
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);

        clearNewMessageNotification();
    } else {
        chatContainer.classList.remove('show');
        chatContainer.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    }
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    const chatContainer = document.getElementById('chat-container');
    
    if (state.isExpanded) {
        chatContainer.classList.add('expanded');
    } else {
        chatContainer.classList.remove('expanded');
    }
}

function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
        processMessage(message);
        input.value = '';
    }
}

async function processMessage(message, retryCount = 0) {
    try {
        // Mostrar mensaje del usuario
        if (message !== "inicio") {
            addMessage(message, 'user');
        }
        
        // Mostrar indicador de escritura
        showTypingIndicator();
        
        // Actualizar métricas
        state.metrics.messagesSent++;
        updateMetricsChart();
        
        // Preparar datos para el servidor
        const requestData = {
            message: message,
            user_id: state.userId,
            isEmergency: state.isEmergency,
            current_state: state.currentState,
            alarm_number: state.currentAlarmNumber
        };
        
        let response;
        
        // Determinar qué endpoint usar
        if (state.currentState === 'await_alarm_number' || state.currentState === 'await_element_name') {
            // Usar endpoint handle_state para estados específicos
            response = await fetch(`${config.apiUrl}/handle_state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        } else {
            // Usar endpoint chat para mensajes generales
            response = await fetch(`${config.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Ocultar indicador de escritura
        hideTypingIndicator();
        
        // Mostrar respuesta del bot
        addMessage(data.response, 'bot', data.type);
        
        // Actualizar estado según la respuesta
        if (data.next_step) {
            state.currentState = data.next_step;
            
            if (data.next_step === 'await_alarm_number') {
                state.waitingForAlarmNumber = true;
                state.waitingForElementName = false;
            } else if (data.next_step === 'await_element_name') {
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = true;
                state.currentAlarmNumber = data.alarm_number;
            }
        } else {
            // Reset states
            state.currentState = '';
            state.waitingForAlarmNumber = false;
            state.waitingForElementName = false;
            state.currentAlarmNumber = null;
        }
        
        // Marcar conversación como iniciada
        state.conversationStarted = true;
        
        // Actualizar métricas si es consulta de alarma
        if (data.type === 'alarm_resolved') {
            state.metrics.alarmsChecked++;
            updateMetricsChart();
        }
        
        // Mostrar sugerencias inteligentes
        showSmartSuggestions({
            lastMessage: message,
            currentState: state.currentState,
            isEmergency: state.isEmergency
        });
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        hideTypingIndicator();

        // Reintentar si es necesario
        if (retryCount < config.maxRetries) {
            setTimeout(() => {
                processMessage(message, retryCount + 1);
            }, config.retryDelay * (retryCount + 1));
        } else {
            addMessage('Lo siento, hubo un problema de conexión. Por favor intenta nuevamente.', 'bot', 'error');
        }
    }
}

function addMessage(message, sender, type = 'normal') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Añadir clases adicionales según el tipo
    if (type === 'error') {
        messageDiv.classList.add('error-message');
    } else if (type === 'system') {
        messageDiv.classList.add('system-message');
    } else if (type === 'alarm_resolved') {
        messageDiv.classList.add('success-message');
    }
    
    // Formatear mensaje (convertir saltos de línea a HTML)
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    if (sender === 'bot' && !state.isOpen) {
        notifyNewMessage();
    }
}

// Notificación visual en la burbuja cuando hay mensaje nuevo y el chat está cerrado
function notifyNewMessage() {
    const chatBubble = document.getElementById('chat-bubble');
    if (!state.isOpen && chatBubble) {
        chatBubble.classList.add('nuevo-mensaje');
        // Opcional: agregar badge de notificación
        if (!chatBubble.querySelector('.badge-notif')) {
            const badge = document.createElement('span');
            badge.className = 'badge-notif';
            badge.textContent = '1';
            chatBubble.appendChild(badge);
        }
    }
}

// Quitar notificación visual al abrir el chat
function clearNewMessageNotification() {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) {
        chatBubble.classList.remove('nuevo-mensaje');
        const badge = chatBubble.querySelector('.badge-notif');
        if (badge) badge.remove();
    }
}

// Llama a clearNewMessageNotification() al abrir el chat
function toggleChat() {
    state.isOpen = !state.isOpen;
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    if (state.isOpen) {
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('show');
        chatBubble.classList.add('hidden');
        
        // Focus en el input
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);

        clearNewMessageNotification();
    } else {
        chatContainer.classList.remove('show');
        chatContainer.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    }
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    const chatContainer = document.getElementById('chat-container');
    
    if (state.isExpanded) {
        chatContainer.classList.add('expanded');
    } else {
        chatContainer.classList.remove('expanded');
    }
}

function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
        processMessage(message);
        input.value = '';
    }
}

async function processMessage(message, retryCount = 0) {
    try {
        // Mostrar mensaje del usuario
        if (message !== "inicio") {
            addMessage(message, 'user');
        }
        
        // Mostrar indicador de escritura
        showTypingIndicator();
        
        // Actualizar métricas
        state.metrics.messagesSent++;
        updateMetricsChart();
        
        // Preparar datos para el servidor
        const requestData = {
            message: message,
            user_id: state.userId,
            isEmergency: state.isEmergency,
            current_state: state.currentState,
            alarm_number: state.currentAlarmNumber
        };
        
        let response;
        
        // Determinar qué endpoint usar
        if (state.currentState === 'await_alarm_number' || state.currentState === 'await_element_name') {
            // Usar endpoint handle_state para estados específicos
            response = await fetch(`${config.apiUrl}/handle_state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        } else {
            // Usar endpoint chat para mensajes generales
            response = await fetch(`${config.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Ocultar indicador de escritura
        hideTypingIndicator();
        
        // Mostrar respuesta del bot
        addMessage(data.response, 'bot', data.type);
        
        // Actualizar estado según la respuesta
        if (data.next_step) {
            state.currentState = data.next_step;
            
            if (data.next_step === 'await_alarm_number') {
                state.waitingForAlarmNumber = true;
                state.waitingForElementName = false;
            } else if (data.next_step === 'await_element_name') {
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = true;
                state.currentAlarmNumber = data.alarm_number;
            }
        } else {
            // Reset states
            state.currentState = '';
            state.waitingForAlarmNumber = false;
            state.waitingForElementName = false;
            state.currentAlarmNumber = null;
        }
        
        // Marcar conversación como iniciada
        state.conversationStarted = true;
        
        // Actualizar métricas si es consulta de alarma
        if (data.type === 'alarm_resolved') {
            state.metrics.alarmsChecked++;
            updateMetricsChart();
        }
        
        // Mostrar sugerencias inteligentes
        showSmartSuggestions({
            lastMessage: message,
            currentState: state.currentState,
            isEmergency: state.isEmergency
        });
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        hideTypingIndicator();

        // Reintentar si es necesario
        if (retryCount < config.maxRetries) {
            setTimeout(() => {
                processMessage(message, retryCount + 1);
            }, config.retryDelay * (retryCount + 1));
        } else {
            addMessage('Lo siento, hubo un problema de conexión. Por favor intenta nuevamente.', 'bot', 'error');
        }
    }
}

function addMessage(message, sender, type = 'normal') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Añadir clases adicionales según el tipo
    if (type === 'error') {
        messageDiv.classList.add('error-message');
    } else if (type === 'system') {
        messageDiv.classList.add('system-message');
    } else if (type === 'alarm_resolved') {
        messageDiv.classList.add('success-message');
    }
    
    // Formatear mensaje (convertir saltos de línea a HTML)
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    if (sender === 'bot' && !state.isOpen) {
        notifyNewMessage();
    }
}

// Notificación visual en la burbuja cuando hay mensaje nuevo y el chat está cerrado
function notifyNewMessage() {
    const chatBubble = document.getElementById('chat-bubble');
    if (!state.isOpen && chatBubble) {
        chatBubble.classList.add('nuevo-mensaje');
        // Opcional: agregar badge de notificación
        if (!chatBubble.querySelector('.badge-notif')) {
            const badge = document.createElement('span');
            badge.className = 'badge-notif';
            badge.textContent = '1';
            chatBubble.appendChild(badge);
        }
    }
}

// Quitar notificación visual al abrir el chat
function clearNewMessageNotification() {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) {
        chatBubble.classList.remove('nuevo-mensaje');
        const badge = chatBubble.querySelector('.badge-notif');
        if (badge) badge.remove();
    }
}

// Llama a clearNewMessageNotification() al abrir el chat
function toggleChat() {
    state.isOpen = !state.isOpen;
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    if (state.isOpen) {
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('show');
        chatBubble.classList.add('hidden');
        
        // Focus en el input
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);

        clearNewMessageNotification();
    } else {
        chatContainer.classList.remove('show');
        chatContainer.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    }
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    const chatContainer = document.getElementById('chat-container');
    
    if (state.isExpanded) {
        chatContainer.classList.add('expanded');
    } else {
        chatContainer.classList.remove('expanded');
    }
}

function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
        processMessage(message);
        input.value = '';
    }
}

async function processMessage(message, retryCount = 0) {
    try {
        // Mostrar mensaje del usuario
        if (message !== "inicio") {
            addMessage(message, 'user');
        }
        
        // Mostrar indicador de escritura
        showTypingIndicator();
        
        // Actualizar métricas
        state.metrics.messagesSent++;
        updateMetricsChart();
        
        // Preparar datos para el servidor
        const requestData = {
            message: message,
            user_id: state.userId,
            isEmergency: state.isEmergency,
            current_state: state.currentState,
            alarm_number: state.currentAlarmNumber
        };
        
        let response;
        
        // Determinar qué endpoint usar
        if (state.currentState === 'await_alarm_number' || state.currentState === 'await_element_name') {
            // Usar endpoint handle_state para estados específicos
            response = await fetch(`${config.apiUrl}/handle_state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        } else {
            // Usar endpoint chat para mensajes generales
            response = await fetch(`${config.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Ocultar indicador de escritura
        hideTypingIndicator();
        
        // Mostrar respuesta del bot
        addMessage(data.response, 'bot', data.type);
        
        // Actualizar estado según la respuesta
        if (data.next_step) {
            state.currentState = data.next_step;
            
            if (data.next_step === 'await_alarm_number') {
                state.waitingForAlarmNumber = true;
                state.waitingForElementName = false;
            } else if (data.next_step === 'await_element_name') {
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = true;
                state.currentAlarmNumber = data.alarm_number;
            }
        } else {
            // Reset states
            state.currentState = '';
            state.waitingForAlarmNumber = false;
            state.waitingForElementName = false;
            state.currentAlarmNumber = null;
        }
        
        // Marcar conversación como iniciada
        state.conversationStarted = true;
        
        // Actualizar métricas si es consulta de alarma
        if (data.type === 'alarm_resolved') {
            state.metrics.alarmsChecked++;
            updateMetricsChart();
        }
        
        // Mostrar sugerencias inteligentes
        showSmartSuggestions({
            lastMessage: message,
            currentState: state.currentState,
            isEmergency: state.isEmergency
        });
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        hideTypingIndicator();

        // Reintentar si es necesario
        if (retryCount < config.maxRetries) {
            setTimeout(() => {
                processMessage(message, retryCount + 1);
            }, config.retryDelay * (retryCount + 1));
        } else {
            addMessage('Lo siento, hubo un problema de conexión. Por favor intenta nuevamente.', 'bot', 'error');
        }
    }
}

function addMessage(message, sender, type = 'normal') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Añadir clases adicionales según el tipo
    if (type === 'error') {
        messageDiv.classList.add('error-message');
    } else if (type === 'system') {
        messageDiv.classList.add('system-message');
    } else if (type === 'alarm_resolved') {
        messageDiv.classList.add('success-message');
    }
    
    // Formatear mensaje (convertir saltos de línea a HTML)
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    if (sender === 'bot' && !state.isOpen) {
        notifyNewMessage();
    }
}

// Notificación visual en la burbuja cuando hay mensaje nuevo y el chat está cerrado
function notifyNewMessage() {
    const chatBubble = document.getElementById('chat-bubble');
    if (!state.isOpen && chatBubble) {
        chatBubble.classList.add('nuevo-mensaje');
        // Opcional: agregar badge de notificación
        if (!chatBubble.querySelector('.badge-notif')) {
            const badge = document.createElement('span');
            badge.className = 'badge-notif';
            badge.textContent = '1';
            chatBubble.appendChild(badge);
        }
    }
}

// Quitar notificación visual al abrir el chat
function clearNewMessageNotification() {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) {
        chatBubble.classList.remove('nuevo-mensaje');
        const badge = chatBubble.querySelector('.badge-notif');
        if (badge) badge.remove();
    }
}

// Llama a clearNewMessageNotification() al abrir el chat
function toggleChat() {
    state.isOpen = !state.isOpen;
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    if (state.isOpen) {
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('show');
        chatBubble.classList.add('hidden');
        
        // Focus en el input
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);

        clearNewMessageNotification();
    } else {
        chatContainer.classList.remove('show');
        chatContainer.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    }
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    const chatContainer = document.getElementById('chat-container');
    
    if (state.isExpanded) {
        chatContainer.classList.add('expanded');
    } else {
        chatContainer.classList.remove('expanded');
    }
}

function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
        processMessage(message);
        input.value = '';
    }
}

async function processMessage(message, retryCount = 0) {
    try {
        // Mostrar mensaje del usuario
        if (message !== "inicio") {
            addMessage(message, 'user');
        }
        
        // Mostrar indicador de escritura
        showTypingIndicator();
        
        // Actualizar métricas
        state.metrics.messagesSent++;
        updateMetricsChart();
        
        // Preparar datos para el servidor
        const requestData = {
            message: message,
            user_id: state.userId,
            isEmergency: state.isEmergency,
            current_state: state.currentState,
            alarm_number: state.currentAlarmNumber
        };
        
        let response;
        
        // Determinar qué endpoint usar
        if (state.currentState === 'await_alarm_number' || state.currentState === 'await_element_name') {
            // Usar endpoint handle_state para estados específicos
            response = await fetch(`${config.apiUrl}/handle_state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        } else {
            // Usar endpoint chat para mensajes generales
            response = await fetch(`${config.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Ocultar indicador de escritura
        hideTypingIndicator();
        
        // Mostrar respuesta del bot
        addMessage(data.response, 'bot', data.type);
        
        // Actualizar estado según la respuesta
        if (data.next_step) {
            state.currentState = data.next_step;
            
            if (data.next_step === 'await_alarm_number') {
                state.waitingForAlarmNumber = true;
                state.waitingForElementName = false;
            } else if (data.next_step === 'await_element_name') {
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = true;
                state.currentAlarmNumber = data.alarm_number;
            }
        } else {
            // Reset states
            state.currentState = '';
            state.waitingForAlarmNumber = false;
            state.waitingForElementName = false;
            state.currentAlarmNumber = null;
        }
        
        // Marcar conversación como iniciada
        state.conversationStarted = true;
        
        // Actualizar métricas si es consulta de alarma
        if (data.type === 'alarm_resolved') {
            state.metrics.alarmsChecked++;
            updateMetricsChart();
        }
        
        // Mostrar sugerencias inteligentes
        showSmartSuggestions({
            lastMessage: message,
            currentState: state.currentState,
            isEmergency: state.isEmergency
        });
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        hideTypingIndicator();

        // Reintentar si es necesario
        if (retryCount < config.maxRetries) {
            setTimeout(() => {
                processMessage(message, retryCount + 1);
            }, config.retryDelay * (retryCount + 1));
        } else {
            addMessage('Lo siento, hubo un problema de conexión. Por favor intenta nuevamente.', 'bot', 'error');
        }
    }
}

function addMessage(message, sender, type = 'normal') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Añadir clases adicionales según el tipo
    if (type === 'error') {
        messageDiv.classList.add('error-message');
    } else if (type === 'system') {
        messageDiv.classList.add('system-message');
    } else if (type === 'alarm_resolved') {
        messageDiv.classList.add('success-message');
    }
    
    // Formatear mensaje (convertir saltos de línea a HTML)
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    if (sender === 'bot' && !state.isOpen) {
        notifyNewMessage();
    }
}

// Notificación visual en la burbuja cuando hay mensaje nuevo y el chat está cerrado
function notifyNewMessage() {
    const chatBubble = document.getElementById('chat-bubble');
    if (!state.isOpen && chatBubble) {
        chatBubble.classList.add('nuevo-mensaje');
        // Opcional: agregar badge de notificación
        if (!chatBubble.querySelector('.badge-notif')) {
            const badge = document.createElement('span');
            badge.className = 'badge-notif';
            badge.textContent = '1';
            chatBubble.appendChild(badge);
        }
    }
}

// Quitar notificación visual al abrir el chat
function clearNewMessageNotification() {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) {
        chatBubble.classList.remove('nuevo-mensaje');
        const badge = chatBubble.querySelector('.badge-notif');
        if (badge) badge.remove();
    }
}

// Llama a clearNewMessageNotification() al abrir el chat
function toggleChat() {
    state.isOpen = !state.isOpen;
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    if (state.isOpen) {
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('show');
        chatBubble.classList.add('hidden');
        
        // Focus en el input
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);

        clearNewMessageNotification();
    } else {
        chatContainer.classList.remove('show');
        chatContainer.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    }
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    const chatContainer = document.getElementById('chat-container');
    
    if (state.isExpanded) {
        chatContainer.classList.add('expanded');
    } else {
        chatContainer.classList.remove('expanded');
    }
}

function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
        processMessage(message);
        input.value = '';
    }
}

async function processMessage(message, retryCount = 0) {
    try {
        // Mostrar mensaje del usuario
        if (message !== "inicio") {
            addMessage(message, 'user');
        }
        
        // Mostrar indicador de escritura
        showTypingIndicator();
        
        // Actualizar métricas
        state.metrics.messagesSent++;
        updateMetricsChart();
        
        // Preparar datos para el servidor
        const requestData = {
            message: message,
            user_id: state.userId,
            isEmergency: state.isEmergency,
            current_state: state.currentState,
            alarm_number: state.currentAlarmNumber
        };
        
        let response;
        
        // Determinar qué endpoint usar
        if (state.currentState === 'await_alarm_number' || state.currentState === 'await_element_name') {
            // Usar endpoint handle_state para estados específicos
            response = await fetch(`${config.apiUrl}/handle_state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        } else {
            // Usar endpoint chat para mensajes generales
            response = await fetch(`${config.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Ocultar indicador de escritura
        hideTypingIndicator();
        
        // Mostrar respuesta del bot
        addMessage(data.response, 'bot', data.type);
        
        // Actualizar estado según la respuesta
        if (data.next_step) {
            state.currentState = data.next_step;
            
            if (data.next_step === 'await_alarm_number') {
                state.waitingForAlarmNumber = true;
                state.waitingForElementName = false;
            } else if (data.next_step === 'await_element_name') {
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = true;
                state.currentAlarmNumber = data.alarm_number;
            }
        } else {
            // Reset states
            state.currentState = '';
            state.waitingForAlarmNumber = false;
            state.waitingForElementName = false;
            state.currentAlarmNumber = null;
        }
        
        // Marcar conversación como iniciada
        state.conversationStarted = true;
        
        // Actualizar métricas si es consulta de alarma
        if (data.type === 'alarm_resolved') {
            state.metrics.alarmsChecked++;
            updateMetricsChart();
        }
        
        // Mostrar sugerencias inteligentes
        showSmartSuggestions({
            lastMessage: message,
            currentState: state.currentState,
            isEmergency: state.isEmergency
        });
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        hideTypingIndicator();

        // Reintentar si es necesario
        if (retryCount < config.maxRetries) {
            setTimeout(() => {
                processMessage(message, retryCount + 1);
            }, config.retryDelay * (retryCount + 1));
        } else {
            addMessage('Lo siento, hubo un problema de conexión. Por favor intenta nuevamente.', 'bot', 'error');
        }
    }
}

function addMessage(message, sender, type = 'normal') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Añadir clases adicionales según el tipo
    if (type === 'error') {
        messageDiv.classList.add('error-message');
    } else if (type === 'system') {
        messageDiv.classList.add('system-message');
    } else if (type === 'alarm_resolved') {
        messageDiv.classList.add('success-message');
    }
    
    // Formatear mensaje (convertir saltos de línea a HTML)
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    if (sender === 'bot' && !state.isOpen) {
        notifyNewMessage();
    }
}

// Notificación visual en la burbuja cuando hay mensaje nuevo y el chat está cerrado
function notifyNewMessage() {
    const chatBubble = document.getElementById('chat-bubble');
    if (!state.isOpen && chatBubble) {
        chatBubble.classList.add('nuevo-mensaje');
        // Opcional: agregar badge de notificación
        if (!chatBubble.querySelector('.badge-notif')) {
            const badge = document.createElement('span');
            badge.className = 'badge-notif';
            badge.textContent = '1';
            chatBubble.appendChild(badge);
        }
    }
}

// Quitar notificación visual al abrir el chat
function clearNewMessageNotification() {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) {
        chatBubble.classList.remove('nuevo-mensaje');
        const badge = chatBubble.querySelector('.badge-notif');
        if (badge) badge.remove();
    }
}

// Llama a clearNewMessageNotification() al abrir el chat
function toggleChat() {
    state.isOpen = !state.isOpen;
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    if (state.isOpen) {
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('show');
        chatBubble.classList.add('hidden');
        
        // Focus en el input
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);

        clearNewMessageNotification();
    } else {
        chatContainer.classList.remove('show');
        chatContainer.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    }
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    const chatContainer = document.getElementById('chat-container');
    
    if (state.isExpanded) {
        chatContainer.classList.add('expanded');
    } else {
        chatContainer.classList.remove('expanded');
    }
}

function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
        processMessage(message);
        input.value = '';
    }
}

async function processMessage(message, retryCount = 0) {
    try {
        // Mostrar mensaje del usuario
        if (message !== "inicio") {
            addMessage(message, 'user');
        }
        
        // Mostrar indicador de escritura
        showTypingIndicator();
        
        // Actualizar métricas
        state.metrics.messagesSent++;
        updateMetricsChart();
        
        // Preparar datos para el servidor
        const requestData = {
            message: message,
            user_id: state.userId,
            isEmergency: state.isEmergency,
            current_state: state.currentState,
            alarm_number: state.currentAlarmNumber
        };
        
        let response;
        
        // Determinar qué endpoint usar
        if (state.currentState === 'await_alarm_number' || state.currentState === 'await_element_name') {
            // Usar endpoint handle_state para estados específicos
            response = await fetch(`${config.apiUrl}/handle_state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        } else {
            // Usar endpoint chat para mensajes generales
            response = await fetch(`${config.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Ocultar indicador de escritura
        hideTypingIndicator();
        
        // Mostrar respuesta del bot
        addMessage(data.response, 'bot', data.type);
        
        // Actualizar estado según la respuesta
        if (data.next_step) {
            state.currentState = data.next_step;
            
            if (data.next_step === 'await_alarm_number') {
                state.waitingForAlarmNumber = true;
                state.waitingForElementName = false;
            } else if (data.next_step === 'await_element_name') {
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = true;
                state.currentAlarmNumber = data.alarm_number;
            }
        } else {
            // Reset states
            state.currentState = '';
            state.waitingForAlarmNumber = false;
            state.waitingForElementName = false;
            state.currentAlarmNumber = null;
        }
        
        // Marcar conversación como iniciada
        state.conversationStarted = true;
        
        // Actualizar métricas si es consulta de alarma
        if (data.type === 'alarm_resolved') {
            state.metrics.alarmsChecked++;
            updateMetricsChart();
        }
        
        // Mostrar sugerencias inteligentes
        showSmartSuggestions({
            lastMessage: message,
            currentState: state.currentState,
            isEmergency: state.isEmergency
        });
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        hideTypingIndicator();

        // Reintentar si es necesario
        if (retryCount < config.maxRetries) {
            setTimeout(() => {
                processMessage(message, retryCount + 1);
            }, config.retryDelay * (retryCount + 1));
        } else {
            addMessage('Lo siento, hubo un problema de conexión. Por favor intenta nuevamente.', 'bot', 'error');
        }
    }
}

function addMessage(message, sender, type = 'normal') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Añadir clases adicionales según el tipo
    if (type === 'error') {
        messageDiv.classList.add('error-message');
    } else if (type === 'system') {
        messageDiv.classList.add('system-message');
    } else if (type === 'alarm_resolved') {
        messageDiv.classList.add('success-message');
    }
    
    // Formatear mensaje (convertir saltos de línea a HTML)
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    if (sender === 'bot' && !state.isOpen) {
        notifyNewMessage();
    }
}

// Notificación visual en la burbuja cuando hay mensaje nuevo y el chat está cerrado
function notifyNewMessage() {
    const chatBubble = document.getElementById('chat-bubble');
    if (!state.isOpen && chatBubble) {
        chatBubble.classList.add('nuevo-mensaje');
        // Opcional: agregar badge de notificación
        if (!chatBubble.querySelector('.badge-notif')) {
            const badge = document.createElement('span');
            badge.className = 'badge-notif';
            badge.textContent = '1';
            chatBubble.appendChild(badge);
        }
    }
}

// Quitar notificación visual al abrir el chat
function clearNewMessageNotification() {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) {
        chatBubble.classList.remove('nuevo-mensaje');
        const badge = chatBubble.querySelector('.badge-notif');
        if (badge) badge.remove();
    }
}

// Llama a clearNewMessageNotification() al abrir el chat
function toggleChat() {
    state.isOpen = !state.isOpen;
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    if (state.isOpen) {
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('show');
        chatBubble.classList.add('hidden');
        
        // Focus en el input
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);

        clearNewMessageNotification();
    } else {
        chatContainer.classList.remove('show');
        chatContainer.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    }
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    const chatContainer = document.getElementById('chat-container');
    
    if (state.isExpanded) {
        chatContainer.classList.add('expanded');
    } else {
        chatContainer.classList.remove('expanded');
    }
}

function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
        processMessage(message);
        input.value = '';
    }
}

async function processMessage(message, retryCount = 0) {
    try {
        // Mostrar mensaje del usuario
        if (message !== "inicio") {
            addMessage(message, 'user');
        }
        
        // Mostrar indicador de escritura
        showTypingIndicator();
        
        // Actualizar métricas
        state.metrics.messagesSent++;
        updateMetricsChart();
        
        // Preparar datos para el servidor
        const requestData = {
            message: message,
            user_id: state.userId,
            isEmergency: state.isEmergency,
            current_state: state.currentState,
            alarm_number: state.currentAlarmNumber
        };
        
        let response;
        
        // Determinar qué endpoint usar
        if (state.currentState === 'await_alarm_number' || state.currentState === 'await_element_name') {
            // Usar endpoint handle_state para estados específicos
            response = await fetch(`${config.apiUrl}/handle_state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        } else {
            // Usar endpoint chat para mensajes generales
            response = await fetch(`${config.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Ocultar indicador de escritura
        hideTypingIndicator();
        
        // Mostrar respuesta del bot
        addMessage(data.response, 'bot', data.type);
        
        // Actualizar estado según la respuesta
        if (data.next_step) {
            state.currentState = data.next_step;
            
            if (data.next_step === 'await_alarm_number') {
                state.waitingForAlarmNumber = true;
                state.waitingForElementName = false;
            } else if (data.next_step === 'await_element_name') {
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = true;
                state.currentAlarmNumber = data.alarm_number;
            }
        } else {
            // Reset states
            state.currentState = '';
            state.waitingForAlarmNumber = false;
            state.waitingForElementName = false;
            state.currentAlarmNumber = null;
        }
        
        // Marcar conversación como iniciada
        state.conversationStarted = true;
        
        // Actualizar métricas si es consulta de alarma
        if (data.type === 'alarm_resolved') {
            state.metrics.alarmsChecked++;
            updateMetricsChart();
        }
        
        // Mostrar sugerencias inteligentes
        showSmartSuggestions({
            lastMessage: message,
            currentState: state.currentState,
            isEmergency: state.isEmergency
        });
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        hideTypingIndicator();

        // Reintentar si es necesario
        if (retryCount < config.maxRetries) {
            setTimeout(() => {
                processMessage(message, retryCount + 1);
            }, config.retryDelay * (retryCount + 1));
        } else {
            addMessage('Lo siento, hubo un problema de conexión. Por favor intenta nuevamente.', 'bot', 'error');
        }
    }
}

function addMessage(message, sender, type = 'normal') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Añadir clases adicionales según el tipo
    if (type === 'error') {
        messageDiv.classList.add('error-message');
    } else if (type === 'system') {
        messageDiv.classList.add('system-message');
    } else if (type === 'alarm_resolved') {
        messageDiv.classList.add('success-message');
    }
    
    // Formatear mensaje (convertir saltos de línea a HTML)
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    if (sender === 'bot' && !state.isOpen) {
        notifyNewMessage();
    }
}

// Notificación visual en la burbuja cuando hay mensaje nuevo y el chat está cerrado
function notifyNewMessage() {
    const chatBubble = document.getElementById('chat-bubble');
    if (!state.isOpen && chatBubble) {
        chatBubble.classList.add('nuevo-mensaje');
        // Opcional: agregar badge de notificación
        if (!chatBubble.querySelector('.badge-notif')) {
            const badge = document.createElement('span');
            badge.className = 'badge-notif';
            badge.textContent = '1';
            chatBubble.appendChild(badge);
        }
    }
}

// Quitar notificación visual al abrir el chat
function clearNewMessageNotification() {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) {
        chatBubble.classList.remove('nuevo-mensaje');
        const badge = chatBubble.querySelector('.badge-notif');
        if (badge) badge.remove();
    }
}

// Llama a clearNewMessageNotification() al abrir el chat
function toggleChat() {
    state.isOpen = !state.isOpen;
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    if (state.isOpen) {
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('show');
        chatBubble.classList.add('hidden');
        
        // Focus en el input
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);

        clearNewMessageNotification();
    } else {
        chatContainer.classList.remove('show');
        chatContainer.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    }
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    const chatContainer = document.getElementById('chat-container');
    
    if (state.isExpanded) {
        chatContainer.classList.add('expanded');
    } else {
        chatContainer.classList.remove('expanded');
    }
}

function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
        processMessage(message);
        input.value = '';
    }
}

async function processMessage(message, retryCount = 0) {
    try {
        // Mostrar mensaje del usuario
        if (message !== "inicio") {
            addMessage(message, 'user');
        }
        
        // Mostrar indicador de escritura
        showTypingIndicator();
        
        // Actualizar métricas
        state.metrics.messagesSent++;
        updateMetricsChart();
        
        // Preparar datos para el servidor
        const requestData = {
            message: message,
            user_id: state.userId,
            isEmergency: state.isEmergency,
            current_state: state.currentState,
            alarm_number: state.currentAlarmNumber
        };
        
        let response;
        
        // Determinar qué endpoint usar
        if (state.currentState === 'await_alarm_number' || state.currentState === 'await_element_name') {
            // Usar endpoint handle_state para estados específicos
            response = await fetch(`${config.apiUrl}/handle_state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        } else {
            // Usar endpoint chat para mensajes generales
            response = await fetch(`${config.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Ocultar indicador de escritura
        hideTypingIndicator();
        
        // Mostrar respuesta del bot
        addMessage(data.response, 'bot', data.type);
        
        // Actualizar estado según la respuesta
        if (data.next_step) {
            state.currentState = data.next_step;
            
            if (data.next_step === 'await_alarm_number') {
                state.waitingForAlarmNumber = true;
                state.waitingForElementName = false;
            } else if (data.next_step === 'await_element_name') {
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = true;
                state.currentAlarmNumber = data.alarm_number;
            }
        } else {
            // Reset states
            state.currentState = '';
            state.waitingForAlarmNumber = false;
            state.waitingForElementName = false;
            state.currentAlarmNumber = null;
        }
        
        // Marcar conversación como iniciada
        state.conversationStarted = true;
        
        // Actualizar métricas si es consulta de alarma
        if (data.type === 'alarm_resolved') {
            state.metrics.alarmsChecked++;
            updateMetricsChart();
        }
        
        // Mostrar sugerencias inteligentes
        showSmartSuggestions({
            lastMessage: message,
            currentState: state.currentState,
            isEmergency: state.isEmergency
        });
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        hideTypingIndicator();

        // Reintentar si es necesario
        if (retryCount < config.maxRetries) {
            setTimeout(() => {
                processMessage(message, retryCount + 1);
            }, config.retryDelay * (retryCount + 1));
        } else {
            addMessage('Lo siento, hubo un problema de conexión. Por favor intenta nuevamente.', 'bot', 'error');
        }
    }
}

function addMessage(message, sender, type = 'normal') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Añadir clases adicionales según el tipo
    if (type === 'error') {
        messageDiv.classList.add('error-message');
    } else if (type === 'system') {
        messageDiv.classList.add('system-message');
    } else if (type === 'alarm_resolved') {
        messageDiv.classList.add('success-message');
    }
    
    // Formatear mensaje (convertir saltos de línea a HTML)
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    if (sender === 'bot' && !state.isOpen) {
        notifyNewMessage();
    }
}

// Notificación visual en la burbuja cuando hay mensaje nuevo y el chat está cerrado
function notifyNewMessage() {
    const chatBubble = document.getElementById('chat-bubble');
    if (!state.isOpen && chatBubble) {
        chatBubble.classList.add('nuevo-mensaje');
        // Opcional: agregar badge de notificación
        if (!chatBubble.querySelector('.badge-notif')) {
            const badge = document.createElement('span');
            badge.className = 'badge-notif';
            badge.textContent = '1';
            chatBubble.appendChild(badge);
        }
    }
}

// Quitar notificación visual al abrir el chat
function clearNewMessageNotification() {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) {
        chatBubble.classList.remove('nuevo-mensaje');
        const badge = chatBubble.querySelector('.badge-notif');
        if (badge) badge.remove();
    }
}

// Llama a clearNewMessageNotification() al abrir el chat
function toggleChat() {
    state.isOpen = !state.isOpen;
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    if (state.isOpen) {
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('show');
        chatBubble.classList.add('hidden');
        
        // Focus en el input
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);

        clearNewMessageNotification();
    } else {
        chatContainer.classList.remove('show');
        chatContainer.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    }
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    const chatContainer = document.getElementById('chat-container');
    
    if (state.isExpanded) {
        chatContainer.classList.add('expanded');
    } else {
        chatContainer.classList.remove('expanded');
    }
}

function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
        processMessage(message);
        input.value = '';
    }
}

async function processMessage(message, retryCount = 0) {
    try {
        // Mostrar mensaje del usuario
        if (message !== "inicio") {
            addMessage(message, 'user');
        }
        
        // Mostrar indicador de escritura
        showTypingIndicator();
        
        // Actualizar métricas
        state.metrics.messagesSent++;
        updateMetricsChart();
        
        // Preparar datos para el servidor
        const requestData = {
            message: message,
            user_id: state.userId,
            isEmergency: state.isEmergency,
            current_state: state.currentState,
            alarm_number: state.currentAlarmNumber
        };
        
        let response;
        
        // Determinar qué endpoint usar
        if (state.currentState === 'await_alarm_number' || state.currentState === 'await_element_name') {
            // Usar endpoint handle_state para estados específicos
            response = await fetch(`${config.apiUrl}/handle_state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        } else {
            // Usar endpoint chat para mensajes generales
            response = await fetch(`${config.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Ocultar indicador de escritura
        hideTypingIndicator();
        
        // Mostrar respuesta del bot
        addMessage(data.response, 'bot', data.type);
        
        // Actualizar estado según la respuesta
        if (data.next_step) {
            state.currentState = data.next_step;
            
            if (data.next_step === 'await_alarm_number') {
                state.waitingForAlarmNumber = true;
                state.waitingForElementName = false;
            } else if (data.next_step === 'await_element_name') {
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = true;
                state.currentAlarmNumber = data.alarm_number;
            }
        } else {
            // Reset states
            state.currentState = '';
            state.waitingForAlarmNumber = false;
            state.waitingForElementName = false;
            state.currentAlarmNumber = null;
        }
        
        // Marcar conversación como iniciada
        state.conversationStarted = true;
        
        // Actualizar métricas si es consulta de alarma
        if (data.type === 'alarm_resolved') {
            state.metrics.alarmsChecked++;
            updateMetricsChart();
        }
        
        // Mostrar sugerencias inteligentes
        showSmartSuggestions({
            lastMessage: message,
            currentState: state.currentState,
            isEmergency: state.isEmergency
        });
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        hideTypingIndicator();

        // Reintentar si es necesario
        if (retryCount < config.maxRetries) {
            setTimeout(() => {
                processMessage(message, retryCount + 1);
            }, config.retryDelay * (retryCount + 1));
        } else {
            addMessage('Lo siento, hubo un problema de conexión. Por favor intenta nuevamente.', 'bot', 'error');
        }
    }
}

function addMessage(message, sender, type = 'normal') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Añadir clases adicionales según el tipo
    if (type === 'error') {
        messageDiv.classList.add('error-message');
    } else if (type === 'system') {
        messageDiv.classList.add('system-message');
    } else if (type === 'alarm_resolved') {
        messageDiv.classList.add('success-message');
    }
    
    // Formatear mensaje (convertir saltos de línea a HTML)
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    if (sender === 'bot' && !state.isOpen) {
        notifyNewMessage();
    }
}

// Notificación visual en la burbuja cuando hay mensaje nuevo y el chat está cerrado
function notifyNewMessage() {
    const chatBubble = document.getElementById('chat-bubble');
    if (!state.isOpen && chatBubble) {
        chatBubble.classList.add('nuevo-mensaje');
        // Opcional: agregar badge de notificación
        if (!chatBubble.querySelector('.badge-notif')) {
            const badge = document.createElement('span');
            badge.className = 'badge-notif';
            badge.textContent = '1';
            chatBubble.appendChild(badge);
        }
    }
}

// Quitar notificación visual al abrir el chat
function clearNewMessageNotification() {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) {
        chatBubble.classList.remove('nuevo-mensaje');
        const badge = chatBubble.querySelector('.badge-notif');
        if (badge) badge.remove();
    }
}

// Llama a clearNewMessageNotification() al abrir el chat
function toggleChat() {
    state.isOpen = !state.isOpen;
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    if (state.isOpen) {
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('show');
        chatBubble.classList.add('hidden');
        
        // Focus en el input
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);

        clearNewMessageNotification();
    } else {
        chatContainer.classList.remove('show');
        chatContainer.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    }
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    const chatContainer = document.getElementById('chat-container');
    
    if (state.isExpanded) {
        chatContainer.classList.add('expanded');
    } else {
        chatContainer.classList.remove('expanded');
    }
}

function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
        processMessage(message);
        input.value = '';
    }
}

async function processMessage(message, retryCount = 0) {
    try {
        // Mostrar mensaje del usuario
        if (message !== "inicio") {
            addMessage(message, 'user');
        }
        
        // Mostrar indicador de escritura
        showTypingIndicator();
        
        // Actualizar métricas
        state.metrics.messagesSent++;
        updateMetricsChart();
        
        // Preparar datos para el servidor
        const requestData = {
            message: message,
            user_id: state.userId,
            isEmergency: state.isEmergency,
            current_state: state.currentState,
            alarm_number: state.currentAlarmNumber
        };
        
        let response;
        
        // Determinar qué endpoint usar
        if (state.currentState === 'await_alarm_number' || state.currentState === 'await_element_name') {
            // Usar endpoint handle_state para estados específicos
            response = await fetch(`${config.apiUrl}/handle_state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        } else {
            // Usar endpoint chat para mensajes generales
            response = await fetch(`${config.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Ocultar indicador de escritura
        hideTypingIndicator();
        
        // Mostrar respuesta del bot
        addMessage(data.response, 'bot', data.type);
        
        // Actualizar estado según la respuesta
        if (data.next_step) {
            state.currentState = data.next_step;
            
            if (data.next_step === 'await_alarm_number') {
                state.waitingForAlarmNumber = true;
                state.waitingForElementName = false;
            } else if (data.next_step === 'await_element_name') {
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = true;
                state.currentAlarmNumber = data.alarm_number;
            }
        } else {
            // Reset states
            state.currentState = '';
            state.waitingForAlarmNumber = false;
            state.waitingForElementName = false;
            state.currentAlarmNumber = null;
        }
        
        // Marcar conversación como iniciada
        state.conversationStarted = true;
        
        // Actualizar métricas si es consulta de alarma
        if (data.type === 'alarm_resolved') {
            state.metrics.alarmsChecked++;
            updateMetricsChart();
        }
        
        // Mostrar sugerencias inteligentes
        showSmartSuggestions({
            lastMessage: message,
            currentState: state.currentState,
            isEmergency: state.isEmergency
        });
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        hideTypingIndicator();

        // Reintentar si es necesario
        if (retryCount < config.maxRetries) {
            setTimeout(() => {
                processMessage(message, retryCount + 1);
            }, config.retryDelay * (retryCount + 1));
        } else {
            addMessage('Lo siento, hubo un problema de conexión. Por favor intenta nuevamente.', 'bot', 'error');
        }
    }
}

function addMessage(message, sender, type = 'normal') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Añadir clases adicionales según el tipo
    if (type === 'error') {
        messageDiv.classList.add('error-message');
    } else if (type === 'system') {
        messageDiv.classList.add('system-message');
    } else if (type === 'alarm_resolved') {
        messageDiv.classList.add('success-message');
    }
    
    // Formatear mensaje (convertir saltos de línea a HTML)
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    if (sender === 'bot' && !state.isOpen) {
        notifyNewMessage();
    }
}

// Notificación visual en la burbuja cuando hay mensaje nuevo y el chat está cerrado
function notifyNewMessage() {
    const chatBubble = document.getElementById('chat-bubble');
    if (!state.isOpen && chatBubble) {
        chatBubble.classList.add('nuevo-mensaje');
        // Opcional: agregar badge de notificación
        if (!chatBubble.querySelector('.badge-notif')) {
            const badge = document.createElement('span');
            badge.className = 'badge-notif';
            badge.textContent = '1';
            chatBubble.appendChild(badge);
        }
    }
}

// Quitar notificación visual al abrir el chat
function clearNewMessageNotification() {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) {
        chatBubble.classList.remove('nuevo-mensaje');
        const badge = chatBubble.querySelector('.badge-notif');
        if (badge) badge.remove();
    }
}

// Llama a clearNewMessageNotification() al abrir el chat
function toggleChat() {
    state.isOpen = !state.isOpen;
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    if (state.isOpen) {
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('show');
        chatBubble.classList.add('hidden');
        
        // Focus en el input
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);

        clearNewMessageNotification();
    } else {
        chatContainer.classList.remove('show');
        chatContainer.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    }
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    const chatContainer = document.getElementById('chat-container');
    
    if (state.isExpanded) {
        chatContainer.classList.add('expanded');
    } else {
        chatContainer.classList.remove('expanded');
    }
}

function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
        processMessage(message);
        input.value = '';
    }
}

async function processMessage(message, retryCount = 0) {
    try {
        // Mostrar mensaje del usuario
        if (message !== "inicio") {
            addMessage(message, 'user');
        }
        
        // Mostrar indicador de escritura
        showTypingIndicator();
        
        // Actualizar métricas
        state.metrics.messagesSent++;
        updateMetricsChart();
        
        // Preparar datos para el servidor
        const requestData = {
            message: message,
            user_id: state.userId,
            isEmergency: state.isEmergency,
            current_state: state.currentState,
            alarm_number: state.currentAlarmNumber
        };
        
        let response;
        
        // Determinar qué endpoint usar
        if (state.currentState === 'await_alarm_number' || state.currentState === 'await_element_name') {
            // Usar endpoint handle_state para estados específicos
            response = await fetch(`${config.apiUrl}/handle_state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        } else {
            // Usar endpoint chat para mensajes generales
            response = await fetch(`${config.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Ocultar indicador de escritura
        hideTypingIndicator();
        
        // Mostrar respuesta del bot
        addMessage(data.response, 'bot', data.type);
        
        // Actualizar estado según la respuesta
        if (data.next_step) {
            state.currentState = data.next_step;
            
            if (data.next_step === 'await_alarm_number') {
                state.waitingForAlarmNumber = true;
                state.waitingForElementName = false;
            } else if (data.next_step === 'await_element_name') {
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = true;
                state.currentAlarmNumber = data.alarm_number;
            }
        } else {
            // Reset states
            state.currentState = '';
            state.waitingForAlarmNumber = false;
            state.waitingForElementName = false;
            state.currentAlarmNumber = null;
        }
        
        // Marcar conversación como iniciada
        state.conversationStarted = true;
        
        // Actualizar métricas si es consulta de alarma
        if (data.type === 'alarm_resolved') {
            state.metrics.alarmsChecked++;
            updateMetricsChart();
        }
        
        // Mostrar sugerencias inteligentes
        showSmartSuggestions({
            lastMessage: message,
            currentState: state.currentState,
            isEmergency: state.isEmergency
        });
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        hideTypingIndicator();

        // Reintentar si es necesario
        if (retryCount < config.maxRetries) {
            setTimeout(() => {
                processMessage(message, retryCount + 1);
            }, config.retryDelay * (retryCount + 1));
        } else {
            addMessage('Lo siento, hubo un problema de conexión. Por favor intenta nuevamente.', 'bot', 'error');
        }
    }
}

function addMessage(message, sender, type = 'normal') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Añadir clases adicionales según el tipo
    if (type === 'error') {
        messageDiv.classList.add('error-message');
    } else if (type === 'system') {
        messageDiv.classList.add('system-message');
    } else if (type === 'alarm_resolved') {
        messageDiv.classList.add('success-message');
    }
    
    // Formatear mensaje (convertir saltos de línea a HTML)
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    if (sender === 'bot' && !state.isOpen) {
        notifyNewMessage();
    }
}

// Notificación visual en la burbuja cuando hay mensaje nuevo y el chat está cerrado
function notifyNewMessage() {
    const chatBubble = document.getElementById('chat-bubble');
    if (!state.isOpen && chatBubble) {
        chatBubble.classList.add('nuevo-mensaje');
        // Opcional: agregar badge de notificación
        if (!chatBubble.querySelector('.badge-notif')) {
            const badge = document.createElement('span');
            badge.className = 'badge-notif';
            badge.textContent = '1';
            chatBubble.appendChild(badge);
        }
    }
}

// Quitar notificación visual al abrir el chat
function clearNewMessageNotification() {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) {
        chatBubble.classList.remove('nuevo-mensaje');
        const badge = chatBubble.querySelector('.badge-notif');
        if (badge) badge.remove();
    }
}

// Llama a clearNewMessageNotification() al abrir el chat
function toggleChat() {
    state.isOpen = !state.isOpen;
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    if (state.isOpen) {
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('show');
        chatBubble.classList.add('hidden');
        
        // Focus en el input
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);

        clearNewMessageNotification();
    } else {
        chatContainer.classList.remove('show');
        chatContainer.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    }
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    const chatContainer = document.getElementById('chat-container');
    
    if (state.isExpanded) {
        chatContainer.classList.add('expanded');
    } else {
        chatContainer.classList.remove('expanded');
    }
}

function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
        processMessage(message);
        input.value = '';
    }
}

async function processMessage(message, retryCount = 0) {
    try {
        // Mostrar mensaje del usuario
        if (message !== "inicio") {
            addMessage(message, 'user');
        }
        
        // Mostrar indicador de escritura
        showTypingIndicator();
        
        // Actualizar métricas
        state.metrics.messagesSent++;
        updateMetricsChart();
        
        // Preparar datos para el servidor
        const requestData = {
            message: message,
            user_id: state.userId,
            isEmergency: state.isEmergency,
            current_state: state.currentState,
            alarm_number: state.currentAlarmNumber
        };
        
        let response;
        
        // Determinar qué endpoint usar
        if (state.currentState === 'await_alarm_number' || state.currentState === 'await_element_name') {
            // Usar endpoint handle_state para estados específicos
            response = await fetch(`${config.apiUrl}/handle_state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        } else {
            // Usar endpoint chat para mensajes generales
            response = await fetch(`${config.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Ocultar indicador de escritura
        hideTypingIndicator();
        
        // Mostrar respuesta del bot
        addMessage(data.response, 'bot', data.type);
        
        // Actualizar estado según la respuesta
        if (data.next_step) {
            state.currentState = data.next_step;
            
            if (data.next_step === 'await_alarm_number') {
                state.waitingForAlarmNumber = true;
                state.waitingForElementName = false;
            } else if (data.next_step === 'await_element_name') {
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = true;
                state.currentAlarmNumber = data.alarm_number;
            }
        } else {
            // Reset states
            state.currentState = '';
            state.waitingForAlarmNumber = false;
            state.waitingForElementName = false;
            state.currentAlarmNumber = null;
        }
        
        // Marcar conversación como iniciada
        state.conversationStarted = true;
        
        // Actualizar métricas si es consulta de alarma
        if (data.type === 'alarm_resolved') {
            state.metrics.alarmsChecked++;
            updateMetricsChart();
        }
        
        // Mostrar sugerencias inteligentes
        showSmartSuggestions({
            lastMessage: message,
            currentState: state.currentState,
            isEmergency: state.isEmergency
        });
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        hideTypingIndicator();

        // Reintentar si es necesario
        if (retryCount < config.maxRetries) {
            setTimeout(() => {
                processMessage(message, retryCount + 1);
            }, config.retryDelay * (retryCount + 1));
        } else {
            addMessage('Lo siento, hubo un problema de conexión. Por favor intenta nuevamente.', 'bot', 'error');
        }
    }
}

function addMessage(message, sender, type = 'normal') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Añadir clases adicionales según el tipo
    if (type === 'error') {
        messageDiv.classList.add('error-message');
    } else if (type === 'system') {
        messageDiv.classList.add('system-message');
    } else if (type === 'alarm_resolved') {
        messageDiv.classList.add('success-message');
    }
    
    // Formatear mensaje (convertir saltos de línea a HTML)
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    if (sender === 'bot' && !state.isOpen) {
        notifyNewMessage();
    }
}

// Notificación visual en la burbuja cuando hay mensaje nuevo y el chat está cerrado
function notifyNewMessage() {
    const chatBubble = document.getElementById('chat-bubble');
    if (!state.isOpen && chatBubble) {
        chatBubble.classList.add('nuevo-mensaje');
        // Opcional: agregar badge de notificación
        if (!chatBubble.querySelector('.badge-notif')) {
            const badge = document.createElement('span');
            badge.className = 'badge-notif';
            badge.textContent = '1';
            chatBubble.appendChild(badge);
        }
    }
}

// Quitar notificación visual al abrir el chat
function clearNewMessageNotification() {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) {
        chatBubble.classList.remove('nuevo-mensaje');
        const badge = chatBubble.querySelector('.badge-notif');
        if (badge) badge.remove();
    }
}

// Llama a clearNewMessageNotification() al abrir el chat
function toggleChat() {
    state.isOpen = !state.isOpen;
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    if (state.isOpen) {
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('show');
        chatBubble.classList.add('hidden');
        
        // Focus en el input
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);

        clearNewMessageNotification();
    } else {
        chatContainer.classList.remove('show');
        chatContainer.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    }
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    const chatContainer = document.getElementById('chat-container');
    
    if (state.isExpanded) {
        chatContainer.classList.add('expanded');
    } else {
        chatContainer.classList.remove('expanded');
    }
}

function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
        processMessage(message);
        input.value = '';
    }
}

async function processMessage(message, retryCount = 0) {
    try {
        // Mostrar mensaje del usuario
        if (message !== "inicio") {
            addMessage(message, 'user');
        }
        
        // Mostrar indicador de escritura
        showTypingIndicator();
        
        // Actualizar métricas
        state.metrics.messagesSent++;
        updateMetricsChart();
        
        // Preparar datos para el servidor
        const requestData = {
            message: message,
            user_id: state.userId,
            isEmergency: state.isEmergency,
            current_state: state.currentState,
            alarm_number: state.currentAlarmNumber
        };
        
        let response;
        
        // Determinar qué endpoint usar
        if (state.currentState === 'await_alarm_number' || state.currentState === 'await_element_name') {
            // Usar endpoint handle_state para estados específicos
            response = await fetch(`${config.apiUrl}/handle_state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        } else {
            // Usar endpoint chat para mensajes generales
            response = await fetch(`${config.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Ocultar indicador de escritura
        hideTypingIndicator();
        
        // Mostrar respuesta del bot
        addMessage(data.response, 'bot', data.type);
        
        // Actualizar estado según la respuesta
        if (data.next_step) {
            state.currentState = data.next_step;
            
            if (data.next_step === 'await_alarm_number') {
                state.waitingForAlarmNumber = true;
                state.waitingForElementName = false;
            } else if (data.next_step === 'await_element_name') {
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = true;
                state.currentAlarmNumber = data.alarm_number;
            }
        } else {
            // Reset states
            state.currentState = '';
            state.waitingForAlarmNumber = false;
            state.waitingForElementName = false;
            state.currentAlarmNumber = null;
        }
        
        // Marcar conversación como iniciada
        state.conversationStarted = true;
        
        // Actualizar métricas si es consulta de alarma
        if (data.type === 'alarm_resolved') {
            state.metrics.alarmsChecked++;
            updateMetricsChart();
        }
        
        // Mostrar sugerencias inteligentes
        showSmartSuggestions({
            lastMessage: message,
            currentState: state.currentState,
            isEmergency: state.isEmergency
        });
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        hideTypingIndicator();

        // Reintentar si es necesario
        if (retryCount < config.maxRetries) {
            setTimeout(() => {
                processMessage(message, retryCount + 1);
            }, config.retryDelay * (retryCount + 1));
        } else {
            addMessage('Lo siento, hubo un problema de conexión. Por favor intenta nuevamente.', 'bot', 'error');
        }
    }
}

function addMessage(message, sender, type = 'normal') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Añadir clases adicionales según el tipo
    if (type === 'error') {
        messageDiv.classList.add('error-message');
    } else if (type === 'system') {
        messageDiv.classList.add('system-message');
    } else if (type === 'alarm_resolved') {
        messageDiv.classList.add('success-message');
    }
    
    // Formatear mensaje (convertir saltos de línea a HTML)
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    if (sender === 'bot' && !state.isOpen) {
        notifyNewMessage();
    }
}

// Notificación visual en la burbuja cuando hay mensaje nuevo y el chat está cerrado
function notifyNewMessage() {
    const chatBubble = document.getElementById('chat-bubble');
    if (!state.isOpen && chatBubble) {
        chatBubble.classList.add('nuevo-mensaje');
        // Opcional: agregar badge de notificación
        if (!chatBubble.querySelector('.badge-notif')) {
            const badge = document.createElement('span');
            badge.className = 'badge-notif';
            badge.textContent = '1';
            chatBubble.appendChild(badge);
        }
    }
}

// Quitar notificación visual al abrir el chat
function clearNewMessageNotification() {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) {
        chatBubble.classList.remove('nuevo-mensaje');
        const badge = chatBubble.querySelector('.badge-notif');
        if (badge) badge.remove();
    }
}

// Llama a clearNewMessageNotification() al abrir el chat
function toggleChat() {
    state.isOpen = !state.isOpen;
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    if (state.isOpen) {
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('show');
        chatBubble.classList.add('hidden');
        
        // Focus en el input
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);

        clearNewMessageNotification();
    } else {
        chatContainer.classList.remove('show');
        chatContainer.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    }
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    const chatContainer = document.getElementById('chat-container');
    
    if (state.isExpanded) {
        chatContainer.classList.add('expanded');
    } else {
        chatContainer.classList.remove('expanded');
    }
}

function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
        processMessage(message);
        input.value = '';
    }
}

async function processMessage(message, retryCount = 0) {
    try {
        // Mostrar mensaje del usuario
        if (message !== "inicio") {
            addMessage(message, 'user');
        }
        
        // Mostrar indicador de escritura
        showTypingIndicator();
        
        // Actualizar métricas
        state.metrics.messagesSent++;
        updateMetricsChart();
        
        // Preparar datos para el servidor
        const requestData = {
            message: message,
            user_id: state.userId,
            isEmergency: state.isEmergency,
            current_state: state.currentState,
            alarm_number: state.currentAlarmNumber
        };
        
        let response;
        
        // Determinar qué endpoint usar
        if (state.currentState === 'await_alarm_number' || state.currentState === 'await_element_name') {
            // Usar endpoint handle_state para estados específicos
            response = await fetch(`${config.apiUrl}/handle_state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        } else {
            // Usar endpoint chat para mensajes generales
            response = await fetch(`${config.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Ocultar indicador de escritura
        hideTypingIndicator();
        
        // Mostrar respuesta del bot
        addMessage(data.response, 'bot', data.type);
        
        // Actualizar estado según la respuesta
        if (data.next_step) {
            state.currentState = data.next_step;
            
            if (data.next_step === 'await_alarm_number') {
                state.waitingForAlarmNumber = true;
                state.waitingForElementName = false;
            } else if (data.next_step === 'await_element_name') {
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = true;
                state.currentAlarmNumber = data.alarm_number;
            }
        } else {
            // Reset states
            state.currentState = '';
            state.waitingForAlarmNumber = false;
            state.waitingForElementName = false;
            state.currentAlarmNumber = null;
        }
        
        // Marcar conversación como iniciada
        state.conversationStarted = true;
        
        // Actualizar métricas si es consulta de alarma
        if (data.type === 'alarm_resolved') {
            state.metrics.alarmsChecked++;
            updateMetricsChart();
        }
        
        // Mostrar sugerencias inteligentes
        showSmartSuggestions({
            lastMessage: message,
            currentState: state.currentState,
            isEmergency: state.isEmergency
        });
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        hideTypingIndicator();

        // Reintentar si es necesario
        if (retryCount < config.maxRetries) {
            setTimeout(() => {
                processMessage(message, retryCount + 1);
            }, config.retryDelay * (retryCount + 1));
        } else {
            addMessage('Lo siento, hubo un problema de conexión. Por favor intenta nuevamente.', 'bot', 'error');
        }
    }
}

function addMessage(message, sender, type = 'normal') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Añadir clases adicionales según el tipo
    if (type === 'error') {
        messageDiv.classList.add('error-message');
    } else if (type === 'system') {
        messageDiv.classList.add('system-message');
    } else if (type === 'alarm_resolved') {
        messageDiv.classList.add('success-message');
    }
    
    // Formatear mensaje (convertir saltos de línea a HTML)
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    if (sender === 'bot' && !state.isOpen) {
        notifyNewMessage();
    }
}

// Notificación visual en la burbuja cuando hay mensaje nuevo y el chat está cerrado
function notifyNewMessage() {
    const chatBubble = document.getElementById('chat-bubble');
    if (!state.isOpen && chatBubble) {
        chatBubble.classList.add('nuevo-mensaje');
        // Opcional: agregar badge de notificación
        if (!chatBubble.querySelector('.badge-notif')) {
            const badge = document.createElement('span');
            badge.className = 'badge-notif';
            badge.textContent = '1';
            chatBubble.appendChild(badge);
        }
    }
}

// Quitar notificación visual al abrir el chat
function clearNewMessageNotification() {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) {
        chatBubble.classList.remove('nuevo-mensaje');
        const badge = chatBubble.querySelector('.badge-notif');
        if (badge) badge.remove();
    }
}

// Llama a clearNewMessageNotification() al abrir el chat
function toggleChat() {
    state.isOpen = !state.isOpen;
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    if (state.isOpen) {
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('show');
        chatBubble.classList.add('hidden');
        
        // Focus en el input
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);

        clearNewMessageNotification();
    } else {
        chatContainer.classList.remove('show');
        chatContainer.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    }
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    const chatContainer = document.getElementById('chat-container');
    
    if (state.isExpanded) {
        chatContainer.classList.add('expanded');
    } else {
        chatContainer.classList.remove('expanded');
    }
}

function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
        processMessage(message);
        input.value = '';
    }
}

async function processMessage(message, retryCount = 0) {
    try {
        // Mostrar mensaje del usuario
        if (message !== "inicio") {
            addMessage(message, 'user');
        }
        
        // Mostrar indicador de escritura
        showTypingIndicator();
        
        // Actualizar métricas
        state.metrics.messagesSent++;
        updateMetricsChart();
        
        // Preparar datos para el servidor
        const requestData = {
            message: message,
            user_id: state.userId,
            isEmergency: state.isEmergency,
            current_state: state.currentState,
            alarm_number: state.currentAlarmNumber
        };
        
        let response;
        
        // Determinar qué endpoint usar
        if (state.currentState === 'await_alarm_number' || state.currentState === 'await_element_name') {
            // Usar endpoint handle_state para estados específicos
            response = await fetch(`${config.apiUrl}/handle_state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        } else {
            // Usar endpoint chat para mensajes generales
            response = await fetch(`${config.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Ocultar indicador de escritura
        hideTypingIndicator();
        
        // Mostrar respuesta del bot
        addMessage(data.response, 'bot', data.type);
        
        // Actualizar estado según la respuesta
        if (data.next_step) {
            state.currentState = data.next_step;
            
            if (data.next_step === 'await_alarm_number') {
                state.waitingForAlarmNumber = true;
                state.waitingForElementName = false;
            } else if (data.next_step === 'await_element_name') {
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = true;
                state.currentAlarmNumber = data.alarm_number;
            }
        } else {
            // Reset states
            state.currentState = '';
            state.waitingForAlarmNumber = false;
            state.waitingForElementName = false;
            state.currentAlarmNumber = null;
        }
        
        // Marcar conversación como iniciada
        state.conversationStarted = true;
        
        // Actualizar métricas si es consulta de alarma
        if (data.type === 'alarm_resolved') {
            state.metrics.alarmsChecked++;
            updateMetricsChart();
        }
        
        // Mostrar sugerencias inteligentes
        showSmartSuggestions({
            lastMessage: message,
            currentState: state.currentState,
            isEmergency: state.isEmergency
        });
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        hideTypingIndicator();

        // Reintentar si es necesario
        if (retryCount < config.maxRetries) {
            setTimeout(() => {
                processMessage(message, retryCount + 1);
            }, config.retryDelay * (retryCount + 1));
        } else {
            addMessage('Lo siento, hubo un problema de conexión. Por favor intenta nuevamente.', 'bot', 'error');
        }
    }
}

function addMessage(message, sender, type = 'normal') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Añadir clases adicionales según el tipo
    if (type === 'error') {
        messageDiv.classList.add('error-message');
    } else if (type === 'system') {
        messageDiv.classList.add('system-message');
    } else if (type === 'alarm_resolved') {
        messageDiv.classList.add('success-message');
    }
    
    // Formatear mensaje (convertir saltos de línea a HTML)
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    if (sender === 'bot' && !state.isOpen) {
        notifyNewMessage();
    }
}

// Notificación visual en la burbuja cuando hay mensaje nuevo y el chat está cerrado
function notifyNewMessage() {
    const chatBubble = document.getElementById('chat-bubble');
    if (!state.isOpen && chatBubble) {
        chatBubble.classList.add('nuevo-mensaje');
        // Opcional: agregar badge de notificación
        if (!chatBubble.querySelector('.badge-notif')) {
            const badge = document.createElement('span');
            badge.className = 'badge-notif';
            badge.textContent = '1';
            chatBubble.appendChild(badge);
        }
    }
}

// Quitar notificación visual al abrir el chat
function clearNewMessageNotification() {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) {
        chatBubble.classList.remove('nuevo-mensaje');
        const badge = chatBubble.querySelector('.badge-notif');
        if (badge) badge.remove();
    }
}

// Llama a clearNewMessageNotification() al abrir el chat
function toggleChat() {
    state.isOpen = !state.isOpen;
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    if (state.isOpen) {
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('show');
        chatBubble.classList.add('hidden');
        
        // Focus en el input
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);

        clearNewMessageNotification();
    } else {
        chatContainer.classList.remove('show');
        chatContainer.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    }
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    const chatContainer = document.getElementById('chat-container');
    
    if (state.isExpanded) {
        chatContainer.classList.add('expanded');
    } else {
        chatContainer.classList.remove('expanded');
    }
}

function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
        processMessage(message);
        input.value = '';
    }
}

async function processMessage(message, retryCount = 0) {
    try {
        // Mostrar mensaje del usuario
        if (message !== "inicio") {
            addMessage(message, 'user');
        }
        
        // Mostrar indicador de escritura
        showTypingIndicator();
        
        // Actualizar métricas
        state.metrics.messagesSent++;
        updateMetricsChart();
        
        // Preparar datos para el servidor
        const requestData = {
            message: message,
            user_id: state.userId,
            isEmergency: state.isEmergency,
            current_state: state.currentState,
            alarm_number: state.currentAlarmNumber
        };
        
        let response;
        
        // Determinar qué endpoint usar
        if (state.currentState === 'await_alarm_number' || state.currentState === 'await_element_name') {
            // Usar endpoint handle_state para estados específicos
            response = await fetch(`${config.apiUrl}/handle_state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        } else {
            // Usar endpoint chat para mensajes generales
            response = await fetch(`${config.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Ocultar indicador de escritura
        hideTypingIndicator();
        
        // Mostrar respuesta del bot
        addMessage(data.response, 'bot', data.type);
        
        // Actualizar estado según la respuesta
        if (data.next_step) {
            state.currentState = data.next_step;
            
            if (data.next_step === 'await_alarm_number') {
                state.waitingForAlarmNumber = true;
                state.waitingForElementName = false;
            } else if (data.next_step === 'await_element_name') {
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = true;
                state.currentAlarmNumber = data.alarm_number;
            }
        } else {
            // Reset states
            state.currentState = '';
            state.waitingForAlarmNumber = false;
            state.waitingForElementName = false;
            state.currentAlarmNumber = null;
        }
        
        // Marcar conversación como iniciada
        state.conversationStarted = true;
        
        // Actualizar métricas si es consulta de alarma
        if (data.type === 'alarm_resolved') {
            state.metrics.alarmsChecked++;
            updateMetricsChart();
        }
        
        // Mostrar sugerencias inteligentes
        showSmartSuggestions({
            lastMessage: message,
            currentState: state.currentState,
            isEmergency: state.isEmergency
        });
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        hideTypingIndicator();

        // Reintentar si es necesario
        if (retryCount < config.maxRetries) {
            setTimeout(() => {
                processMessage(message, retryCount + 1);
            }, config.retryDelay * (retryCount + 1));
        } else {
            addMessage('Lo siento, hubo un problema de conexión. Por favor intenta nuevamente.', 'bot', 'error');
        }
    }
}

function addMessage(message, sender, type = 'normal') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Añadir clases adicionales según el tipo
    if (type === 'error') {
        messageDiv.classList.add('error-message');
    } else if (type === 'system') {
        messageDiv.classList.add('system-message');
    } else if (type === 'alarm_resolved') {
        messageDiv.classList.add('success-message');
    }
    
    // Formatear mensaje (convertir saltos de línea a HTML)
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    if (sender === 'bot' && !state.isOpen) {
        notifyNewMessage();
    }
}

// Notificación visual en la burbuja cuando hay mensaje nuevo y el chat está cerrado
function notifyNewMessage() {
    const chatBubble = document.getElementById('chat-bubble');
    if (!state.isOpen && chatBubble) {
        chatBubble.classList.add('nuevo-mensaje');
        // Opcional: agregar badge de notificación
        if (!chatBubble.querySelector('.badge-notif')) {
            const badge = document.createElement('span');
            badge.className = 'badge-notif';
            badge.textContent = '1';
            chatBubble.appendChild(badge);
        }
    }
}

// Quitar notificación visual al abrir el chat
function clearNewMessageNotification() {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) {
        chatBubble.classList.remove('nuevo-mensaje');
        const badge = chatBubble.querySelector('.badge-notif');
        if (badge) badge.remove();
    }
}

// Llama a clearNewMessageNotification() al abrir el chat
function toggleChat() {
    state.isOpen = !state.isOpen;
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    if (state.isOpen) {
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('show');
        chatBubble.classList.add('hidden');
        
        // Focus en el input
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);

        clearNewMessageNotification();
    } else {
        chatContainer.classList.remove('show');
        chatContainer.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    }
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    const chatContainer = document.getElementById('chat-container');
    
    if (state.isExpanded) {
        chatContainer.classList.add('expanded');
    } else {
        chatContainer.classList.remove('expanded');
    }
}

function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
        processMessage(message);
        input.value = '';
    }
}

async function processMessage(message, retryCount = 0) {
    try {
        // Mostrar mensaje del usuario
        if (message !== "inicio") {
            addMessage(message, 'user');
        }
        
        // Mostrar indicador de escritura
        showTypingIndicator();
        
        // Actualizar métricas
        state.metrics.messagesSent++;
        updateMetricsChart();
        
        // Preparar datos para el servidor
        const requestData = {
            message: message,
            user_id: state.userId,
            isEmergency: state.isEmergency,
            current_state: state.currentState,
            alarm_number: state.currentAlarmNumber
        };
        
        let response;
        
        // Determinar qué endpoint usar
        if (state.currentState === 'await_alarm_number' || state.currentState === 'await_element_name') {
            // Usar endpoint handle_state para estados específicos
            response = await fetch(`${config.apiUrl}/handle_state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        } else {
            // Usar endpoint chat para mensajes generales
            response = await fetch(`${config.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Ocultar indicador de escritura
        hideTypingIndicator();
        
        // Mostrar respuesta del bot
        addMessage(data.response, 'bot', data.type);
        
        // Actualizar estado según la respuesta
        if (data.next_step) {
            state.currentState = data.next_step;
            
            if (data.next_step === 'await_alarm_number') {
                state.waitingForAlarmNumber = true;
                state.waitingForElementName = false;
            } else if (data.next_step === 'await_element_name') {
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = true;
                state.currentAlarmNumber = data.alarm_number;
            }
        } else {
            // Reset states
            state.currentState = '';
            state.waitingForAlarmNumber = false;
            state.waitingForElementName = false;
            state.currentAlarmNumber = null;
        }
        
        // Marcar conversación como iniciada
        state.conversationStarted = true;
        
        // Actualizar métricas si es consulta de alarma
        if (data.type === 'alarm_resolved') {
            state.metrics.alarmsChecked++;
            updateMetricsChart();
        }
        
        // Mostrar sugerencias inteligentes
        showSmartSuggestions({
            lastMessage: message,
            currentState: state.currentState,
            isEmergency: state.isEmergency
        });
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        hideTypingIndicator();

        // Reintentar si es necesario
        if (retryCount < config.maxRetries) {
            setTimeout(() => {
                processMessage(message, retryCount + 1);
            }, config.retryDelay * (retryCount + 1));
        } else {
            addMessage('Lo siento, hubo un problema de conexión. Por favor intenta nuevamente.', 'bot', 'error');
        }
    }
}

function addMessage(message, sender, type = 'normal') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Añadir clases adicionales según el tipo
    if (type === 'error') {
        messageDiv.classList.add('error-message');
    } else if (type === 'system') {
        messageDiv.classList.add('system-message');
    } else if (type === 'alarm_resolved') {
        messageDiv.classList.add('success-message');
    }
    
    // Formatear mensaje (convertir saltos de línea a HTML)
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    if (sender === 'bot' && !state.isOpen) {
        notifyNewMessage();
    }
}

// Notificación visual en la burbuja cuando hay mensaje nuevo y el chat está cerrado
function notifyNewMessage() {
    const chatBubble = document.getElementById('chat-bubble');
    if (!state.isOpen && chatBubble) {
        chatBubble.classList.add('nuevo-mensaje');
        // Opcional: agregar badge de notificación
        if (!chatBubble.querySelector('.badge-notif')) {
            const badge = document.createElement('span');
            badge.className = 'badge-notif';
            badge.textContent = '1';
            chatBubble.appendChild(badge);
        }
    }
}

// Quitar notificación visual al abrir el chat
function clearNewMessageNotification() {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) {
        chatBubble.classList.remove('nuevo-mensaje');
        const badge = chatBubble.querySelector('.badge-notif');
        if (badge) badge.remove();
    }
}

// Llama a clearNewMessageNotification() al abrir el chat
function toggleChat() {
    state.isOpen = !state.isOpen;
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    if (state.isOpen) {
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('show');
        chatBubble.classList.add('hidden');
        
        // Focus en el input
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);

        clearNewMessageNotification();
    } else {
        chatContainer.classList.remove('show');
        chatContainer.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    }
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    const chatContainer = document.getElementById('chat-container');
    
    if (state.isExpanded) {
        chatContainer.classList.add('expanded');
    } else {
        chatContainer.classList.remove('expanded');
    }
}

function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
        processMessage(message);
        input.value = '';
    }
}

async function processMessage(message, retryCount = 0) {
    try {
        // Mostrar mensaje del usuario
        if (message !== "inicio") {
            addMessage(message, 'user');
        }
        
        // Mostrar indicador de escritura
        showTypingIndicator();
        
        // Actualizar métricas
        state.metrics.messagesSent++;
        updateMetricsChart();
        
        // Preparar datos para el servidor
        const requestData = {
            message: message,
            user_id: state.userId,
            isEmergency: state.isEmergency,
            current_state: state.currentState,
            alarm_number: state.currentAlarmNumber
        };
        
        let response;
        
        // Determinar qué endpoint usar
        if (state.currentState === 'await_alarm_number' || state.currentState === 'await_element_name') {
            // Usar endpoint handle_state para estados específicos
            response = await fetch(`${config.apiUrl}/handle_state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        } else {
            // Usar endpoint chat para mensajes generales
            response = await fetch(`${config.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Ocultar indicador de escritura
        hideTypingIndicator();
        
        // Mostrar respuesta del bot
        addMessage(data.response, 'bot', data.type);
        
        // Actualizar estado según la respuesta
        if (data.next_step) {
            state.currentState = data.next_step;
            
            if (data.next_step === 'await_alarm_number') {
                state.waitingForAlarmNumber = true;
                state.waitingForElementName = false;
            } else if (data.next_step === 'await_element_name') {
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = true;
                state.currentAlarmNumber = data.alarm_number;
            }
        } else {
            // Reset states
            state.currentState = '';
            state.waitingForAlarmNumber = false;
            state.waitingForElementName = false;
            state.currentAlarmNumber = null;
        }
        
        // Marcar conversación como iniciada
        state.conversationStarted = true;
        
        // Actualizar métricas si es consulta de alarma
        if (data.type === 'alarm_resolved') {
            state.metrics.alarmsChecked++;
            updateMetricsChart();
        }
        
        // Mostrar sugerencias inteligentes
        showSmartSuggestions({
            lastMessage: message,
            currentState: state.currentState,
            isEmergency: state.isEmergency
        });
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        hideTypingIndicator();

        // Reintentar si es necesario
        if (retryCount < config.maxRetries) {
            setTimeout(() => {
                processMessage(message, retryCount + 1);
            }, config.retryDelay * (retryCount + 1));
        } else {
            addMessage('Lo siento, hubo un problema de conexión. Por favor intenta nuevamente.', 'bot', 'error');
        }
    }
}

function addMessage(message, sender, type = 'normal') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Añadir clases adicionales según el tipo
    if (type === 'error') {
        messageDiv.classList.add('error-message');
    } else if (type === 'system') {
        messageDiv.classList.add('system-message');
    } else if (type === 'alarm_resolved') {
        messageDiv.classList.add('success-message');
    }
    
    // Formatear mensaje (convertir saltos de línea a HTML)
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    if (sender === 'bot' && !state.isOpen) {
        notifyNewMessage();
    }
}

// Notificación visual en la burbuja cuando hay mensaje nuevo y el chat está cerrado
function notifyNewMessage() {
    const chatBubble = document.getElementById('chat-bubble');
    if (!state.isOpen && chatBubble) {
        chatBubble.classList.add('nuevo-mensaje');
        // Opcional: agregar badge de notificación
        if (!chatBubble.querySelector('.badge-notif')) {
            const badge = document.createElement('span');
            badge.className = 'badge-notif';
            badge.textContent = '1';
            chatBubble.appendChild(badge);
        }
    }
}

// Quitar notificación visual al abrir el chat
function clearNewMessageNotification() {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) {
        chatBubble.classList.remove('nuevo-mensaje');
        const badge = chatBubble.querySelector('.badge-notif');
        if (badge) badge.remove();
    }
}

// Llama a clearNewMessageNotification() al abrir el chat
function toggleChat() {
    state.isOpen = !state.isOpen;
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    if (state.isOpen) {
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('show');
        chatBubble.classList.add('hidden');
        
        // Focus en el input
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);

        clearNewMessageNotification();
    } else {
        chatContainer.classList.remove('show');
        chatContainer.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    }
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    const chatContainer = document.getElementById('chat-container');
    
    if (state.isExpanded) {
        chatContainer.classList.add('expanded');
    } else {
        chatContainer.classList.remove('expanded');
    }
}

function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
        processMessage(message);
        input.value = '';
    }
}

async function processMessage(message, retryCount = 0) {
    try {
        // Mostrar mensaje del usuario
        if (message !== "inicio") {
            addMessage(message, 'user');
        }
        
        // Mostrar indicador de escritura
        showTypingIndicator();
        
        // Actualizar métricas
        state.metrics.messagesSent++;
        updateMetricsChart();
        
        // Preparar datos para el servidor
        const requestData = {
            message: message,
            user_id: state.userId,
            isEmergency: state.isEmergency,
            current_state: state.currentState,
            alarm_number: state.currentAlarmNumber
        };
        
        let response;
        
        // Determinar qué endpoint usar
        if (state.currentState === 'await_alarm_number' || state.currentState === 'await_element_name') {
            // Usar endpoint handle_state para estados específicos
            response = await fetch(`${config.apiUrl}/handle_state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        } else {
            // Usar endpoint chat para mensajes generales
            response = await fetch(`${config.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Ocultar indicador de escritura
        hideTypingIndicator();
        
        // Mostrar respuesta del bot
        addMessage(data.response, 'bot', data.type);
        
        // Actualizar estado según la respuesta
        if (data.next_step) {
            state.currentState = data.next_step;
            
            if (data.next_step === 'await_alarm_number') {
                state.waitingForAlarmNumber = true;
                state.waitingForElementName = false;
            } else if (data.next_step === 'await_element_name') {
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = true;
                state.currentAlarmNumber = data.alarm_number;
            }
        } else {
            // Reset states
            state.currentState = '';
            state.waitingForAlarmNumber = false;
            state.waitingForElementName = false;
            state.currentAlarmNumber = null;
        }
        
        // Marcar conversación como iniciada
        state.conversationStarted = true;
        
        // Actualizar métricas si es consulta de alarma
        if (data.type === 'alarm_resolved') {
            state.metrics.alarmsChecked++;
            updateMetricsChart();
        }
        
        // Mostrar sugerencias inteligentes
        showSmartSuggestions({
            lastMessage: message,
            currentState: state.currentState,
            isEmergency: state.isEmergency
        });
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        hideTypingIndicator();

        // Reintentar si es necesario
        if (retryCount < config.maxRetries) {
            setTimeout(() => {
                processMessage(message, retryCount + 1);
            }, config.retryDelay * (retryCount + 1));
        } else {
            addMessage('Lo siento, hubo un problema de conexión. Por favor intenta nuevamente.', 'bot', 'error');
        }
    }
}

function addMessage(message, sender, type = 'normal') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Añadir clases adicionales según el tipo
    if (type === 'error') {
        messageDiv.classList.add('error-message');
    } else if (type === 'system') {
        messageDiv.classList.add('system-message');
    } else if (type === 'alarm_resolved') {
        messageDiv.classList.add('success-message');
    }
    
    // Formatear mensaje (convertir saltos de línea a HTML)
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    if (sender === 'bot' && !state.isOpen) {
        notifyNewMessage();
    }
}

// Notificación visual en la burbuja cuando hay mensaje nuevo y el chat está cerrado
function notifyNewMessage() {
    const chatBubble = document.getElementById('chat-bubble');
    if (!state.isOpen && chatBubble) {
        chatBubble.classList.add('nuevo-mensaje');
        // Opcional: agregar badge de notificación
        if (!chatBubble.querySelector('.badge-notif')) {
            const badge = document.createElement('span');
            badge.className = 'badge-notif';
            badge.textContent = '1';
            chatBubble.appendChild(badge);
        }
    }
}

// Quitar notificación visual al abrir el chat
function clearNewMessageNotification() {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) {
        chatBubble.classList.remove('nuevo-mensaje');
        const badge = chatBubble.querySelector('.badge-notif');
        if (badge) badge.remove();
    }
}

// Llama a clearNewMessageNotification() al abrir el chat
function toggleChat() {
    state.isOpen = !state.isOpen;
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    if (state.isOpen) {
        chatContainer.classList.remove('hidden');
        chatContainer.classList.add('show');
        chatBubble.classList.add('hidden');
        
        // Focus en el input
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);

        clearNewMessageNotification();
    } else {
        chatContainer.classList.remove('show');
        chatContainer.classList.add('hidden');
        chatBubble.classList.remove('hidden');
    }
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    const chatContainer = document.getElementById('chat-container');
    
    if (state.isExpanded) {
        chatContainer.classList.add('expanded');
    } else {
        chatContainer.classList.remove('expanded');
    }
}

function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message) {
        processMessage(message);
        input.value = '';
    }
}

async function processMessage(message, retryCount = 0) {
    try {
        // Mostrar mensaje del usuario
        if (message !== "inicio") {
            addMessage(message, 'user');
        }
        
        // Mostrar indicador de escritura
        showTypingIndicator();
        
        // Actualizar métricas
        state.metrics.messagesSent++;
        updateMetricsChart();
        
        // Preparar datos para el servidor
        const requestData = {
            message: message,
            user_id: state.userId,
            isEmergency: state.isEmergency,
            current_state: state.currentState,
            alarm_number: state.currentAlarmNumber
        };
        
        let response;
        
        // Determinar qué endpoint usar
        if (state.currentState === 'await_alarm_number' || state.currentState === 'await_element_name') {
            // Usar endpoint handle_state para estados específicos
            response = await fetch(`${config.apiUrl}/handle_state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        } else {
            // Usar endpoint chat para mensajes generales
            response = await fetch(`${config.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
                timeout: config.timeout
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Ocultar indicador de escritura
        hideTypingIndicator();
        
        // Mostrar respuesta del bot
        addMessage(data.response, 'bot', data.type);
        
        // Actualizar estado según la respuesta
        if (data.next_step) {
            state.currentState = data.next_step;
            
            if (data.next_step === 'await_alarm_number') {
                state.waitingForAlarmNumber = true;
                state.waitingForElementName = false;
            } else if (data.next_step === 'await_element_name') {
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = true;
                state.currentAlarmNumber = data.alarm_number;
            }
        } else {
            // Reset states
            state.currentState = '';
            state.waitingForAlarmNumber = false;
            state.waitingForElementName = false;
            state.currentAlarmNumber = null;
        }
        
        // Marcar conversación como iniciada
        state.conversationStarted = true;
        
        // Actualizar métricas si es consulta de alarma
        if (data.type === 'alarm_resolved') {
            state.metrics.alarmsChecked++;
            updateMetricsChart();
        }
        
        // Mostrar sugerencias inteligentes
        showSmartSuggestions({
            lastMessage: message,
            currentState: state.currentState,
            isEmergency: state.isEmergency
        });
        
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        hideTypingIndicator();

        // Reintentar si es necesario
        if (retryCount < config.maxRetries) {
            setTimeout(() => {
                processMessage(message, retryCount + 1);
            }, config.retryDelay * (retryCount + 1));
        } else {
            addMessage('Lo siento, hubo un problema de conexión. Por favor intenta nuevamente.', 'bot', 'error');
        }
    }
}

function addMessage(message, sender, type = 'normal') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Añadir clases adicionales según el tipo
    if (type === 'error') {
        messageDiv.classList.add('error-message');
    } else if (type === 'system') {
        messageDiv.classList.add('system-message');
    } else if (type === 'alarm_resolved') {
        messageDiv.classList.add('success-message');
    }
    
    // Formatear mensaje (convertir saltos de línea a HTML)
    const formattedMessage = message.replace(/\n/g, '<br>');
    messageDiv.innerHTML = `
        <div class="message-content">${formattedMessage}</div>
        <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    if (sender === 'bot' && !state.isOpen) {
        notifyNewMessage();
    }
}

// Notificación visual en la burbuja cuando hay mensaje nuevo y el chat está cerrado
function notifyNewMessage() {
    const chatBubble = document.getElementById('chat-bubble');
    if (!state.isOpen && chatBubble) {
        chatBubble.classList.add('nuevo-mensaje');
        // Opcional: agregar badge de notificación
        if (!chatBubble.querySelector('.badge-notif')) {
            const badge = document.createElement('span');
            badge.className = 'badge-notif';
            badge.textContent = '1';
            chatBubble.appendChild(badge);
        }
    }
}

// Quitar notificación visual al abrir el chat
function clearNewMessageNotification() {
    const chatBubble = document.getElementById('chat-bubble');
    if (chatBubble) {
        chatBubble.classList.remove('nuevo-mensaje');
        const badge = chatBubble.querySelector('.badge-notif');
        if (badge) badge.remove();
    }
}

// Llama a clearNewMessageNotification() al abrir el chat
function toggleChat() {
    state.isOpen = !state.isOpen;
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble')};