// Configuración
const config = {
    timeout: 5000,
    maxRetries: 3,
    retryDelay: 2000
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
    metrics: {
        messagesSent: 0,
        alarmsChecked: 0,
        emergencies: 0,
        satisfaction: 4.5,
        responseTime: 0,
        sessionsToday: 1
    }
};

// Mapeo de estados backend-frontend
const STATE_MAPPING = {
    'await_alarm_number': 'request_alarm_number',
    'await_element_name': 'request_element_name',
    '': 'provide_alarm_details'
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    initChat();
    setupEventListeners();
    showWelcomeMessage();
    startConnectionMonitor();
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

// Manejo de mensajes
async function processMessage(message, retryCount = 0) {
    if (!message.trim()) return;

    state.messagesSent++;
    addMessage(message, 'user');
    updateActivity();

    if (await checkConnection() === false) {
        return addMessage('⚠️ No hay conexión con el servidor. Intenta nuevamente más tarde.', 'bot', 'error');
    }

    // Procesar alarmas ANTES de enviar al endpoint general
    const alarmResponse = await processAlarmInquiry(message);
    if (alarmResponse) {
        return handleBotResponse(alarmResponse);
    }

    showTyping();

    try {
        const payload = {
            message,
            user_id: state.userId,
            isEmergency: state.isEmergency,
            timestamp: new Date().toISOString()
        };

        const response = await fetchWithTimeout('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }, config.timeout);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        handleBotResponse(data);

    } catch (error) {
        console.error('Error en processMessage:', error);
        if (retryCount < config.maxRetries) {
            setTimeout(() => processMessage(message, retryCount + 1), config.retryDelay);
        } else {
            addMessage(getErrorMessage(error), 'bot', 'error');
        }
    } finally {
        hideTyping();
    }
}

// Procesamiento de alarmas - VERSIÓN CORREGIDA
async function processAlarmInquiry(message) {
    try {
        // Paso 1: Usuario selecciona opción "1"
        if (message.match(/^[1-6]$/)) {
            switch(message) {
                case '1':
                    state.waitingForAlarmNumber = true;
                    state.waitingForElementName = false;
                    state.currentAlarmNumber = null;
                    return {
                        response: '🔍 **Consulta de Alarma**\n\nPor favor, ingresa el número de alarma que deseas consultar:',
                        type: 'system',
                        next_step: 'request_alarm_number'
                    };
                case '2':
                    return {
                        response: '📋 **Historial de Alarmas**\n\nEsta función estará disponible próximamente.',
                        type: 'system'
                    };
                case '3':
                    activateEmergencyMode(true);
                    return {
                        response: '🚨 **Modo Emergencia Activado**\n\nDescribe tu emergencia:',
                        type: 'emergency'
                    };
                case '4':
                    return {
                        response: '📊 **Estadísticas del Sistema**\n\nEsta función estará disponible próximamente.',
                        type: 'system'
                    };
                case '5':
                    return {
                        response: '📖 **Manual de Procedimientos**\n\nEsta función estará disponible próximamente.',
                        type: 'system'
                    };
                case '6':
                    return {
                        response: '👥 **Contactar Soporte**\n\nEsta función estará disponible próximamente.',
                        type: 'system'
                    };
                default:
                    return {
                        response: '❌ Opción no reconocida. Por favor selecciona un número del 1 al 6.',
                        type: 'error'
                    };
            }
        } 
        // Paso 2: Usuario ingresa número de alarma
        else if (state.waitingForAlarmNumber) {
            if (!message.match(/^\d+$/)) {
                return {
                    response: '❌ El número de alarma debe contener solo dígitos. Intenta nuevamente:',
                    type: 'error',
                    next_step: 'request_alarm_number'
                };
            }

            // Comunicar al backend para procesar el número de alarma
            try {
                const response = await fetch('/handle_state', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: message,
                        current_state: 'await_alarm_number',
                        user_id: state.userId
                    })
                });

                if (!response.ok) throw new Error('Error en la respuesta del servidor');
                
                const data = await response.json();
                
                // Actualizar estado local
                state.currentAlarmNumber = message;
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = true;
                
                return data;
                
            } catch (error) {
                console.error('Error comunicando con backend:', error);
                return {
                    response: '❌ Error de comunicación con el servidor. Intenta nuevamente.',
                    type: 'error'
                };
            }
        } 
        // Paso 3: Usuario ingresa nombre del elemento
        else if (state.waitingForElementName && state.currentAlarmNumber) {
            try {
                const response = await fetch('/handle_state', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: message,
                        current_state: 'await_element_name',
                        alarm_number: state.currentAlarmNumber,
                        user_id: state.userId
                    })
                });

                if (!response.ok) throw new Error('Error en la respuesta del servidor');
                
                const data = await response.json();
                
                // Reset del estado después de completar la consulta
                state.waitingForAlarmNumber = false;
                state.waitingForElementName = false;
                state.currentAlarmNumber = null;
                
                // Actualizar métricas
                if (data.type === 'alarm_resolved') {
                    state.metrics.alarmsChecked++;
                }
                
                return data;
                
            } catch (error) {
                console.error('Error procesando elemento:', error);
                return {
                    response: '❌ Error procesando la consulta de alarma. Intenta nuevamente.',
                    type: 'error'
                };
            }
        }
        
        return null;
        
    } catch (error) {
        console.error('Error en processAlarmInquiry:', error);
        return {
            response: '❌ Error procesando la alarma. Intenta nuevamente.',
            type: 'error'
        };
    }
}

