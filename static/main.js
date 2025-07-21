document.addEventListener('DOMContentLoaded', function () {
    const chatContainer = document.getElementById('chat-container');
    const burbujaChat = document.getElementById('burbuja-chat');
    const closeBtn = document.getElementById('close-chat');
    const chatBox = document.getElementById('chat-box');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const typingIndicator = document.getElementById('typing-indicator');
    const suggestionsContainer = document.querySelector('.suggestions-container');

    let chatState = {
        waitingForResponse: false,
        currentFlow: null,
        alarmData: null
    };

    let flujo = { paso: 0, alarmaId: '', elemento: '' };

    function flujoExperto(message) {
        if (flujo.paso === 0) {
            addMessage(`Buen día, hablemos de nuestras plataformas de Core.`, 'bot');
            setTimeout(() => {
                addMessage(`¿Qué te gustaría consultar el día de hoy:<br><br>
                  1. Alarmas de plataformas.<br>
                  2. Documentación de las plataformas.<br>
                  3. Incidentes activos de las plataformas.<br>
                  4. Estado operativo de las plataformas.<br>
                  5. Cambios activos en las plataformas.<br>
                  6. Hablar con el administrador de la plataforma.`, 'bot');
                flujo.paso = 1;
            }, 3000);
        } else if (flujo.paso === 1) {
            switch (message) {
                case '1':
                    addMessage('Por favor ingresa el número de alarma que deseas consultar:', 'bot');
                    flujo.paso = 2;
                    break;
                case '2':
                    showDocumentation();
                    flujo.paso = 0;
                    break;
                case '3':
                    addMessage('Mostrando incidentes activos en las plataformas...', 'bot');
                    flujo.paso = 0;
                    break;
                case '4':
                    addMessage('Estado actual de las plataformas:<br>- Plataforma X: Operativa<br>- Plataforma Y: Mantenimiento<br>- Plataforma Z: Inestable', 'bot');
                    flujo.paso = 0;
                    break;
                case '5':
                    addMessage('Cambios activos actualmente:<br>- Migración base de datos 22:00<br>- Actualización de firmware Nodo B', 'bot');
                    flujo.paso = 0;
                    break;
                case '6':
                    addMessage('Puedes contactar al administrador a través del canal Teams de operaciones o al interno 4410.', 'bot');
                    flujo.paso = 0;
                    break;
                default:
                    addMessage('Por favor selecciona una opción válida del 1 al 6.', 'bot');
            }
        } else if (flujo.paso === 2) {
            flujo.alarmaId = message;
            addMessage('Por favor ingresa el nombre del elemento que reporta la alarma:', 'bot');
            flujo.paso = 3;
        } else if (flujo.paso === 3) {
            flujo.elemento = message;
            buscarAlarma(flujo.alarmaId, flujo.elemento);
            flujo.paso = 0;
        }
    }

    function buscarAlarma(id, elemento) {
        fetch(`/api/alarmas?filtro=${id}`)
            .then(res => res.json())
            .then(data => {
                const encontrada = data.find(a => a.Elemento.toLowerCase() === elemento.toLowerCase());
                if (encontrada) {
                    localStorage.setItem('alarmaDetalle', JSON.stringify(encontrada));
                    window.location.href = '/detalle_alarma.html?volver=chat';
                } else {
                    addMessage('No se encontró ninguna alarma con esos datos. Intenta nuevamente.', 'bot');
                }
            })
            .catch(err => {
                console.error(err);
                addMessage('Error al consultar la alarma.', 'bot');
            });
    }

    function addMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `${sender}-msg`;
        msgDiv.innerHTML = text;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function showTyping() {
        chatState.waitingForResponse = true;
        typingIndicator.style.display = 'flex';
    }

    function hideTyping() {
        chatState.waitingForResponse = false;
        typingIndicator.style.display = 'none';
    }

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

    sendBtn.addEventListener('click', () => {
        const message = messageInput.value.trim();
        if (message.length === 0 || chatState.waitingForResponse) return;
        addMessage(message, 'user');
        messageInput.value = '';
        flujoExperto(message);
    });

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendBtn.click();
    });

    burbujaChat.addEventListener('click', () => {
        chatContainer.classList.add('mostrar');
        burbujaChat.classList.remove('nuevo-mensaje');
        setTimeout(() => flujoExperto(''), 600);
    });

    closeBtn.addEventListener('click', () => {
        chatContainer.classList.remove('mostrar');
    });

    if (suggestionsContainer) {
        suggestionsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('suggestion-btn')) {
                messageInput.value = e.target.textContent;
                sendBtn.click();
            }
        });
    }

    if (window.location.search.includes('volver=chat')) {
        chatContainer.classList.add('mostrar');
        setTimeout(() => flujoExperto(''), 500);
    }

    setTimeout(() => {
        if (!chatContainer.classList.contains('mostrar')) {
            burbujaChat.classList.add('nuevo-mensaje');
        }
    }, 10000);
});
