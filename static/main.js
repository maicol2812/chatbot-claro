// =========================
// Estado global del chat
// =========================
let chatState = {
    currentStep: 'welcome',
    selectedOption: null,
    isTyping: false,
    alarmData: { numero: null, elemento: null }
};

// =========================
// Manejador de DOM seguro
// =========================
const DOM = {
    elements: {},
    init() {
        const ids = [
            'chatMessages', 'messageInput', 'sendButton', 
            'typingIndicator', 'fileModal', 'modalTitle', 
            'modalDescription', 'modalDownload', 'modalView'
        ];
        ids.forEach(id => { this.elements[id] = document.getElementById(id); });
        this.setupEventListeners();
        return this;
    },
    get(id) { return this.elements[id] || null; },
    setupEventListeners() {
        const input = this.get('messageInput');
        const button = this.get('sendButton');
        if (button) button.addEventListener('click', handleSendMessage);
        if (input) {
            input.addEventListener('keypress', e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                }
            });
        }
    }
};

// Opciones principales
const mainOptions = [
    { id: 1, text: '🚨 Alarmas de plataformas', icon: 'fas fa-exclamation-triangle' },
    { id: 2, text: '📚 Documentación de las plataformas', icon: 'fas fa-book' },
    { id: 3, text: '⚠️ Incidentes activos de las plataformas', icon: 'fas fa-warning' },
    { id: 4, text: '✅ Estado operativo de las plataformas', icon: 'fas fa-check-circle' },
    { id: 5, text: '🔄 Cambios activos en las plataformas', icon: 'fas fa-sync' },
    { id: 6, text: '👤 Hablar con el administrador de la plataforma', icon: 'fas fa-user-tie' }
];

// =========================
// Inicialización
// =========================
document.addEventListener('DOMContentLoaded', () => {
    DOM.init();
    if (DOM.get('chatMessages')) showWelcomeMessage();
});

// =========================
// Flujo del chat
// =========================
function showWelcomeMessage() {
    showTypingIndicator();
    setTimeout(() => {
        hideTypingIndicator();
        addBotMessage('👋 ¡Bienvenido al Asistente de Alarmas de Claro!');
        setTimeout(showMainOptions, 5000);
    }, 1200);
}

function showMainOptions() {
    addBotMessage('¿En qué puedo ayudarte hoy?', mainOptions.map(opt => ({
        text: `${opt.text}`, value: opt.id
    })));
    chatState.currentStep = 'waiting_option';
}

