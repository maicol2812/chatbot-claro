// Configuración
const config = {
    timeout: 5000,
    maxRetries: 3,
    retryDelay: 2000,
    supportedLanguages: ['es', 'en', 'fr', 'de', 'pt'],
    maxFileSize: 5 * 1024 * 1024 // 5MB
};

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
    currentLanguage: navigator.language.split('-')[0] || 'es',
    darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
    voiceRecognition: null,
    metrics: {
        messagesSent: 0,
        alarmsChecked: 0,
        emergencies: 0,
        satisfaction: 4.5,
        responseTime: 0,
        sessionsToday: 1,
        voiceCommandsUsed: 0,
        translationsMade: 0,
        filesUploaded: 0
    }
};

// Mapeo de estados backend-frontend
const STATE_MAPPING = {
    'await_alarm_number': 'request_alarm_number',
    'await_element_name': 'request_element_name',
    '': 'provide_alarm_details'
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    initChat();
    setupEventListeners();
    showWelcomeMessage();
    startConnectionMonitor();
    initVoiceRecognition();
    applyThemePreference();
    initMetricsDashboard();
    checkNotificationPermission();
});

// Funciones principales
function initChat() {
    const chatContainer = document.getElementById('chat-container');
    const chatBubble = document.getElementById('chat-bubble');
    
    // Asegurarse de que el chat esté oculto inicialmente
    chatContainer.classList.add('hidden');
    chatContainer.classList.remove('show');
    
    // Event listeners
    chatBubble.addEventListener('click', toggleChat);
    document.getElementById('expand-chat').addEventListener('click', toggleChatExpand);
    document.getElementById('minimize-chat').addEventListener('click', toggleChat);
    document.getElementById('chat-form').addEventListener('submit', handleSubmit);
    
    // Auto-focus en el input cuando se abre
    chatContainer.addEventListener('transitionend', () => {
        if (state.isOpen) {
            document.getElementById('chat-input').focus();
        }
    });
}

function setupEventListeners() {
    const emergencyBtn = document.getElementById('emergency-btn');
    if (emergencyBtn) {
        emergencyBtn.addEventListener('click', () => {
            activateEmergencyMode(true);
            processMessage("¡Necesito ayuda urgente!");
        });
    }

    // Prevenir cierre accidental del chat
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.isOpen) {
            toggleChat();
        }
    });

    // Inactividad
    setInterval(checkInactivity, 300000); // 5 minutos
    document.addEventListener('mousemove', updateActivity);
    document.addEventListener('keypress', updateActivity);

    // Botón de voz
    const voiceBtn = document.getElementById('voice-btn');
    if (voiceBtn) {
        voiceBtn.addEventListener('click', toggleVoiceRecognition);
    }

    // Botón de adjuntar archivo
    const fileBtn = document.getElementById('file-btn');
    if (fileBtn) {
        fileBtn.addEventListener('click', () => document.getElementById('file-input').click());
    }

    // Input de archivo
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
    }

    // Botón de traducción
    const translateBtn = document.getElementById('translate-btn');
    if (translateBtn) {
        translateBtn.addEventListener('click', showLanguageSelector);
    }

    // Botón de tema oscuro/ligero
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }

    // Botón de métricas
    const metricsBtn = document.getElementById('metrics-btn');
    if (metricsBtn) {
        metricsBtn.addEventListener('click', toggleMetricsDashboard);
    }
}

// Funciones de voz (WebSpeech API)
function initVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn('Web Speech API no soportada en este navegador');
        return;
    }

    state.voiceRecognition = new SpeechRecognition();
    state.voiceRecognition.continuous = false;
    state.voiceRecognition.interimResults = false;
    state.voiceRecognition.lang = state.currentLanguage;

    state.voiceRecognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript.trim()) {
            document.getElementById('chat-input').value = transcript;
            state.metrics.voiceCommandsUsed++;
            updateMetricsChart();
        }
    };

    state.voiceRecognition.onerror = (event) => {
        console.error('Error en reconocimiento de voz:', event.error);
        showNotification(`Error de voz: ${event.error}`, 'error');
    };
}

