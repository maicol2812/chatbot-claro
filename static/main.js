document.addEventListener('DOMContentLoaded', function() {
    const API_BASE_URL = 'http://localhost:5000'; // Ajusta si tu backend corre en otro puerto
    const urlParams = new URLSearchParams(window.location.search);

    // --------------------------
    // Configuración inicial
    // --------------------------
    const elements = {
        chatContainer: document.getElementById('chat-container'),
        chatWindow: document.getElementById('chat-window'),
        burbujaChat: document.getElementById('burbuja-chat'),
        closeBtn: document.getElementById('close-chat'),
        chatBox: document.getElementById('chat-box'),
        messageInput: document.getElementById('message-input'),
        sendBtn: document.getElementById('send-btn'),
        typingIndicator: document.getElementById('typing-indicator'),
        suggestionsContainer: document.querySelector('.suggestions-container'),
        welcomeScreen: document.getElementById('welcome-screen'),
        bubbleNotification: document.getElementById('bubble-notification'),
        minimizeBtn: document.getElementById('minimize-chat'),
        maximizeBtn: document.getElementById('maximize-chat')
    };

    const chatState = {
        isOpen: false,
        isMinimized: false,
        isMaximized: false,
        waitingForResponse: false,
        messageCount: 0,
        unreadMessages: 0,
        catalogoLoaded: false
    };

    const flujo = { 
        paso: 0, 
        alarmaId: '', 
        elemento: '', 
        criterio: 'texto',
        ultimaBusqueda: null
    };

    const catalogoCache = {
        alarmas: [],
        estadisticas: null,
        ultimaActualizacion: null
    };

    // --------------------------
    // Funciones de inicialización
    // --------------------------
    function initialize() {
        setupEventListeners();
        handleWelcomeScreen();
        cargarCatalogoInicial();

        if (urlParams.has('volver') && urlParams.get('volver') === 'chat') {
            openChat();
            setTimeout(() => {
                addMessage('👋 ¡Bienvenido de nuevo! ¿En qué más puedo ayudarte con el catálogo de alarmas?', 'bot');
            }, 300);
        } else {
            setTimeout(showNotification, 8000);
        }
    }

    async function cargarCatalogoInicial() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/alarmas/estadisticas`);
            if (response.ok) {
                catalogoCache.estadisticas = await response.json();
                catalogoCache.ultimaActualizacion = new Date();
                chatState.catalogoLoaded = true;
                console.log('Catálogo cargado:', catalogoCache.estadisticas);
            } else {
                console.error('Error cargando estadísticas:', response.statusText);
                addMessage('⚠️ No se pudieron cargar las estadísticas iniciales. Intentando nuevamente...', 'bot');
                setTimeout(cargarCatalogoInicial, 3000);
            }
        } catch (error) {
            console.error('Error cargando catálogo inicial:', error);
            addMessage('❌ Error de conexión con el servidor. Por favor recarga la página.', 'bot');
        }
    }

    function setupEventListeners() {
        // Eventos básicos del chat
        if (elements.sendBtn) elements.sendBtn.addEventListener('click', sendMessage);
        if (elements.messageInput) {
            elements.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }

        // Eventos de UI
        if (elements.burbujaChat) elements.burbujaChat.addEventListener('click', toggleChat);
        if (elements.closeBtn) elements.closeBtn.addEventListener('click', closeChat);
        if (elements.minimizeBtn) elements.minimizeBtn.addEventListener('click', minimizeChat);
        if (elements.maximizeBtn) elements.maximizeBtn.addEventListener('click', maximizeChat);

        // Delegación de eventos
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('suggestion-btn')) handleSuggestionClick(e.target);
            if (e.target.classList.contains('action-btn')) handleActionClick(e.target);
            if (e.target.classList.contains('like-btn')) handleLikeClick(e.target);
            if (e.target.classList.contains('ver-detalle-btn')) handleVerDetalleClick(e.target);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && chatState.isOpen) closeChat();
        });
    }

    function handleWelcomeScreen() {
        if (!elements.welcomeScreen) return;
        
        setTimeout(() => {
            elements.welcomeScreen.style.opacity = '0';
            elements.welcomeScreen.style.transform = 'scale(0.95)';
            setTimeout(() => {
                if (elements.welcomeScreen.parentNode) {
                    elements.welcomeScreen.remove();
                }
                if (!chatState.isOpen) showNotification();
            }, 1200);
        }, 3000);
    }

    // --------------------------
    // Funciones de UI del chat
    // --------------------------
    function toggleChat() {
        chatState.isOpen ? (chatState.isMinimized ? restoreChat() : closeChat()) : openChat();
    }

    function openChat() {
        chatState.isOpen = true;
        chatState.isMinimized = false;
        chatState.unreadMessages = 0;
        updateNotification();
        
        elements.chatWindow.style.display = 'flex';
        elements.chatContainer.style.display = 'flex';
        elements.chatContainer.classList.add('mostrar');
        elements.burbujaChat.style.display = 'none';

        setTimeout(() => {
            if (elements.messageInput) elements.messageInput.focus();
            if (flujo.paso === 0 && chatState.messageCount === 0) {
                setTimeout(() => flujoExpertoCatalogo(''), 500);
            }
        }, 300);

        scrollToBottom();
    }

    function closeChat() {
        chatState.isOpen = false;
        elements.chatWindow.style.display = 'none';
        elements.chatContainer.style.display = 'none';
        elements.chatContainer.classList.remove('mostrar');
        elements.burbujaChat.style.display = 'flex';
    }

    function minimizeChat() {
        chatState.isMinimized = true;
        elements.chatWindow.style.height = '60px';
        elements.chatWindow.style.overflow = 'hidden';
    }

    function restoreChat() {
        chatState.isMinimized = false;
        elements.chatWindow.style.height = '600px';
        elements.chatWindow.style.overflow = 'visible';
    }

    function maximizeChat() {
        chatState.isMaximized = !chatState.isMaximized;
        if (chatState.isMaximized) {
            elements.chatWindow.style.width = '90vw';
            elements.chatWindow.style.height = '80vh';
        } else {
            elements.chatWindow.style.width = '400px';
            elements.chatWindow.style.height = '600px';
        }
    }

    function showNotification() {
        if (!chatState.isOpen && elements.burbujaChat) {
            elements.burbujaChat.classList.add('nuevo-mensaje');
            chatState.unreadMessages++;
            updateNotification();
        }
    }

    function updateNotification() {
        if (!elements.bubbleNotification) return;
        
        if (chatState.unreadMessages > 0) {
            elements.bubbleNotification.textContent = 
                chatState.unreadMessages > 9 ? '9+' : chatState.unreadMessages;
            elements.bubbleNotification.style.display = 'flex';
        } else {
            elements.bubbleNotification.style.display = 'none';
        }
    }

    // --------------------------
    // Funciones del flujo de conversación
    // --------------------------
    function flujoExpertoCatalogo(message) {
        switch (flujo.paso) {
            case 0: 
                mostrarMensajeBienvenida();
                flujo.paso = 1;
                break;
            case 1: 
                handleMainOptionCatalogo(message);
                break;
            case 2: 
                flujo.alarmaId = message;
                buscarAlarmaPorId(message);
                flujo.paso = 0;
                break;
            case 3: 
                buscarAlarmaPorElemento(message);
                flujo.paso = 0;
                break;
            case 4: 
                buscarAlarmaPorSeveridad(message);
                flujo.paso = 0;
                break;
            default:
                if (message.length > 2) buscarTextoLibre(message);
                else addMessage('Por favor selecciona una opción válida o escribe algo para buscar.', 'bot');
        }
    }

    function mostrarMensajeBienvenida() {
        const stats = catalogoCache.estadisticas;
        
        addMessage(`🚀 ¡Buen día! Soy tu asistente especializado en el **Catálogo de Alarmas Consolidado**.`, 'bot');
        
        setTimeout(() => {
            if (stats) {
                const msg = [
                    `📊 **Estado actual del catálogo:**`,
                    `• Total de alarmas: **${stats.total}**`,
                    `• Críticas: **${stats.por_severidad?.CRITICA || 0}**`,
                    `• Altas: **${stats.por_severidad?.ALTA || 0}**`,
                    `• Medias: **${stats.por_severidad?.MEDIA || 0}**`
                ].join('\n');
                
                addMessage(msg, 'bot');
            }
            
            setTimeout(() => {
                addMessage(`¿Qué te gustaría consultar hoy?\n\n` +
                    `**1.** 🔍 Buscar alarma específica\n` +
                    `**2.** 📋 Ver catálogo completo\n` + 
                    `**3.** 🚨 Mostrar alarmas críticas\n` +
                    `**4.** 📊 Estadísticas del catálogo\n` +
                    `**5.** 📚 Documentación técnica\n` +
                    `**6.** 🔧 Estado operativo\n` +
                    `**7.** 👨‍💻 Contactar administrador`, 'bot');
            }, 1000);
        }, 800);
    }

    function handleMainOptionCatalogo(opcion) {
        opcion = opcion.trim();
        
        switch (opcion) {
            case '1': mostrarOpcionesBusqueda(); break;
            case '2': mostrarCatalogoCompleto(); break;
            case '3': buscarAlarmasCriticas(); break;
            case '4': mostrarEstadisticas(); break;
            case '5': showDocumentation(); break;
            case '6': showEstadoOperativo(); break;
            case '7': showContactoAdmin(); break;
            default: 
                if (opcion.length > 2) buscarTextoLibre(opcion);
                else addMessage('Por favor selecciona una opción del **1 al 7** o escribe algo para buscar.', 'bot');
        }
    }

    function mostrarOpcionesBusqueda() {
        addMessage(`🔍 **Opciones de búsqueda disponibles:**\n\n` +
            `**A.** Buscar por ID de alarma\n` +
            `**B.** Buscar por elemento/equipo\n` + 
            `**C.** Buscar por severidad\n` +
            `**D.** Búsqueda libre en descripción\n\n` +
            `¿Cómo prefieres buscar?`, 'bot');
        
        flujo.paso = 1.1;
    }

    // --------------------------
    // Funciones de búsqueda
    // --------------------------
    async function buscarAlarmaPorId(id) {
        showTyping();
        try {
            const response = await fetch(`${API_BASE_URL}/api/alarmas/${id}`);
            if (response.ok) {
                const alarma = await response.json();
                hideTyping();
                mostrarDetalleAlarma(alarma);
            } else {
                hideTyping();
                addMessage(`❌ No se encontró ninguna alarma con ID: **${id}**`, 'bot');
                setTimeout(() => {
                    addMessage('¿Te gustaría intentar con otro criterio de búsqueda?', 'bot');
                }, 500);
            }
        } catch (error) {
            hideTyping();
            addMessage('❌ Error buscando la alarma. Por favor intenta nuevamente.', 'bot');
            console.error('Error:', error);
        }
    }

    async function buscarAlarmaPorElemento(elemento) {
        showTyping();
        try {
            const response = await fetch(`${API_BASE_URL}/api/alarmas?criterio=elemento&filtro=${encodeURIComponent(elemento)}`);
            handleSearchResponse(response, `Alarmas encontradas para elemento: **${elemento}**`);
        } catch (error) {
            handleSearchError(error);
        }
    }

    async function buscarAlarmaPorSeveridad(severidad) {
        showTyping();
        try {
            const response = await fetch(`${API_BASE_URL}/api/alarmas?criterio=severidad&filtro=${encodeURIComponent(severidad)}`);
            handleSearchResponse(response, `Alarmas de severidad: **${severidad.toUpperCase()}**`);
        } catch (error) {
            handleSearchError(error);
        }
    }

    async function buscarTextoLibre(texto) {
        showTyping();
        try {
            const response = await fetch(`${API_BASE_URL}/api/alarmas?criterio=texto&filtro=${encodeURIComponent(texto)}`);
            handleSearchResponse(response, `Resultados para: **"${texto}"**`);
        } catch (error) {
            handleSearchError(error);
        }
    }

    async function handleSearchResponse(response, successMessage) {
        if (response.ok) {
            const data = await response.json();
            hideTyping();
            
            if (data.alarmas && data.alarmas.length > 0) {
                mostrarListaAlarmas(data.alarmas, successMessage);
            } else {
                addMessage(`❌ No se encontraron resultados.`, 'bot');
            }
        } else {
            hideTyping();
            addMessage('❌ Error en la búsqueda. Por favor intenta nuevamente.', 'bot');
        }
    }

    function handleSearchError(error) {
        hideTyping();
        addMessage('❌ Error de conexión. Por favor verifica tu conexión a internet.', 'bot');
        console.error('Error:', error);
    }

    async function mostrarCatalogoCompleto() {
        showTyping();
        try {
            const response = await fetch(`${API_BASE_URL}/api/alarmas`);
            if (response.ok) {
                const data = await response.json();
                hideTyping();
                mostrarListaAlarmas(data.alarmas, `📋 **Catálogo Completo** (${data.total} alarmas)`);
            } else {
                hideTyping();
                addMessage('❌ Error cargando el catálogo completo.', 'bot');
            }
        } catch (error) {
            hideTyping();
            addMessage('❌ Error de conexión al servidor.', 'bot');
            console.error('Error:', error);
        }
    }

    async function buscarAlarmasCriticas() {
        await buscarAlarmaPorSeveridad('CRITICA');
    }

    async function mostrarEstadisticas() {
        showTyping();
        try {
            const response = await fetch(`${API_BASE_URL}/api/alarmas/estadisticas`);
            if (response.ok) {
                const stats = await response.json();
                hideTyping();
                
                let mensaje = `📊 **Estadísticas del Catálogo**\n\n`;
                mensaje += `**Total de alarmas:** ${stats.total}\n\n`;
                
                if (stats.por_severidad) {
                    mensaje += `**Por Severidad:**\n`;
                    for (const [sev, count] of Object.entries(stats.por_severidad)) {
                        mensaje += `${getSeveridadEmoji(sev)} ${sev}: **${count}**\n`;
                    }
                }
                
                if (stats.por_dominio) {
                    mensaje += `\n**Por Dominio:**\n`;
                    for (const [dom, count] of Object.entries(stats.por_dominio)) {
                        mensaje += `🔧 ${dom}: **${count}**\n`;
                    }
                }
                
                mensaje += `\n📅 Actualizado: ${stats.fecha_actualizacion}`;
                
                addMessage(mensaje, 'bot');
            } else {
                hideTyping();
                addMessage('❌ Error cargando estadísticas.', 'bot');
            }
        } catch (error) {
            hideTyping();
            addMessage('❌ Error de conexión al servidor.', 'bot');
            console.error('Error:', error);
        }
    }

    // --------------------------
    // Funciones de visualización
    // --------------------------
    function mostrarDetalleAlarma(alarma) {
        const emoji = getSeveridadEmoji(alarma.Severidad);
        
        let mensaje = `${emoji} **Detalle de Alarma**\n\n` +
            `**ID:** ${alarma.ID}\n` +
            `**Elemento:** ${alarma.Elemento}\n` +
            `**Severidad:** ${alarma.Severidad}\n` +
            `**Dominio:** ${alarma.Dominio || 'N/A'}\n\n` +
            `**Descripción:**\n${alarma.Descripcion_Completa || alarma.Descripcion}\n\n` +
            `**Significado:**\n${alarma.Significado}\n\n` +
            `**Acciones recomendadas:**\n${alarma.Acciones}`;
        
        addMessage(mensaje, 'bot');
        
        setTimeout(() => {
            addMessage(`¿Qué te gustaría hacer ahora?`, 'bot', {
                opciones: [
                    'Buscar otra alarma',
                    'Ver alarmas similares', 
                    'Volver al menú principal'
                ]
            });
        }, 1000);
    }

    function mostrarListaAlarmas(alarmas, titulo) {
        addMessage(titulo, 'bot');
        
        if (!alarmas || alarmas.length === 0) {
            addMessage('No se encontraron alarmas.', 'bot');
            return;
        }
        
        // Mostrar las primeras 5 alarmas
        const mostrar = alarmas.slice(0, 5);
        
        mostrar.forEach((alarma, index) => {
            setTimeout(() => {
                const emoji = getSeveridadEmoji(alarma.Severidad);
                let mensaje = `${emoji} **${alarma.ID}** - ${alarma.Elemento}\n` +
                    `**Severidad:** ${alarma.Severidad}\n` +
                    `**Descripción:** ${alarma.Descripcion_Completa || alarma.Descripcion}`;
                
                addMessage(mensaje, 'bot', {
                    acciones: [
                        { texto: 'Ver detalle', accion: 'ver-detalle', data: alarma.ID },
                        { texto: '👍', accion: 'like', data: alarma.ID }
                    ]
                });
            }, index * 300);
        });
        
        // Si hay más alarmas, mostrar resumen
        if (alarmas.length > 5) {
            setTimeout(() => {
                addMessage(`... y **${alarmas.length - 5}** alarmas más.`, 'bot', {
                    opciones: [
                        'Ver todas las alarmas',
                        'Refinar búsqueda'
                    ]
                });
            }, mostrar.length * 300 + 500);
        }
    }

    // --------------------------
    // Funciones auxiliares
    // --------------------------
    function getSeveridadEmoji(severidad) {
        const emojis = {
            'CRITICA': '🚨',
            'ALTA': '⚠️',
            'MEDIA': '📋',
            'BAJA': 'ℹ️',
            'INFORMATIVA': '💡'
        };
        return emojis[severidad?.toUpperCase()] || '❓';
    }

    function getSeveridadColor(severidad) {
        const colores = {
            'CRITICA': '#dc2626',
            'ALTA': '#ea580c', 
            'MEDIA': '#d97706',
            'BAJA': '#65a30d',
            'INFORMATIVA': '#0284c7'
        };
        return colores[severidad?.toUpperCase()] || '#6b7280';
    }

    // --------------------------
    // Manejadores de eventos
    // --------------------------
    function handleSuggestionClick(button) {
        if (elements.messageInput) {
            elements.messageInput.value = button.textContent;
            sendMessage();
        }
    }

    function handleActionClick(button) {
        const accion = button.dataset.accion;
        const data = button.dataset.data;
        
        switch (accion) {
            case 'alarmas':
                elements.messageInput.value = '2';
                sendMessage();
                break;
            case 'documentacion':
                elements.messageInput.value = '5';
                sendMessage();
                break;
            case 'incidentes':
                elements.messageInput.value = '6';
                sendMessage();
                break;
            case 'ver-detalle':
                buscarAlarmaPorId(data);
                break;
        }
    }
  
    function handleLikeClick(button) {
        const alarmaId = button.dataset.data;
        let likedAlarmas = JSON.parse(localStorage.getItem('likedAlarmas') || '{}');
        
        if (button.classList.contains('liked')) {
            button.classList.remove('liked');
            button.textContent = '👍';
            delete likedAlarmas[alarmaId];
        } else {
            button.classList.add('liked');
            button.textContent = '💙';
            likedAlarmas[alarmaId] = true;
        }
        
        localStorage.setItem('likedAlarmas', JSON.stringify(likedAlarmas));
    }

    function handleVerDetalleClick(button) {
        const alarmaId = button.dataset.alarmaId;
        localStorage.setItem('alarmaDetalle', JSON.stringify({
            ID: alarmaId,
            timestamp: new Date().toISOString()
        }));
        window.location.href = `detalle_alarma.html?id=${alarmaId}&volver=chat`;
    }

    // --------------------------
    // Funciones del bot
    // --------------------------
    function showDocumentation() {
        showTyping();
        setTimeout(() => {
            hideTyping();
            addMessage(`📚 **Documentación Técnica Disponible:**\n\n` +
                `🔧 **Manuales de Operación**\n` +
                `📋 **Guías de Configuración**\n` + 
                `📖 **Procedimientos de Mantenimiento**\n` +
                `🔍 **Catálogo de Códigos de Error**\n` +
                `📊 **Reportes de Análisis**\n\n` +
                `¿Qué tipo de documentación necesitas?`, 'bot', {
                opciones: [
                    'Manual técnico',
                    'Guías de configuración', 
                    'Procedimientos',
                    'Catálogo de errores'
                ]
            });
            flujo.paso = 0;
        }, 1000);
    }

    function showEstadoOperativo() {
        showTyping();
        setTimeout(() => {
            hideTyping();
            const stats = catalogoCache.estadisticas;
            let mensaje = `✅ **Estado Operativo de Plataformas**\n\n`;
            
            if (stats) {
                mensaje += `🚨 **Alarmas Críticas Activas:** ${stats.por_severidad?.CRITICA || 0}\n` +
                    `⚠️ **Alarmas de Alta Prioridad:** ${stats.por_severidad?.ALTA || 0}\n` +
                    `📋 **Total en Seguimiento:** ${stats.total}\n\n`;
            }
            
            mensaje += `🔧 **Plataformas Core:**\n` +
                `• Core Voz: **Estable** ✅\n` +
                `• Core Datos: **En Mantenimiento** 🔧\n` +
                `• Plataforma 5G: **Operativa** ✅\n` +
                `• Red MPLS: **Degradada** ⚠️`;
            
            addMessage(mensaje, 'bot');
            flujo.paso = 0;
        }, 1000);
    }

    function showContactoAdmin() {
        showTyping();
        setTimeout(() => {
            hideTyping();
            addMessage(`👨‍💻 **Contactar Administrador del Sistema**\n\n` +
                `**Equipo NOC - Centro de Operaciones:**\n` +
                `📧 **Email:** noc.operaciones@claro.com.co\n` +
                `📞 **Teléfono:** +57 1 234-5678\n` +
                `💬 **Teams:** @equipo_operaciones\n\n` +
                `**Horarios de Atención:**\n` +
                `🕐 **24/7** para emergencias críticas\n` +
                `🕐 **L-V 8:00-20:00** soporte general\n\n` +
                `**Para emergencias críticas, usa el código:** 🚨 **CORE-EMERGENCY**`, 'bot');
            flujo.paso = 0;
        }, 1000);
    }

    // --------------------------
    // Utilidades de chat
    // --------------------------
    function addMessage(text, sender, options = {}) {
        if (!elements.chatBox) return;
        
        const msgDiv = document.createElement('div');
        msgDiv.className = `${sender}-msg`;
        
        // Convertir markdown básico a HTML
        let htmlText = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
        
        msgDiv.innerHTML = htmlText;
        
        // Agregar opciones si existen
        if (options.opciones && options.opciones.length > 0) {
            const optionsDiv = document.createElement('div');
            optionsDiv.className = 'suggestions-container';
            options.opciones.forEach(opcion => {
                const btn = document.createElement('button');
                btn.className = 'suggestion-btn';
                btn.textContent = opcion;
                optionsDiv.appendChild(btn);
            });
            msgDiv.appendChild(optionsDiv);
        }
        
        // Agregar acciones si existen
        if (options.acciones && options.acciones.length > 0) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'actions-container';
            options.acciones.forEach(accion => {
                const btn = document.createElement('button');
                btn.className = `action-btn ${accion.accion}-btn`;
                btn.textContent = accion.texto;
                btn.setAttribute('data-accion', accion.accion);
                btn.setAttribute('data-data', accion.data);
                actionsDiv.appendChild(btn);
            });
            msgDiv.appendChild(actionsDiv);
        }
        
        elements.chatBox.appendChild(msgDiv);

        // Animación de entrada
        msgDiv.style.opacity = '0';
        msgDiv.style.transform = 'translateY(10px)';
        setTimeout(() => {
            msgDiv.style.transition = 'all 0.3s ease';
            msgDiv.style.opacity = '1';
            msgDiv.style.transform = 'translateY(0)';
        }, 10);

        scrollToBottom();

        chatState.messageCount++;
        if (sender === 'bot' && !chatState.isOpen) {
            chatState.unreadMessages++;
            updateNotification();
        }
    }

    function showTyping() {
        chatState.waitingForResponse = true;
        if (elements.typingIndicator) {
            elements.typingIndicator.style.display = 'flex';
        }
        scrollToBottom();
    }

    function hideTyping() {
        chatState.waitingForResponse = false;
        if (elements.typingIndicator) {
            elements.typingIndicator.style.display = 'none';
        }
    }

    function scrollToBottom() {
        if (elements.chatBox) {
            setTimeout(() => {
                elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
            }, 100);
        }
    }

    function sendMessage() {
        if (!elements.messageInput) return;
        
        const message = elements.messageInput.value.trim();
        if (message.length === 0 || chatState.waitingForResponse) return;

        addMessage(message, 'user');
        elements.messageInput.value = '';

        setTimeout(() => {
            flujoExpertoCatalogo(message);
        }, 300);
    }

    // Inicializar la aplicación
    initialize();
});