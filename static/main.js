document.addEventListener("DOMContentLoaded", function() {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    let currentStep = 'main_menu';

    // Mostrar mensaje de bienvenida
    addMessage("Buen día, ¿qué deseas consultar hoy?", "bot");
    showOptions([
        {text: "Alarmas", value: "1"},
        {text: "Documentación", value: "2"},
        {text: "Incidentes", value: "3"},
        {text: "Estado operativo", value: "4"},
        {text: "Cambios programados", value: "5"},
        {text: "Contactar soporte", value: "6"}
    ]);

    // Función para enviar mensajes
    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text) return;
        
        addMessage(text, "user");
        userInput.value = "";

        try {
            const response = await fetch('/api/chatbot', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({message: text, step: currentStep})
            });

            const data = await response.json();
            currentStep = data.step;

            // Mostrar respuesta
            addMessage(data.message, "bot");
            
            // Mostrar alarmas si existen
            if (data.alarmas && data.alarmas.length > 0) {
                showAlarms(data.alarmas);
            }
            
            // Mostrar opciones si existen
            if (data.options && data.options.length > 0) {
                showOptions(data.options);
            }
        } catch (error) {
            addMessage("Error de conexión", "bot");
            console.error(error);
        }
    }

    // Función para mostrar alarmas
    function showAlarms(alarmas) {
        const container = document.createElement('div');
        container.className = 'alarms-container';
        
        alarmas.forEach(alarma => {
            const alarmDiv = document.createElement('div');
            alarmDiv.className = 'alarm-card';
            alarmDiv.innerHTML = `
                <h4>Alarma ${alarma['Numero alarma'] || 'N/A'}</h4>
                <p><strong>Elemento:</strong> ${alarma['Nombre del elemento'] || 'N/A'}</p>
                <p><strong>Descripción:</strong> ${alarma['Descripción alarma'] || 'N/A'}</p>
                <p><strong>Severidad:</strong> ${alarma['Severidad'] || 'N/A'}</p>
            `;
            container.appendChild(alarmDiv);
        });
        
        chatBox.appendChild(container);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Función para mostrar opciones
    function showOptions(options) {
        const container = document.createElement('div');
        container.className = 'options-container';
        
        options.forEach(option => {
            const btn = document.createElement('button');
            btn.textContent = option.text;
            btn.onclick = () => {
                userInput.value = option.value;
                sendMessage();
            };
            container.appendChild(btn);
        });
        
        chatBox.appendChild(container);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Función para agregar mensajes
    function addMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}-message`;
        msgDiv.textContent = text;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Event listeners
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
});