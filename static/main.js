document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM
    const chatContainer = document.getElementById('chat-container');
    const burbujaChat = document.getElementById('burbuja-chat');
    const closeBtn = document.getElementById('close-chat');
    const chatBox = document.getElementById('chat-box');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const typingIndicator = document.getElementById('typing-indicator');
    const suggestionsContainer = document.querySelector('.suggestions-container');

    // Estado del chat
    let chatState = {
        waitingForResponse: false,
        currentFlow: null,
        alarmData: null
    };

    // Mostrar/ocultar chat
    burbujaChat.addEventListener('click', () => {
        chatContainer.classList.add('mostrar');
        burbujaChat.classList.remove('nuevo-mensaje');
    });

    closeBtn.addEventListener('click', () => {
        chatContainer.classList.remove('mostrar');
    });

    // Enviar mensaje
    function sendMessage() {
        const message = messageInput.value.trim();
        if (message && !chatState.waitingForResponse) {
            addMessage(message, 'user');
            messageInput.value = '';
            processUserMessage(message);
        }
    }

    // Añadir mensaje al chat
    function addMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `${sender}-msg`;
        
        if (typeof text === 'string') {
            msgDiv.innerHTML = text;
        } else {
            msgDiv.appendChild(text);
        }
        
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Procesar mensaje del usuario
    function processUserMessage(message) {
        const lowerMsg = message.toLowerCase();
        
        if (lowerMsg.includes('alarma') || lowerMsg.includes('alarmas')) {
            startAlarmFlow();
        } else if (lowerMsg.includes('documentación') || lowerMsg.includes('documento')) {
            showDocumentation();
        } else {
            showDefaultResponse();
        }
    }

    // Flujo para consultar alarmas
    function startAlarmFlow() {
        chatState.currentFlow = 'alarmas';
        showTyping();
        
        setTimeout(() => {
            hideTyping();
            addMessage('Por favor ingresa el número de alarma que deseas consultar:', 'bot');
        }, 1000);
    }

    // Mostrar documentación
    function showDocumentation() {
        showTyping();
        
        setTimeout(() => {
            hideTyping();
            const docMessage = document.createElement('div');
            docMessage.innerHTML = `
                <strong>Documentación disponible:</strong>
                <div class="suggestions-container">
                    <a href="#" class="suggestion-btn">Manual técnico</a>
                    <a href="#" class="suggestion-btn">Guías de configuración</a>
                    <a href="#" class="suggestion-btn">Procedimientos</a>
                </div>
            `;
            addMessage(docMessage, 'bot');
        }, 1500);
    }

    // Respuesta por defecto
    function showDefaultResponse() {
        showTyping();
        
        setTimeout(() => {
            hideTyping();
            const response = `
                No entendí tu solicitud. Puedes preguntar sobre:<br>
                <div class="suggestions-container">
                    <button class="suggestion-btn">Alarmas</button>
                    <button class="suggestion-btn">Documentación</button>
                    <button class="suggestion-btn">Incidentes</button>
                </div>
            `;
            addMessage(response, 'bot');
        }, 1000);
    }

    // Mostrar indicador de "escribiendo"
    function showTyping() {
        chatState.waitingForResponse = true;
        typingIndicator.style.display = 'flex';
    }

    // Ocultar indicador
    function hideTyping() {
        chatState.waitingForResponse = false;
        typingIndicator.style.display = 'none';
    }

    // Event listeners
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Sugerencias rápidas
    suggestionsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-btn')) {
            messageInput.value = e.target.textContent;
            sendMessage();
        }
    });

    // Simular notificación después de 10 segundos
    setTimeout(() => {
        if (!chatContainer.classList.contains('mostrar')) {
            burbujaChat.classList.add('nuevo-mensaje');
        }
    }, 10000);
});