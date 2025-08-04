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
        const ids = ['chatMessages', 'messageInput', 'sendButton', 'typingIndicator'];
        ids.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
        this.setupEventListeners();
        return this;
    },
    get(id) {
        return this.elements[id] || null;
    },
    setupEventListeners() {
        const input = this.get('messageInput');
        const button = this.get('sendButton');
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
};

// Inicialización segura
document.addEventListener('DOMContentLoaded', () => {
    DOM.init();
    if (DOM.get('chatMessages')) {
        showWelcomeMessage();
    }
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
    const chatMessages = DOM.get('chatMessages');
    if (!chatMessages) return;
    const messageDiv = createMessageElement({
        type: 'bot',
        text: formatMessage(text),
        options: options.options || []
    });
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function addUserMessage(text) {
    const chatMessages = DOM.get('chatMessages');
    if (!chatMessages) return;
    const messageDiv = createMessageElement({
        type: 'user',
        text: formatMessage(text)
    });
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function createMessageElement({ type, text, options = [] }) {
    const div = document.createElement('div');
    div.className = `message ${type}`;
    const content = document.createElement('div');
    content.className = 'message-content';
    content.innerHTML = text;
    div.appendChild(content);
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

function handleSendMessage() {
    const input = DOM.get('messageInput');
    if (!input) return;
    const message = input.value.trim();
    if (!message) return;
    addUserMessage(message);
    input.value = '';
    showTypingIndicator();
    setTimeout(() => {
        hideTypingIndicator();
        processUserInput(message);
    }, 800);
}

function processUserInput(message) {
    if (chatState.currentStep === 'searchingAlarm') {
        fetch('/buscar_alarma', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
            console.error('Error en fetch /buscar_alarma:', error);
            addBotMessage('Hubo un error procesando tu búsqueda. Por favor intenta nuevamente.');
        });
    } else {
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