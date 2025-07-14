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
    document.getElementById('chat-container').classList.add('hidden');
    document.getElementById('chat-bubble').addEventListener('click', toggleChat);
    document.getElementById('expand-chat').addEventListener('click', toggleChatExpand);
    document.getElementById('chat-form').addEventListener('submit', handleSubmit);
}

function setupEventListeners() {
    document.getElementById('emergency-btn').addEventListener('click', () => {
        activateEmergencyMode(true);
        processMessage("¡Necesito ayuda urgente!");
    });

    // Inactividad
    setInterval(checkInactivity, 300000); // 5 minutos
    document.addEventListener('mousemove', updateActivity);
    document.addEventListener('keypress', updateActivity);
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

        if (state.waitingForElementName && state.currentAlarmNumber) {
            payload.alarm_number = state.currentAlarmNumber;
            payload.current_state = 'await_element_name';
        }

        const response = await fetchWithTimeout('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }, config.timeout);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        handleBotResponse(data);

    } catch (error) {
        if (retryCount < config.maxRetries) {
            setTimeout(() => processMessage(message, retryCount + 1), config.retryDelay);
        } else {
            addMessage(getErrorMessage(error), 'bot', 'error');
        }
    } finally {
        hideTyping();
    }
}

// Procesamiento de alarmas
async function processAlarmInquiry(message) {
    try {
        if (message.match(/^[1-6]$/)) {
            switch(message) {
                case '1':
                    return {
                        response: 'Por favor ingrese el número de alarma que desea consultar',
                        type: 'system',
                        next_step: 'request_alarm_number'
                    };
                default:
                    return {
                        response: 'Opción no reconocida. Por favor selecciona un número del 1 al 6.',
                        type: 'system'
                    };
            }
        } else if (state.waitingForAlarmNumber) {
            if (!message.match(/^\d+$/)) {
                return {
                    response: '❌ El número de alarma debe contener solo dígitos',
                    type: 'error',
                    next_step: 'request_alarm_number'
                };
            }

            state.currentAlarmNumber = message;
            return {
                response: 'Por favor ingresa el nombre del elemento que reporta la alarma',
                type: 'system',
                next_step: 'request_element_name',
                alarm_number: message
            };
        } else if (state.waitingForElementName) {
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

            if (!response.ok) throw new Error('Error en la respuesta');
            return await response.json();
        }
        return null;
    } catch (error) {
        console.error('Error procesando alarma:', error);
        return {
            response: 'Error procesando la alarma. Intenta nuevamente.',
            type: 'error'
        };
    }
}

// Manejo de respuesta del bot
function handleBotResponse(data) {
    if (!data) return;

    addMessage(data.response, 'bot', data.type || 'normal');

    // Actualizar estado
    const frontendState = STATE_MAPPING[data.next_step] || '';
    state.waitingForAlarmNumber = (frontendState === 'request_alarm_number');
    state.waitingForElementName = (frontendState === 'request_element_name');

    // Actualizar métricas
    if (data.alarms_checked) state.metrics.alarmsChecked += data.alarms_checked;
    if (data.type === 'emergency') activateEmergencyMode(true);
}

// Funciones auxiliares
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
        showNotification('Modo emergencia activado', 'error');
    }
}

function toggleChat() {
    state.isOpen = !state.isOpen;
    const container = document.getElementById('chat-container');
    container.classList.toggle('hidden');
    container.classList.toggle('show');
    if (state.isOpen) document.getElementById('chat-input').focus();
}

function toggleChatExpand() {
    state.isExpanded = !state.isExpanded;
    document.getElementById('chat-container').classList.toggle('expanded');
}

// ... (resto de funciones auxiliares como addMessage, showTyping, etc.)