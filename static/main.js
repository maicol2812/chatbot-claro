document.addEventListener("DOMContentLoaded", function() {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    let currentStep = 'main_menu';
    let currentAlarmData = null;

    showWelcomeMessage();

    sendBtn.addEventListener('click', processUserInput);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') processUserInput();
    });

    async function processUserInput() {
        const text = userInput.value.trim();
        if (!text) return;

        addMessage(text, "user");
        userInput.value = "";

        try {
            const response = await fetch('/api/chatbot', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    message: text,
                    step: currentStep,
                    alarm_data: currentAlarmData
                })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            handleBotResponse(data);

        } catch (error) {
            showError("Error de conexión con el servidor");
            console.error("Chatbot error:", error);
        }
    }

    function handleBotResponse(response) {
        currentStep = response.step || 'main_menu';

        if (response.alarm_data) {
            currentAlarmData = response.alarm_data;
        }

        if (response.message) addMessage(response.message, "bot");
        if (response.alarmas) showAlarms(response.alarmas);
        if (response.options) showOptions(response.options);
        if (response.quick_actions) showQuickActions(response.quick_actions);
    }

    function showWelcomeMessage() {
        addMessage("Buen día, hablemos de nuestras plataformas de Core. ¿Qué te gustaría consultar hoy?", "bot");
        showOptions([
            {text: "🛎️ Alarmas", value: "1", type: "alarm"},
            {text: "📄 Documentación", value: "2", type: "document"},
            {text: "⚠️ Incidentes", value: "3", type: "incident"},
            {text: "📊 Estado operativo", value: "4", type: "status"},
            {text: "🔄 Cambios programados", value: "5", type: "changes"},
            {text: "👨‍💻 Contactar soporte", value: "6", type: "support"}
        ]);
    }

    function showAlarms(alarmas) {
        const container = document.createElement('div');
        container.className = 'alarms-container';

        alarmas.forEach(alarma => {
            const alarmDiv = document.createElement('div');
            alarmDiv.className = 'alarm-card';

            const severity = (alarma['Severidad'] || '').toLowerCase();
            let severityClass = 'severity-medium';
            if (severity.includes('critic') || severity.includes('alta')) severityClass = 'severity-high';
            if (severity.includes('baja')) severityClass = 'severity-low';

            alarmDiv.innerHTML = `
                <div class="alarm-header">
                    <span class="alarm-id">Alarma #${alarma['Numero alarma'] || 'N/A'}</span>
                    <span class="severity-badge ${severityClass}">${alarma['Severidad'] || 'N/A'}</span>
                </div>
                <div class="alarm-details">
                    <p><strong>Elemento:</strong> ${alarma['Nombre del elemento'] || 'N/A'}</p>
                    <p><strong>Descripción:</strong> ${alarma['Descripción alarma'] || 'N/A'}</p>
                    <p><strong>Última actualización:</strong> ${alarma['Fecha'] || 'N/A'}</p>
                </div>
                <div class="alarm-actions">
                    <button class="action-btn" data-action="details" data-alarm="${alarma['Numero alarma']}">Ver detalles</button>
                    <button class="action-btn" data-action="documentation" data-alarm="${alarma['Numero alarma']}">Documentación</button>
                </div>
            `;

            container.appendChild(alarmDiv);
        });

        chatBox.appendChild(container);
        chatBox.scrollTop = chatBox.scrollHeight;

        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.getAttribute('data-action');
                const alarmId = e.target.getAttribute('data-alarm');
                handleAlarmAction(action, alarmId);
            });
        });
    }

    function handleAlarmAction(action, alarmId) {
        switch(action) {
            case 'details':
                fetchAlarmDetails(alarmId);
                break;
            case 'documentation':
                fetchAlarmDocumentation(alarmId);
                break;
            default:
                addMessage(`Acción "${action}" no reconocida para alarma ${alarmId}`, "bot");
        }
    }

    async function fetchAlarmDetails(alarmId) {
        try {
            const response = await fetch(`/api/alarmas/${alarmId}/detalles`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            showAlarmDetails(data);
        } catch (error) {
            showError("Error al obtener detalles de la alarma");
        }
    }

    function showAlarmDetails(details) {
        // Mostrar detalles
    }

    function showOptions(options) {
        const container = document.createElement('div');
        container.className = 'options-container';

        options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = `option-btn ${option.type || ''}`;
            btn.textContent = option.text;
            btn.onclick = () => {
                userInput.value = option.value;
                processUserInput();
            };
            container.appendChild(btn);
        });

        chatBox.appendChild(container);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function showQuickActions(actions) {
        // Implementación si se requiere
    }

    function showError(message) {
        addMessage(`❌ ${message}`, "bot");
    }

    function addMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}-message`;
        msgDiv.textContent = text;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
});