// =========================
// Mensajes
// =========================
function addBotMessage(text, options = []) {
    const chatMessages = DOM.get('chatMessages');
    if (!chatMessages) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';

    let optionsHtml = '';
    if (options.length > 0) {
        optionsHtml = '<div class="options-container">';
        options.forEach(option => {
            optionsHtml += `
                <button class="option-button" onclick="handleOptionSelect('${option.value}')">
                    ${option.text}
                </button>
            `;
        });
        optionsHtml += '</div>';
    }

    messageDiv.innerHTML = `
        <div class="message-content">
            <p>${text}</p>
            ${optionsHtml}
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function addUserMessage(text) {
    const chatMessages = DOM.get('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.innerHTML = `<div class="message-content"><p>${escapeHtml(text)}</p></div>`;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

// =========================
// Procesamiento de opciones
// =========================
function handleOptionSelect(option) {
    addUserMessage(mainOptions.find(o => o.id == option)?.text || 'Opción seleccionada');
    switch(option) {
        case '1':
        case 'search':
            chatState.currentStep = 'waiting_alarm_number';
            addBotMessage('Por favor ingrese el número de alarma que desea consultar:');
            enableInput();
            break;
        case '2':
        case 'docs':
            addBotMessage('📚 Documentación disponible en /static/instructivos/');
            showReturnToMenu();
            break;
        case '3':
            addBotMessage('⚠️ Incidentes activos - próximamente.');
            showReturnToMenu();
            break;
        case '4':
            addBotMessage('✅ Estado operativo - próximamente.');
            showReturnToMenu();
            break;
        case '5':
            addBotMessage('🔄 Cambios activos - próximamente.');
            showReturnToMenu();
            break;
        case '6':
            addBotMessage('👤 Contactando al administrador - próximamente.');
            showReturnToMenu();
            break;
        case 'menu':
            resetChatState();
            showWelcomeMessage();
            break;
        default:
            addBotMessage('No entendí esa opción. Intenta de nuevo.');
    }
}

// =========================
// Entrada del usuario
// =========================
function handleSendMessage() {
    const input = DOM.get('messageInput');
    if (!input) return;
    const message = input.value.trim();
    if (!message) return;

    addUserMessage(message);
    input.value = '';
    processUserInput(message);
}

function processUserInput(message) {
    switch (chatState.currentStep) {
        case 'waiting_alarm_number':
            chatState.alarmData.numero = message;
            chatState.currentStep = 'waiting_alarm_element';
            addBotMessage('Por favor ingresa el nombre del elemento que reporta la alarma:');
            break;
        case 'waiting_alarm_element':
            chatState.alarmData.elemento = message;
            searchAlarm();
            break;
        default:
            addBotMessage('Por favor selecciona una opción del menú.');
    }
}

// =========================
// Buscar alarma en backend
// =========================
async function searchAlarm() {
    disableInput();
    showTypingIndicator();

    try {
        const response = await fetch('/buscar_alarma', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chatState.alarmData)
        });
        const data = await response.json();

        hideTypingIndicator();

        if (response.ok && data.success) {
            displayAlarmData(data.alarma);
        } else {
            addBotMessage(`❌ ${data.message || 'No se encontró la alarma especificada.'}`);
            showReturnToMenu();
        }
    } catch (error) {
        console.error('Error al buscar alarma:', error);
        hideTypingIndicator();
        addBotMessage('❌ Error de conexión con el servidor.');
        showReturnToMenu();
    }
}

// Mostrar datos de la alarma y botones de PDF/Word
function displayAlarmData(alarma) {
    const details = `
        <div class="alarm-details">
            <h4>📊 Detalles de la Alarma</h4>
            <p><strong>Número:</strong> ${alarma.numero || 'N/A'}</p>
            <p><strong>Elemento:</strong> ${alarma.elemento || 'N/A'}</p>
            <p><strong>Descripción:</strong> ${alarma.descripcion || 'N/A'}</p>
            <p><strong>Severidad:</strong> ${alarma.severidad || 'N/A'}</p>
            <p><strong>Estado:</strong> ${alarma.estado || 'N/A'}</p>
        </div>
        <div class="action-buttons">
            <button class="action-button" onclick="openFile('pdf', '${alarma.numero}')">📄 Abrir PDF</button>
            <button class="action-button" onclick="openFile('word', '${alarma.numero}')">📝 Abrir Word</button>
        </div>
    `;
    addBotMessage('✅ Alarma encontrada:' + details);
    setTimeout(showReturnToMenu, 3000);
}

// =========================
// Modal para archivos
// =========================
function openFile(type, alarmNumber) {
    const ext = type === 'pdf' ? 'pdf' : 'docx';
    const fileName = `alarma_${alarmNumber}.${ext}`;
    const filePath = `/static/instructivos/${fileName}`;

    const modal = DOM.get('fileModal');
    DOM.get('modalTitle').textContent = `Abrir ${ext.toUpperCase()}`;
    DOM.get('modalDescription').textContent = `Archivo: ${fileName}`;
    DOM.get('modalDownload').href = filePath;
    DOM.get('modalView').href = filePath;
    if (modal) modal.classList.add('show');
}

function closeModal() {
    const modal = DOM.get('fileModal');
    if (modal) modal.classList.remove('show');
}

// =========================
// Utilidades
// =========================
function showTypingIndicator() {
    const el = DOM.get('typingIndicator');
    if (el) el.style.display = 'flex';
    scrollToBottom();
}

function hideTypingIndicator() {
    const el = DOM.get('typingIndicator');
    if (el) el.style.display = 'none';
}

function scrollToBottom() {
    const el = DOM.get('chatMessages');
    if (el) el.scrollTop = el.scrollHeight;
}

function enableInput() {
    const input = DOM.get('messageInput');
    const btn = DOM.get('sendButton');
    if (input) input.disabled = false;
    if (btn) btn.disabled = false;
    input?.focus();
}

function disableInput() {
    const input = DOM.get('messageInput');
    const btn = DOM.get('sendButton');
    if (input) input.disabled = true;
    if (btn) btn.disabled = true;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function resetChatState() {
    chatState = { currentStep: 'welcome', selectedOption: null, isTyping: false, alarmData: { numero: null, elemento: null } };
    disableInput();
}

function showReturnToMenu() {
    addBotMessage('¿Deseas volver al menú principal?', [{ text: '🏠 Menú principal', value: 'menu' }]);
}

// Cerrar modal con click afuera
window.addEventListener('click', function(event) {
    if (event.target === DOM.get('fileModal')) closeModal();
});

// Exportar API
window.chatbot = { addBotMessage, addUserMessage, showWelcomeMessage };
