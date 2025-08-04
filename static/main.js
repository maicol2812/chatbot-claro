// Estado global del chat
const chatState = {
    isTyping: false,
    currentStep: 'welcome',
    messageQueue: []
};

// Manejador seguro de elementos DOM
const DOM = {
    elements: {},
    
    init() {
        // Obtener elementos de forma segura
        const ids = ['chatMessages', 'messageInput', 'sendButton', 'typingIndicator'];
        ids.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
        
        this.setupEventListeners();
        return this;
    },
    
    get(id) {
        return this.elements[id] || null;
    }
};

// Event Listeners
function setupEventListeners() {
    const input = DOM.get('messageInput');
    const button = DOM.get('sendButton');
    
    if (button) {
        button.addEventListener('click', handleSendMessage);
    }
    
    if (input) {
        input.addEventListener('keypress', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    DOM.init();
    showWelcomeMessage();
});

// Funciones del chat
function showWelcomeMessage() {
    addBotMessage(`👋 **¡Buen día! Hablemos de nuestras plataformas Core.**

¿Qué te gustaría consultar hoy?`, {
        options: [
            { text: '🔍 Alarmas de plataformas', value: '1' },
            { text: '📚 Documentación', value: '2' },
            { text: '🚨 Incidentes activos', value: '3' },
            { text: '📊 Estado operativo', value: '4' },
            { text: '🔄 Cambios activos', value: '5' },
            { text: '👥 Hablar con administrador', value: '6' }
        ]
    });
}

function addBotMessage(text, options = {}) {
    const messageDiv = createMessageElement({
        type: 'bot',
        text: formatMessage(text),
        options: options.options || []
    });

    DOM.get('chatMessages').appendChild(messageDiv);
    scrollToBottom();
}

function addUserMessage(text) {
    const messageDiv = createMessageElement({
        type: 'user',
        text: formatMessage(text)
    });

    DOM.get('chatMessages').appendChild(messageDiv);
    scrollToBottom();
}

function createMessageElement({ type, text, options = [] }) {
    const div = document.createElement('div');
    div.className = `message ${type}`;

    const content = document.createElement('div');
    content.className = 'message-content';
    content.innerHTML = text;

    div.appendChild(content);

    // Agregar opciones si existen
    if (options.length > 0) {
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'message-options';

        options.forEach(opt => {
            const button = document.createElement('button');
            button.className = 'option-button';
            button.textContent = opt.text;
            button.addEventListener('click', () => handleOptionSelect(opt.value));
            optionsDiv.appendChild(button);
        });

        content.appendChild(optionsDiv);
    }

    return div;
}

// Modificar handleSendMessage para ser más robusto
function handleSendMessage() {
    const input = DOM.get('messageInput');
    if (!input) return;
    
    const message = input.value.trim();
    if (!message) return;
    
    // Enviar mensaje
    addUserMessage(message);
    input.value = '';
    
    // Procesar respuesta
    showTypingIndicator();
    setTimeout(() => {
        hideTypingIndicator();
        processUserInput(message);
    }, 800);
}

// Añadir función para procesar input
function processUserInput(message) {
    if (chatState.currentStep === 'searchingAlarm') {
        // Búsqueda de alarma
        fetch('/buscar_alarma', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: message })
        })
        .then(response => response.json())
        .then(data => {
            if (data.encontrada) {
                showAlarmDetails(data.datos);
            } else {
                addBotMessage('No encontré esa alarma. ¿Deseas buscar otra?', {
                    options: [
                        { text: '🔍 Nueva búsqueda', value: 'search' },
                        { text: '🏠 Menú principal', value: 'menu' }
                    ]
                });
            }
        })
        .catch(error => {
            console.error('Error:', error);
            addBotMessage('Hubo un error procesando tu búsqueda. Por favor intenta nuevamente.');
        });
    } else {
        // Respuesta genérica
        addBotMessage('¿En qué más puedo ayudarte?', {
            options: [
                { text: '🔍 Buscar alarma', value: 'search' },
                { text: '📚 Ver documentación', value: 'docs' },
                { text: '🏠 Volver al menú', value: 'menu' }
            ]
        });
    }
}

// Funciones auxiliares
function formatMessage(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
}

function scrollToBottom() {
    const chatMessages = DOM.get('chatMessages');
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

function showTypingIndicator() {
    const typingIndicator = DOM.get('typingIndicator');
    if (typingIndicator) {
        typingIndicator.style.display = 'flex';
        scrollToBottom();
    }
}

function hideTypingIndicator() {
    const typingIndicator = DOM.get('typingIndicator');
    if (typingIndicator) {
        typingIndicator.style.display = 'none';
    }
}

// Exportar funciones para uso global
window.chatbot = {
    addBotMessage,
    addUserMessage,
    showWelcomeMessage
};