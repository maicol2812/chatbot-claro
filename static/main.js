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
            }, 1000);  // Reducido para mejor UX
        } else if (flujo.paso === 1) {
            handleMainOption(message);
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

    function handleMainOption(message) {
        switch (message) {
            case '1':
                addMessage('Por favor ingresa el número de alarma que deseas consultar:', 'bot');
                flujo.paso = 2;
                break;
            case '2':
                showDocumentation();
                break;
            case '3':
                showIncidentes();
                break;
            case '4':
                showEstadoOperativo();
                break;
            case '5':
                showCambiosActivos();
                break;
            case '6':
                showContactoAdmin();
                break;
            default:
                addMessage('Por favor selecciona una opción válida del 1 al 6.', 'bot');
        }
    }

    function buscarAlarma(id, elemento) {
        showTyping();
        
        // Implementación con timeout para evitar bloqueos
        const fetchTimeout = (url, options, timeout = 8000) => {
            return Promise.race([
                fetch(url, options),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Tiempo de espera agotado')), timeout)
                )
            ]);
        };

        // Simular datos de alarma para pruebas
        const datosSimulados = {
            Severidad: "CRÍTICA",
            Elemento: elemento,
            Fecha: new Date().toLocaleString(),
            Descripción: `Alarma #${id} - Falla crítica en ${elemento}`,
            Significado: "Se ha detectado una interrupción en el servicio que requiere atención inmediata",
            Acciones: "1. Verificar conectividad • 2. Reiniciar servicios • 3. Contactar soporte técnico • 4. Escalar si persiste"
        };

        setTimeout(() => {
            hideTyping();
            
            // Guardar datos simulados para detalle_alarma.html
            localStorage.setItem('alarmaDetalle', JSON.stringify(datosSimulados));
            
            addMessage(`✅ Alarma encontrada: ${datosSimulados.Severidad} en ${datosSimulados.Elemento}`, 'bot');
            addMessage('Redirigiendo a detalle completo...', 'bot');
            
            // Redirigir manteniendo parámetro para volver al chat
            setTimeout(() => {
                window.location.href = `detalle_alarma.html?volver=chat`;
            }, 1500);
            
        }, 2000);

        // Código original comentado para futuro uso con API real
        /*
        fetchTimeout(`/api/alarmas?filtro=${encodeURIComponent(id)}`, {})
            .then(res => {
                if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
                return res.json();
            })
            .then(data => {
                const encontrada = data.find(a => a.Elemento?.toLowerCase() === elemento.toLowerCase());
                if (encontrada) {
                    localStorage.setItem('alarmaDetalle', JSON.stringify(encontrada));
                    window.location.href = `detalle_alarma.html?volver=chat`;
                } else {
                    addMessage('⚠️ No se encontró la alarma. Verifica:', 'bot');
                    addMessage(`- ID: ${id}<br>- Elemento: ${elemento}`, 'bot');
                    addMessage('¿Deseas intentar con otro dato?', 'bot');
                }
            })
            .catch(err => {
                console.error('Error al buscar alarma:', err);
                addMessage('🔴 Error al conectar con el servidor. Intenta nuevamente en unos minutos.', 'bot');
            })
            .finally(() => hideTyping());
        */
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
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function hideTyping() {
        chatState.waitingForResponse = false;
        typingIndicator.style.display = 'none';
    }

    function showDocumentation() {
        showTyping();
        setTimeout(() => {
            hideTyping();
            addMessage(`
                <strong>📚 Documentación disponible:</strong>
                <div class="suggestions-container">
                    <button class="suggestion-btn">Manual técnico</button>
                    <button class="suggestion-btn">Guías de configuración</button>
                    <button class="suggestion-btn">Procedimientos</button>
                </div>
            `, 'bot');
            flujo.paso = 0;
        }, 1000);
    }

    function showIncidentes() {
        showTyping();
        setTimeout(() => {
            hideTyping();
            addMessage('🚨 Incidentes activos:<br>- Caída parcial en Nodo Central<br>- Latencia elevada en enlace internacional', 'bot');
            flujo.paso = 0;
        }, 1000);
    }

    function showEstadoOperativo() {
        showTyping();
        setTimeout(() => {
            hideTyping();
            addMessage('✅ Estado operativo:<br>- Core Voz: Estable<br>- Core Datos: Mantenimiento<br>- Plataforma 5G: Degradado', 'bot');
            flujo.paso = 0;
        }, 1000);
    }

    function showCambiosActivos() {
        showTyping();
        setTimeout(() => {
            hideTyping();
            addMessage('🛠 Cambios programados:<br>- Actualización firmware (00:00-02:00)<br>- Migración base de datos (Sábado 22:00)', 'bot');
            flujo.paso = 0;
        }, 1000);
    }

    function showContactoAdmin() {
        showTyping();
        setTimeout(() => {
            hideTyping();
            addMessage('👨‍💻 Contacta al administrador:<br>- Teams: equipo_operaciones@empresa.com<br>- Teléfono: +34 912 345 678', 'bot');
            flujo.paso = 0;
        }, 1000);
    }

    // Event Listeners
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    function sendMessage() {
        const message = messageInput.value.trim();
        if (message.length === 0 || chatState.waitingForResponse) return;
        
        addMessage(message, 'user');
        messageInput.value = '';
        
        // Manejar mensajes de usuario
        if (chatState.currentFlow === 'alarmas') {
            handleAlarmFlow(message);
        } else {
            flujoExperto(message);
        }
    }

    burbujaChat.addEventListener('click', () => {
        chatContainer.classList.add('mostrar');
        burbujaChat.classList.remove('nuevo-mensaje');
        if (flujo.paso === 0) {
            setTimeout(() => flujoExperto(''), 500);
        }
    });

    closeBtn.addEventListener('click', () => {
        chatContainer.classList.remove('mostrar');
    });

    // Manejar sugerencias
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-btn')) {
            messageInput.value = e.target.textContent;
            sendMessage();
        }
    });

    // Mantener chat abierto al volver de detalle_alarma.html
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('volver') && urlParams.get('volver') === 'chat') {
        chatContainer.classList.add('mostrar');
        setTimeout(() => {
            addMessage('👋 ¡Bienvenido de nuevo! ¿En qué más puedo ayudarte?', 'bot');
        }, 300);
    }

    // Notificación después de 10 segundos
    setTimeout(() => {
        if (!chatContainer.classList.contains('mostrar')) {
            burbujaChat.classList.add('nuevo-mensaje');
        }
    }, 10000);
});