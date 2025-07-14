// ========= CONFIGURACIÓN DEL SISTEMA =========
const ALARM_KEYWORDS = ['alarma', 'alarmas', 'problema', 'falla', 'error'];
const PLATFORM_KEYWORDS = ['core', 'plataforma', 'sistema', 'servidor'];

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

// === MENSAJES DE INICIO ===
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
            Buen día, hablemos de nuestras plataformas de Core. ¿Qué te gustaría consultar hoy?`;
}

function getMenuMessage() {
    return `📋 <strong>Opciones disponibles:</strong>
            ---
            1️⃣ Alarmas de plataformas
            2️⃣ Documentación de las plataformas
            3️⃣ Incidentes activos de las plataformas
            4️⃣ Estado operativo de las plataformas
            5️⃣ Cambios activos en las plataformas
            6️⃣ Hablar con el administrador de la plataforma
            ---
            💡 <em>Por favor ingresa el número de la opción que deseas consultar</em>`;
}

// === RESPUESTA DEL BOT ===
function handleBotResponse(data) {
    if (data.command) handleSpecialCommands(data);
    
    addMessage(data.response, 'bot', data.type || 'normal');

    if (data.alarms_checked) state.metrics.alarmsChecked += data.alarms_checked;
    if (data.type === 'emergency') activateEmergencyMode(true);

    if (data.next_step === 'request_alarm_number') {
        state.waitingForAlarmNumber = true;
        state.waitingForElementName = false;
    } else if (data.next_step === 'request_element_name') {
        state.waitingForAlarmNumber = false;
        state.waitingForElementName = true;
    } else if (data.next_step === 'provide_alarm_details') {
        state.waitingForAlarmNumber = false;
        state.waitingForElementName = false;
    }
}

// === PROCESO DE CONSULTA DE ALARMAS ===
async function processAlarmInquiry(message) {
    if (message.match(/^[1-6]$/)) {
        switch(message) {
            case '1':
                return {
                    response: 'Por favor ingrese el número de alarma que desea consultar',
                    type: 'system',
                    next_step: 'request_alarm_number'
                };
            case '2':
                return {
                    response: '📚 Documentación disponible:\n\n1. Manual de usuario\n2. Especificaciones técnicas\n3. Protocolos de operación\n\n¿Qué documentación necesitas?',
                    type: 'system'
                };
            default:
                return {
                    response: 'Opción no reconocida. Por favor selecciona un número del 1 al 6.',
                    type: 'system'
                };
        }
    } else if (state.waitingForAlarmNumber) {
        state.currentAlarmNumber = message;
        return {
            response: 'Por favor ingresa el nombre del elemento que reporta la alarma',
            type: 'system',
            next_step: 'request_element_name',
            alarm_number: message
        };
    } else if (state.waitingForElementName) {
        const alarmDetails = await fetchAlarmDetails(state.currentAlarmNumber, message);
        return {
            response: formatAlarmDetails(alarmDetails),
            type: 'alarms',
            next_step: 'provide_alarm_details',
            alarms_checked: 1
        };
    }
    return null;
}

async function fetchAlarmDetails(alarmNumber, elementName) {
    return {
        id: alarmNumber,
        element: elementName,
        status: 'Activa',
        severity: 'Alta',
        firstOccurrence: new Date().toISOString(),
        description: 'Falla de comunicación con el elemento',
        recommendedActions: [
            'Verificar conectividad física',
            'Reiniciar el servicio',
            'Contactar al equipo de soporte si persiste'
        ]
    };
}

function formatAlarmDetails(details) {
    return `🚨 <strong>Detalles de la Alarma #${details.id}</strong>
            ---
            🔹 <strong>Elemento:</strong> ${details.element}
            🔹 <strong>Estado:</strong> ${details.status}
            🔹 <strong>Severidad:</strong> ${details.severity}
            🔹 <strong>Primera ocurrencia:</strong> ${new Date(details.firstOccurrence).toLocaleString()}
            ---
            📝 <strong>Descripción:</strong>
            ${details.description}
            ---
            ✅ <strong>Acciones recomendadas:</strong>
            ${details.recommendedActions.map((action, i) => `${i+1}. ${action}`).join('\n')}
            ---
            ¿Necesitas más información sobre esta alarma?`;
}

// === PROCESAMIENTO GENERAL DE MENSAJES ===
async function processMessage(message, retryCount = 0) {
    const startTime = Date.now();

    if (handleLocalCommands(message)) return;

    const alarmResponse = await processAlarmInquiry(message);
    if (alarmResponse) {
        handleBotResponse(alarmResponse);
        return;
    }

    showTyping();

    try {
        const isEmergency = checkEmergency(message);

        const payload = {
            message,
            user_id: state.userId,
            isEmergency,
            timestamp: new Date().toISOString(),
            sessionData: getSessionData()
        };

        if (state.waitingForElementName && state.currentAlarmNumber) {
            payload.alarm_number = state.currentAlarmNumber;
        }

        const response = await fetchWithTimeout('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }, config.timeout);

        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const data = await response.json();
        hideTyping();

        state.metrics.responseTime = Date.now() - startTime;
        handleBotResponse(data);

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

// === EXPANDIR Y CONTRAER CHAT ===
function toggleChatExpand() {
    const chatBox = document.querySelector('.chat-window');
    chatBox.classList.toggle('expanded');
    state.isExpanded = !state.isExpanded;
}