function toggleVoiceRecognition() {
    if (!state.voiceRecognition) {
        showNotification('Reconocimiento de voz no soportado en tu navegador', 'error');
        return;
    }

    try {
        if (state.isListening) {
            state.voiceRecognition.stop();
            document.getElementById('voice-btn').classList.remove('active');
            state.isListening = false;
        } else {
            state.voiceRecognition.start();
            document.getElementById('voice-btn').classList.add('active');
            state.isListening = true;
            showNotification('Escuchando... Habla ahora', 'info');
        }
    } catch (error) {
        console.error('Error al iniciar reconocimiento de voz:', error);
        showNotification('Error al iniciar el micrófono', 'error');
    }
}

// Funciones de traducción
function showLanguageSelector() {
    const selector = document.createElement('div');
    selector.className = 'language-selector';
    selector.innerHTML = `
        <h4>Seleccionar idioma</h4>
        <div class="language-options">
            ${config.supportedLanguages.map(lang => `
                <button class="language-option ${state.currentLanguage === lang ? 'active' : ''}" 
                        data-lang="${lang}">
                    ${getLanguageName(lang)}
                </button>
            `).join('')}
        </div>
    `;

    // Event listeners para los botones de idioma
    selector.querySelectorAll('.language-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.dataset.lang;
            changeLanguage(lang);
            selector.remove();
        });
    });

    document.body.appendChild(selector);
    setTimeout(() => selector.classList.add('show'), 10);
}

function getLanguageName(code) {
    const names = {
        'es': 'Español',
        'en': 'English',
        'fr': 'Français',
        'de': 'Deutsch',
        'pt': 'Português'
    };
    return names[code] || code;
}

async function changeLanguage(lang) {
    if (!config.supportedLanguages.includes(lang)) {
        showNotification('Idioma no soportado', 'error');
        return;
    }

    if (state.currentLanguage === lang) return;

    try {
        // Aquí iría la llamada a la API de traducción (Google Translate o DeepL)
        // Por ahora simulamos la traducción
        state.currentLanguage = lang;
        if (state.voiceRecognition) {
            state.voiceRecognition.lang = lang;
        }

        showNotification(`Idioma cambiado a ${getLanguageName(lang)}`, 'success');
        state.metrics.translationsMade++;
        updateMetricsChart();

        // Aquí podrías traducir los mensajes existentes si es necesario
    } catch (error) {
        console.error('Error cambiando idioma:', error);
        showNotification('Error cambiando idioma', 'error');
    }
}

