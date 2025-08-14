document.addEventListener("DOMContentLoaded", function () {
  const chatBox = document.getElementById("chat-box");
  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  let currentStep = 'main_menu'; // Para mantener el estado de la conversación

  // Función para escapar HTML
  function escapeHtml(text) {
    if (!text) return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Función para añadir mensajes al chat
  function addMessage(content, sender, options = []) {
    const messageElem = document.createElement("div");
    messageElem.classList.add("message", sender);

    if (typeof content === "string") {
      messageElem.innerHTML = `<p>${content}</p>`;
    } else {
      messageElem.appendChild(content);
    }

    chatBox.appendChild(messageElem);
    chatBox.scrollTop = chatBox.scrollHeight;

    if (options.length > 0) {
      const btnContainer = document.createElement("div");
      btnContainer.classList.add("button-container");
      options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.textContent = opt.text;
        btn.addEventListener("click", () => handleOption(opt.value));
        btnContainer.appendChild(btn);
      });
      chatBox.appendChild(btnContainer);
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  }

  // Función para manejar opciones del menú
  function handleOption(value) {
    userInput.value = value;
    sendMessage();
  }

  // Función para enviar mensajes al backend
  async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;
    
    addMessage(text, "user");
    userInput.value = "";

    try {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          step: currentStep
        })
      });

      const data = await response.json();
      currentStep = data.step || 'main_menu';

      // Procesar la respuesta del backend
      if (data.options && data.options.length > 0) {
        // Mostrar mensaje con opciones de botones
        addMessage(data.message, "bot", data.options.map(opt => ({
          text: opt.text,
          value: opt.value
        })));
      } else {
        // Mostrar mensaje simple
        addMessage(data.message, "bot");
      }
    } catch (error) {
      addMessage("❌ Error de conexión con el servidor", "bot");
      console.error("Error:", error);
    }
  }

  // Event listeners
  sendBtn.addEventListener("click", sendMessage);
  userInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      sendMessage();
    }
  });

  // Iniciar conversación
  addMessage("Buen día, hablemos de nuestras plataformas de Core. ¿Qué te gustaría consultar el día de hoy?", "bot", [
    { text: "Alarmas de plataformas", value: "1" },
    { text: "Documentación de las plataformas", value: "2" },
    { text: "Incidentes activos", value: "3" },
    { text: "Estado operativo", value: "4" },
    { text: "Cambios activos", value: "5" },
    { text: "Hablar con administrador", value: "6" }
  ]);
});