function handleBotResponse(data) {
    if (!data) return;

    addMessage(data.response, 'bot', data.type || 'normal');

    // Manejo de estados
    if (data.next_step) {
        const frontendState = STATE_MAPPING[data.next_step] || data.next_step;
        state.waitingForAlarmNumber = (frontendState === 'request_alarm_number');
        state.waitingForElementName = (frontendState === 'request_element_name');
        
        if (data.alarm_number) {
            state.currentAlarmNumber = data.alarm_number;
        }
    }

    // Reset completo si la consulta se resolvió
    if (data.type === 'alarm_resolved') {
        state.waitingForAlarmNumber = false;
        state.waitingForElementName = false;
        state.currentAlarmNumber = null;
    }

    // Actualizar métricas
    if (data.alarms_checked) state.metrics.alarmsChecked += data.alarms_checked;
    if (data.type === 'emergency') activateEmergencyMode(true);
}

// Funciones de UI
function toggleChat() {
    state.isOpen = !state.isOpen;
    const container = document.getElementById('chat-container');
    const bubble = document.getElementById('chat-bubble');
    
    if (state.isOpen) {
        // Abrir chat
        container.classList.remove('hidden');
        container.classList.add('show');
        bubble.classList.add('hidden');
        
        // Focus en el input después de la animación
        setTimeout(() => {
            document.getElementById('chat-input').focus();
        }, 300);
    } else {
        // Cerrar chat
        container.classList.remove('show');
        container.classList.add('hidden');
        bubble.classList.remove('hidden');
        
        // Resetear expansión
        state.isExpanded = false;
        container.classList.remove('expanded');
    }
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    const container = document.getElementById('chat-container');
    container.classList.toggle('expanded');
    
    // Scroll al final después de expandir
    if (state.isExpanded) {
        setTimeout(() => {
            scrollToBottom();
        }, 300);
    }
}

function addMessage(message, sender, type = 'normal') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    
    messageDiv.className = `message ${sender}-message`;
    
    if (type === 'error') {
        messageDiv.classList.add('error');
    } else if (type === 'emergency') {
        messageDiv.classList.add('emergency');
    } else if (type === 'system') {
        messageDiv.classList.add('system');
    }
    
    // Procesar markdown básico
    const processedMessage = processMarkdown(message);
    messageDiv.innerHTML = processedMessage;
    
    // Agregar timestamp
    const timestamp = document.createElement('div');
    timestamp.className = 'message-timestamp';
    timestamp.textContent = new Date().toLocaleTimeString();
    messageDiv.appendChild(timestamp);
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function processMarkdown(text) {
    // Procesar markdown básico
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}

function showTyping() {
    if (state.isTyping) return;
    
    state.isTyping = true;
    const messagesContainer = document.getElementById('chat-messages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message typing';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
    
    messagesContainer.appendChild(typingDiv);
    scrollToBottom();
}

function hideTyping() {
    state.isTyping = false;
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showWelcomeMessage() {
    if (!state.conversationStarted) {
        setTimeout(() => {
            addMessage('¡Hola! Soy tu asistente de alarmas CMM. Haz clic en el botón flotante para comenzar.', 'bot', 'system');
        }, 1000);
    }
}

// Funciones auxiliares
function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

async function checkConnection() {
    try {
        const response = await fetch('/health');
        if (!response.ok) throw new Error('Servidor no saludable');
        return true;
    } catch (error) {
        console.error('Error de conexión:', error);
        return false;
    }
}

function fetchWithTimeout(url, options, timeout) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), timeout)
        )
    ]);
}

function activateEmergencyMode(active) {
    state.isEmergency = active;
    document.body.classList.toggle('emergency-mode', active);
    
    if (active) {
        showNotification('🚨 Modo emergencia activado', 'error');
        state.metrics.emergencies++;
    }
}

function showNotification(message, type = 'info') {
    // Crear notificación
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Mostrar con animación
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Ocultar después de 3 segundos
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function updateActivity() {
    state.lastActivity = Date.now();
}

function checkInactivity() {
    const now = Date.now();
    const inactiveTime = now - state.lastActivity;
    
    if (inactiveTime > 300000 && state.isOpen) { // 5 minutos
        addMessage('¿Sigues ahí? He notado que no has estado activo por un tiempo.', 'bot', 'system');
    }
}

function startConnectionMonitor() {
    setInterval(async () => {
        const isConnected = await checkConnection();
        if (!isConnected) {
            showNotification('⚠️ Conexión perdida con el servidor', 'error');
        }
    }, 30000); // Cada 30 segundos
}

function getErrorMessage(error) {
    if (error.message.includes('Timeout')) {
        return '⏱️ La solicitud ha tardado demasiado. Intenta nuevamente.';
    } else if (error.message.includes('HTTP')) {
        return '🔌 Error de conexión con el servidor. Verifica tu conexión.';
    } else {
        return '❌ Ha ocurrido un error inesperado. Intenta nuevamente.';
    }
}

// Función de debug (remover en producción)
function debugState() {
    console.log('Estado actual:', {
        isOpen: state.isOpen,
        isExpanded: state.isExpanded,
        waitingForAlarmNumber: state.waitingForAlarmNumber,
        waitingForElementName: state.waitingForElementName,
        currentAlarmNumber: state.currentAlarmNumber,
        messagesSent: state.messagesSent,
        metrics: state.metrics
    });
}

// Exponer funciones para debugging
window.debugState = debugState;
window.state = state;