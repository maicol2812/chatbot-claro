// Estados del chat
let chatState = {
    currentStep: 'welcome',
    selectedOption: null,
    alarmNumber: null,
    elementName: null
};

// Función para cargar alarmas desde Flask
async function fetchAlarms() {
    const response = await fetch('/api/alarms');
    return await response.json();
}

// Función para buscar una alarma específica
async function fetchSpecificAlarm(alarmNumber, elementName) {
    const response = await fetch(`/api/alarms?number=${alarmNumber}&element=${elementName}`);
    return await response.json();
}

// Mostrar opciones iniciales
function showWelcomeOptions() {
    const options = [
        "1. Alarmas de plataformas",
        "2. Documentación de las plataformas",
        "3. Incidentes activos de las plataformas",
        "4. Estado operativo de las plataformas",
        "5. Cambios activos en las plataformas",
        "6. Hablar con el administrador de la plataforma"
    ];
    
    addBotMessage(`Buen día, hablemos de nuestras plataformas de Core. ¿Qué te gustaría consultar hoy?<br><br>${options.join('<br>')}`);
}

// Mostrar alarmas en el chat
async function handleAlarmCommand() {
    const alarms = await fetchAlarms();
    const chatBox = document.getElementById('chat-box');
    
    // Limitar a 5 alarmas para no saturar
    const recentAlarms = alarms.slice(0, 5); 
    
    recentAlarms.forEach(alarm => {
        const alarmElement = document.createElement('div');
        alarmElement.className = 'bot-msg';
        alarmElement.innerHTML = `
            <strong>${alarm.Nombre || 'Alarma'}</strong>
            <div class="alarma-info">
                <p><b>ID:</b> ${alarm.ID}</p>
                <p><b>Severidad:</b> <span style="color: ${getSeverityColor(alarm.Severidad)}">${alarm.Severidad}</span></p>
                <p><b>Descripción:</b> ${alarm.Descripción || 'N/A'}</p>
            </div>
        `;
        chatBox.appendChild(alarmElement);
    });
}

// Procesar consulta de alarma específica
async function processSpecificAlarm() {
    const alarm = await fetchSpecificAlarm(chatState.alarmNumber, chatState.elementName);
    const chatBox = document.getElementById('chat-box');
    
    if (alarm && alarm.ID) {
        const alarmElement = document.createElement('div');
        alarmElement.className = 'bot-msg';
        alarmElement.innerHTML = `
            <strong>Alarma ${alarm.ID}</strong>
            <div class="alarma-info">
                <p><b>Elemento:</b> ${alarm.Elemento || 'N/A'}</p>
                <p><b>Severidad:</b> <span style="color: ${getSeverityColor(alarm.Severidad)}">${alarm.Severidad}</span></p>
                <p><b>Descripción:</b> ${alarm.Descripción || 'N/A'}</p>
                <p><b>Fecha:</b> ${alarm.Fecha || 'N/A'}</p>
                <p><b>Estado:</b> ${alarm.Estado || 'N/A'}</p>
            </div>
        `;
        chatBox.appendChild(alarmElement);
    } else {
        addBotMessage('No se encontró la alarma. Verifica el número y elemento.');
    }
    
    resetConversation();
}

// Color basado en severidad
function getSeverityColor(severity) {
    switch (severity?.toLowerCase()) {
        case 'alta': return '#ff4444';
        case 'media': return '#ffbb33';
        case 'baja': return '#00C851';
        default: return '#aaaaaa';
    }
}

// Función auxiliar para agregar mensajes del bot
function addBotMessage(text) {
    const chatBox = document.getElementById('chat-box');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'bot-msg';
    msgDiv.innerHTML = text;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Reiniciar conversación
function resetConversation() {
    chatState = {
        currentStep: 'welcome',
        selectedOption: null,
        alarmNumber: null,
        elementName: null
    };
    setTimeout(showWelcomeOptions, 3000);
}

// Manejar mensajes del usuario
function handleUserMessage(message) {
    const lowerMsg = message.toLowerCase();
    
    switch(chatState.currentStep) {
        case 'welcome':
            if (/^[1-6]$/.test(message)) {
                handleMainMenu(parseInt(message));
            } else {
                addBotMessage("Por favor selecciona una opción válida (1-6).");
                showWelcomeOptions();
            }
            break;
            
        case 'alarm_input':
            chatState.alarmNumber = message;
            chatState.currentStep = 'element_input';
            addBotMessage('Por favor ingresa el nombre del elemento que reporta la alarma:');
            break;
            
        case 'element_input':
            chatState.elementName = message;
            processSpecificAlarm();
            break;
            
        default:
            addBotMessage("No entendí tu solicitud. Por favor selecciona una opción válida.");
            showWelcomeOptions();
    }
}

// Manejar selección de menú principal
function handleMainMenu(option) {
    switch(option) {
        case 1:
            chatState.selectedOption = 'alarms';
            chatState.currentStep = 'alarm_input';
            addBotMessage('Por favor ingresa el número de alarma que deseas consultar:');
            break;
            
        case 2:
            addBotMessage('Documentación disponible:<br>- <a href="#">Manual de plataformas Core</a><br>- <a href="#">Procedimientos operativos</a>');
            resetConversation();
            break;
            
        case 3:
            addBotMessage('🔴 Incidentes activos:<br>- INC-001: Caída parcial en plataforma X (En investigación)');
            resetConversation();
            break;
            
        case 6:
            addBotMessage('Conectando con el administrador de plataforma...<br><button class="suggestion-btn">Iniciar chat directo</button>');
            resetConversation();
            break;
            
        default:
            addBotMessage('Opción en desarrollo. Por favor selecciona otra opción.');
            showWelcomeOptions();
    }
}

// Integración con el chatbot existente
document.addEventListener('DOMContentLoaded', () => {
    const sendBtn = document.getElementById('send-btn');
    const messageInput = document.getElementById('message-input');

    // Mostrar opciones iniciales al cargar
    showWelcomeOptions();

    // Manejar envío de mensajes
    sendBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (messageInput.value.trim()) {
            handleUserMessage(messageInput.value.trim());
            messageInput.value = '';
        }
    });

    // Manejar Enter
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && messageInput.value.trim()) {
            handleUserMessage(messageInput.value.trim());
            messageInput.value = '';
        }
    });
});