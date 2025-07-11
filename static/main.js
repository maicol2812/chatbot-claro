let chatAbierto = false;
    let userId = 'user_' + Math.random().toString(36).substr(2, 9);
    let contadorMensajes = 0;

    // === ELEMENTOS DOM ===
    const burbuja = document.getElementById('burbuja-chat');
    const chatContainer = document.getElementById('chat-container');
    const chatBox = document.getElementById('chat-box');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const expandBtn = document.getElementById('expand-chat');
    const indicadorIA = document.getElementById('indicador-ia');

    // === INICIALIZACIÓN ===
    document.addEventListener('DOMContentLoaded', function() {
      console.log('🚀 Sistema Asesor Claro iniciado');
      configurarEventListeners();
    });

    function configurarEventListeners() {
      burbuja.addEventListener('click', toggleChat);
      expandBtn.addEventListener('click', toggleExpandChat);
      chatForm.addEventListener('submit', enviarMensaje);
      chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          enviarMensaje(e);
        }
      });
    }

    // === FUNCIONES DE CHAT ===
    function toggleChat() {
      chatAbierto = !chatAbierto;
      chatContainer.classList.toggle('mostrar', chatAbierto);
      
      if (chatAbierto) {
        chatInput.focus();
        burbuja.style.display = 'none';
        actualizarIndicadorIA('activo');
        
        // Mostrar menú después de 3 segundos si es la primera vez
        if (contadorMensajes === 0) {
          setTimeout(mostrarMenu, 3000);
        }
      } else {
        burbuja.style.display = 'flex';
        actualizarIndicadorIA('inactivo');
      }
    }

    function toggleExpandChat() {
      chatContainer.classList.toggle('expandido');
      expandBtn.textContent = chatContainer.classList.contains('expandido') ? '⤡' : '⤢';
    }

    function mostrarMenu() {
      const menuHTML = `
        📋 <strong>Opciones disponibles:</strong><br><br>
        <strong>1️⃣</strong> Alarmas de plataformas<br>
        <strong>2️⃣</strong> Documentación de las plataformas<br>
        <strong>3️⃣</strong> Incidentes activos de las plataformas<br>
        <strong>4️⃣</strong> Estado operativo de las plataformas<br>
        <strong>5️⃣</strong> Cambios activos en las plataformas<br>
        <strong>6️⃣</strong> Hablar con el administrador<br><br>
        <em>Escribe el número de la opción que deseas.</em>
      `;
      agregarMensaje(menuHTML, 'bot', 'menu');
    }

    async function enviarMensaje(e) {
      if (e) e.preventDefault();
      
      const mensaje = chatInput.value.trim();
      if (!mensaje) return;

      // Agregar mensaje del usuario
      agregarMensaje(mensaje, 'user');
      chatInput.value = '';
      contadorMensajes++;
      
      // Mostrar indicador de escritura
      mostrarEscribiendo();
      
      try {
        console.log('Enviando mensaje:', mensaje);
        
        // Enviar al backend
        const response = await fetch('/chat', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ 
            message: mensaje,
            user_id: userId,
            timestamp: Date.now()
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Respuesta del servidor:', data);
        
        // Remover indicador de escritura
        removerEscribiendo();
        
        // Agregar respuesta del bot
        if (data.response) {
          agregarMensaje(data.response, 'bot', data.tipo || '');
        } else {
          agregarMensaje('❌ Error: No se recibió respuesta del servidor', 'bot', 'error');
        }
        
      } catch (error) {
        console.error('Error en comunicación:', error);
        removerEscribiendo();
        agregarMensaje(`❌ Error de conexión: ${error.message}. Verifica que el servidor Flask esté funcionando.`, 'bot', 'error');
      }
    }

    function agregarMensaje(mensaje, tipo, categoria = '') {
      const mensajeDiv = document.createElement('div');
      mensajeDiv.className = `${tipo}-msg`;
      
      if (categoria) {
        mensajeDiv.classList.add(categoria);
      }
      
      // Formatear mensaje
      const mensajeFormateado = mensaje
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
      
      mensajeDiv.innerHTML = mensajeFormateado;
      chatBox.appendChild(mensajeDiv);
      chatBox.scrollTop = chatBox.scrollHeight;
    }

    function mostrarEscribiendo() {
      const escribiendoDiv = document.createElement('div');
      escribiendoDiv.className = 'escribiendo';
      escribiendoDiv.id = 'escribiendo';
      escribiendoDiv.innerHTML = '<span></span><span></span><span></span>';
      chatBox.appendChild(escribiendoDiv);
      chatBox.scrollTop = chatBox.scrollHeight;
    }

    function removerEscribiendo() {
      const escribiendo = document.getElementById('escribiendo');
      if (escribiendo) {
        escribiendo.remove();
      }
    }

    function actualizarIndicadorIA(estado) {
      if (estado === 'activo') {
        indicadorIA.style.background = 'var(--accent-color)';
        indicadorIA.style.animation = 'pulse 2s infinite';
      } else {
        indicadorIA.style.background = 'var(--text-secondary)';
        indicadorIA.style.animation = 'none';
      }
    }

    // === ACCIONES RÁPIDAS ===
    function enviarAccionRapida(texto) {
      chatInput.value = texto;
      enviarMensaje();
    }

    // === MANEJO DE COMANDOS ESPECIALES ===
    function manejarComandoEspecial(comando) {
      switch(comando.toLowerCase()) {
        case 'menu':
        case 'opciones':
          mostrarMenu();
          return true;
        case 'limpiar':
        case 'clear':
          chatBox.innerHTML = `
            <div class="bot-msg">
              🤖 <strong>Chat limpiado</strong><br>
              ¿En qué puedo ayudarte?
            </div>
          `;
          return true;
        default:
          return false;
      }
    }

    // Exponer funciones globales
    window.enviarAccionRapida = enviarAccionRapida;
    window.mostrarMenu = mostrarMenu;

    // === FUNCIONES ADICIONALES ===
    
    // Detectar si el usuario está inactivo
    let timeoutInactividad;
    function resetearInactividad() {
      clearTimeout(timeoutInactividad);
      timeoutInactividad = setTimeout(() => {
        if (chatAbierto && contadorMensajes > 0) {
          agregarMensaje('¿Necesitas ayuda con algo más? Escribe "menu" para ver las opciones.', 'bot', 'info');
        }
      }, 2500); // 1 minuto
    }

    // Resetear inactividad en cada interacción
    document.addEventListener('click', resetearInactividad);
    document.addEventListener('keypress', resetearInactividad);

  /* ─────────────────────────────────────────
     Expandir / minimizar el contenedor      */
  function toggleExpand() {
    chat.classList.toggle('expandido');
    expand.textContent = chat.classList.contains('expandido') ? '⤡' : '⤢';
  }

  /* ─────────────────────────────────────────
     Agrega mensaje al chat                  */
  function agregarMensaje(msg, tipo = 'bot', extraClass = '') {
    const div = document.createElement('div');
    div.className = `${tipo}-msg${extraClass ? ' ' + extraClass : ''}`;
    div.innerHTML = msg.replace(/\n/g, '<br>');
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  /* ─────────────────────────────────────────
     Envía mensaje al backend Flask          */
  async function enviarMensaje(e) {
    e.preventDefault();
    const texto = chatInput.value.trim();
    if (!texto) return;

    agregarMensaje(texto, 'user');
    chatInput.value = '';

    try {
      const res  = await fetch('/chat', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ message: texto })
      });
      const data = await res.json();
      agregarMensaje(data.response, 'bot');
    } catch (err) {
      agregarMensaje('❌ Error de conexión', 'bot');
    }
  }

  /* ─────────────────────────────────────────
     Acciones rápidas                        */
  function enviarAccionRapida(texto) {
    chatInput.value = texto;
    chatForm.dispatchEvent(new Event('submit'));
  }

  // === Eventos ===
  burbuja.addEventListener('click', toggleChat);
  expand.addEventListener('click', toggleExpand);
  chatForm.addEventListener('submit', enviarMensaje);

  // Exponer al global para los botones rápidos
  window.enviarAccionRapida = enviarAccionRapida;
;
