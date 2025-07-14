// ========= CONFIGURACIÓN DEL SISTEMA =========
const ALARM_KEYWORDS = ['alarma', 'alarmas', 'problema', 'falla', 'error'];
const PLATFORM_KEYWORDS = ['core', 'plataforma', 'sistema', 'servidor'];

// Modificar la función getWelcomeMessage para el nuevo saludo
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

// Modificar la función getMenuMessage para el nuevo menú
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

// Modificar la función handleBotResponse para manejar el nuevo flujo
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
    
    // Manejar el flujo de alarmas
    if (data.next_step === 'request_alarm_number') {
        state.waitingForAlarmNumber = true;
    } else if (data.next_step === 'request_element_name') {
        state.waitingForElementName = true;
    } else if (data.next_step === 'provide_alarm_details') {
        state.waitingForAlarmNumber = false;
        state.waitingForElementName = false;
    }
}

// Nueva función para procesar alarmas
async function processAlarmInquiry(message) {
    if (message.match(/^[1-6]$/)) {
        // Opción del menú seleccionada
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
            // ... otros casos del menú
            default:
                return {
                    response: 'Opción no reconocida. Por favor selecciona un número del 1 al 6.',
                    type: 'system'
                };
        }
    } else if (state.waitingForAlarmNumber) {
        // El usuario ha proporcionado un número de alarma
        return {
            response: 'Por favor ingresa el nombre del elemento que reporta la alarma',
            type: 'system',
            next_step: 'request_element_name',
            alarm_number: message
        };
    } else if (state.waitingForElementName) {
        // El usuario ha proporcionado el nombre del elemento
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

// Función para simular la búsqueda de detalles de alarma
async function fetchAlarmDetails(alarmNumber, elementName) {
    // En una implementación real, esto haría una llamada a la base de datos
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

// Función para formatear los detalles de la alarma
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

// Modificar la función processMessage para incluir el nuevo flujo
async function processMessage(message, retryCount = 0) {
    const startTime = Date.now();
    
    // Verificar comandos locales primero
    if (handleLocalCommands(message)) {
        return;
    }
    
    // Verificar si es una consulta de alarma
    const alarmResponse = await processAlarmInquiry(message);
    if (alarmResponse) {
        handleBotResponse(alarmResponse);
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

// Actualizar el estado inicial para incluir las nuevas variables
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