// Funciones de tema oscuro/ligero
function applyThemePreference() {
    if (state.darkMode) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

function toggleTheme() {
    state.darkMode = !state.darkMode;
    applyThemePreference();
    localStorage.setItem('chatDarkMode', state.darkMode);
}

// Funciones de métricas con Chart.js
function initMetricsDashboard() {
    const metricsContainer = document.getElementById('metrics-container');
    if (!metricsContainer) return;

    // Crear el canvas para el gráfico
    const canvas = document.createElement('canvas');
    canvas.id = 'metrics-chart';
    metricsContainer.appendChild(canvas);

    // Inicializar el gráfico
    updateMetricsChart();
}

function updateMetricsChart() {
    const ctx = document.getElementById('metrics-chart');
    if (!ctx) return;

    // Datos para el gráfico
    const data = {
        labels: ['Mensajes', 'Alarmas', 'Emergencias', 'Voz', 'Traducciones', 'Archivos'],
        datasets: [{
            label: 'Actividad del Usuario',
            data: [
                state.metrics.messagesSent,
                state.metrics.alarmsChecked,
                state.metrics.emergencies,
                state.metrics.voiceCommandsUsed,
                state.metrics.translationsMade,
                state.metrics.filesUploaded
            ],
            backgroundColor: [
                'rgba(54, 162, 235, 0.5)',
                'rgba(255, 99, 132, 0.5)',
                'rgba(255, 159, 64, 0.5)',
                'rgba(75, 192, 192, 0.5)',
                'rgba(153, 102, 255, 0.5)',
                'rgba(255, 205, 86, 0.5)'
            ],
            borderColor: [
                'rgba(54, 162, 235, 1)',
                'rgba(255, 99, 132, 1)',
                'rgba(255, 159, 64, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(255, 205, 86, 1)'
            ],
            borderWidth: 1
        }]
    };

    // Configuración del gráfico
    const config = {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Métricas de Uso'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    };

    // Destruir el gráfico anterior si existe
    if (window.metricsChart) {
        window.metricsChart.destroy();
    }

    // Crear nuevo gráfico
    window.metricsChart = new Chart(ctx, config);
}

function toggleMetricsDashboard() {
    const metricsContainer = document.getElementById('metrics-container');
    if (!metricsContainer) return;

    metricsContainer.classList.toggle('show');
    if (metricsContainer.classList.contains('show')) {
        updateMetricsChart();
    }
}

// Funciones de subida de archivos
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tamaño del archivo
    if (file.size > config.maxFileSize) {
        showNotification(`El archivo es demasiado grande (máximo ${config.maxFileSize / 1024 / 1024}MB)`, 'error');
        return;
    }

    // Mostrar previsualización (si es imagen)
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.maxWidth = '100%';
            img.style.maxHeight = '200px';
            
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message user-message file-message';
            messageDiv.appendChild(img);
            
            const timestamp = document.createElement('div');
            timestamp.className = 'message-timestamp';
            timestamp.textContent = new Date().toLocaleTimeString();
            messageDiv.appendChild(timestamp);
            
            document.getElementById('chat-messages').appendChild(messageDiv);
            scrollToBottom();
        };
        reader.readAsDataURL(file);
    }

    // Aquí iría la subida real al servidor
    // Simulamos la subida con un setTimeout
    showNotification(`Subiendo ${file.name}...`, 'info');
    
    setTimeout(() => {
        state.metrics.filesUploaded++;
        updateMetricsChart();
        showNotification(`${file.name} subido correctamente`, 'success');
        processMessage(`He subido el archivo: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);
    }, 2000);

    // Limpiar el input
    event.target.value = '';
}

// Funciones de notificaciones push
function checkNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('Este navegador no soporta notificaciones push');
        return;
    }

    if (Notification.permission === 'granted') {
        return;
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('Permiso para notificaciones concedido');
            }
        });
    }
}

function showPushNotification(title, options) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }

    // Mostrar notificación
    const notification = new Notification(title, options);

    // Cerrar notificación después de 5 segundos
    setTimeout(() => notification.close(), 5000);
}

// Sugerencias inteligentes
function showSmartSuggestions(context) {
    const suggestions = getSuggestionsBasedOnContext(context);
    if (!suggestions.length) return;

    const suggestionsContainer = document.getElementById('suggestions-container');
    if (!suggestionsContainer) return;

    suggestionsContainer.innerHTML = '';
    suggestions.forEach(suggestion => {
        const btn = document.createElement('button');
        btn.className = 'suggestion';
        btn.textContent = suggestion;
        btn.addEventListener('click', () => {
            document.getElementById('chat-input').value = suggestion;
            suggestionsContainer.innerHTML = '';
        });
        suggestionsContainer.appendChild(btn);
    });

    suggestionsContainer.classList.add('show');
}

function getSuggestionsBasedOnContext(context) {
    // Esta función debería analizar el contexto y devolver sugerencias relevantes
    // Por ahora devolvemos algunas sugerencias genéricas
    if (state.waitingForAlarmNumber) {
        return ['12345', '67890', '54321'];
    } else if (state.waitingForElementName) {
        return ['Motor principal', 'Válvula de seguridad', 'Sensor de temperatura'];
    } else if (state.isEmergency) {
        return ['¡Necesito ayuda urgente!', 'Fallo crítico en el sistema', 'Accidente en la zona 5'];
    } else {
        return ['Consulta de alarma', 'Historial de alarmas', 'Contactar con soporte'];
    }
}

// El resto de las funciones (handleSubmit, processMessage, etc.) permanecen igual que en tu código original
// Solo necesitarías actualizar las que interactúan con las nuevas funcionalidades

// Ejemplo de actualización de processMessage para incluir sugerencias
async function processMessage(message, retryCount = 0) {
    // ... (código existente)
    
    // Después de procesar el mensaje, mostrar sugerencias
    showSmartSuggestions({
        lastMessage: message,
        currentState: state.waitingForAlarmNumber ? 'await_alarm_number' : 
                    state.waitingForElementName ? 'await_element_name' : '',
        isEmergency: state.isEmergency
    });
    
    // ... (resto del código existente)
}