
document.addEventListener("DOMContentLoaded", function () {
  const chatBox = document.getElementById("chat-box");
  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");

  function escapeHtml(text) {
    if (!text) return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

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

  function handleOption(value) {
    if (value === "menu") {
      mostrarMenu();
    }
  }

  function mostrarMenu() {
    addMessage("📋 Menú principal:", "bot", [
      { text: "🔍 Buscar alarma", value: "buscar" },
      { text: "❌ Salir", value: "salir" },
    ]);
  }

  async function buscarAlarmaBackend(data) {
    addMessage("Buscando alarma...", "bot");
    try {
      // Construir parámetros GET
      const params = new URLSearchParams();
      if (data.numero) params.append("numero", data.numero);
      if (data.elemento) params.append("elemento", data.elemento);

      const res = await fetch(`/buscar?${params.toString()}`);
      const js = await res.json();

      if (!Array.isArray(js) || js.length === 0) {
        addMessage("❌ No se encontró ninguna alarma con esos datos.", "bot");
        addMessage("¿Deseas volver al menú?", "bot", [
          { text: "🏠 Menú principal", value: "menu" },
        ]);
        return;
      }

      const alarma = js[0];

      let html = `<div><strong>📊 Detalles de la alarma</strong></div>
                  <div><small><strong>Número:</strong> ${escapeHtml(alarma["Numero alarma"] || "N/A")}</small></div>
                  <div><small><strong>Elemento:</strong> ${escapeHtml(alarma["Nombre del elemento"] || "N/A")}</small></div>
                  <div><small><strong>Descripción:</strong> ${escapeHtml(alarma["Descripción alarma"] || "N/A")}</small></div>
                  <div><small><strong>Severidad:</strong> ${escapeHtml(alarma["Severidad"] || "N/A")}</small></div>
                  <div><small><strong>Significado:</strong> ${escapeHtml(alarma["Significado"] || "N/A")}</small></div>
                  <div><small><strong>Acciones:</strong> ${escapeHtml(alarma["Acciones"] || "N/A")}</small></div>
                  <div style="margin-top:8px;"></div>`;

      const opts = [{ text: "🏠 Menú principal", value: "menu" }];
      addMessage(html, "bot", opts);
    } catch (e) {
      addMessage("❌ Error en la búsqueda (conexión).", "bot");
    }
  }

  sendBtn.addEventListener("click", () => {
    const text = userInput.value.trim();
    if (text) {
      addMessage(text, "user");
      if (text.toLowerCase().startsWith("buscar")) {
        const partes = text.split(" ");
        buscarAlarmaBackend({
          numero: partes[1] || "",
          elemento: partes.slice(2).join(" ") || "",
        });
      } else if (text.toLowerCase() === "menu") {
        mostrarMenu();
      } else {
        addMessage("No entendí tu solicitud. Escribe 'buscar [número] [elemento]'.", "bot");
      }
      userInput.value = "";
    }
  });

  mostrarMenu();
});
