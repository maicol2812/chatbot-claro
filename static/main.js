// === VARIABLES GLOBALES ===
let chatAbierto = false;
let escribiendo = false;
let userId = 'user_' + Math.random().toString(36).substr(2, 9);
let modoIA = false;
let ultimaActividad = Date.now();
let contadorMensajes = 0;
let timeoutInactividad;
let metricas = {
  mensajes: 0,
  tiempoSesion: 0,
  satisfaccion: 0,
  inicioSesion: Date.now()
};

// === ELEMENTOS DOM ===
const burbujaChat = document.getElementById('burbuja-chat');
const chatContainer = document.getElementById('chat-container');
const chatBox = document.getElementById('chat-box');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const expandBtn = document.getElementById('expand-chat');
const indicadorIA = document.getElementById('indicador-ia');
const estadoIndicador = document.getElementById('estado-indicador');
const estadoTexto = document.getElementById('estado-texto');
const notificacionesContainer = document.getElementById('notificaciones-container');
const metricasOverlay = document.getElementById('metricas-overlay');

// === INICIALIZACIÓN ===
document.addEventListener('DOMContentLoaded', function() {
  inicializarSistema();
  crearParticulas();
  iniciarMonitoreoSistema();
  configurarEventListeners();
});

function inicializarSistema() {
  console.log('🚀 Sistema Asesor Claro iniciado');
  actualizarEstadoSistema('operativo');
  mostrarNotificacion('Sistema iniciado correctamente', 'success');
  metricas.inicioSesion = Date.now();
}

function configurarEventListeners() {
  // Chat toggle
  burbujaChat.addEventListener('click', toggleChat);
  
  // Expandir chat
  expandBtn.addEventListener('click', toggleExpandChat);
  
  // Envío de mensajes
  chatForm.addEventListener('submit', enviarMensaje);
  
  // Enter para enviar, Shift+Enter para nueva línea
  chatInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje(e);
    }
  });
  
  // Detectar escritura
  chatInput.addEventListener('input', detectarEscritura);
  
  // Doble clic para métricas
  burbujaChat.addEventListener('dblclick', mostrarMetricas);
  
  // Atajos de teclado
  document.addEventListener('keydown', manejarAtajos);
  
  // Resetear inactividad
  document.addEventListener('click', resetearInactividad);
  document.addEventListener('keypress', resetearInactividad);
}

// === FUNCIONES DE CHAT ===
function toggleChat() {
  chatAbierto = !chatAbierto;
  chatContainer.classList.toggle('mostrar', chatAbierto);
  
  if (chatAbierto) {
    chatInput.focus();
    burbujaChat.style.display = 'none';
    actualizarIndicadorIA('activo');
    
    // Mostrar menú después de 3 segundos si es la primera vez
    if (contadorMensajes === 0) {
      setTimeout(mostrarMenu, 3000);
    }
  } else {
    burbujaChat.style.display = 'flex';
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
  metricas.mensajes++;
  
  // Detectar comandos especiales
  if (manejarComandosEspeciales(mensaje)) {
    return;
  }
  
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
      actualizarEstadoSegunRespuesta(data.tipo);
    } else {
      agregarMensaje('❌ Error: No se recibió respuesta del servidor', 'bot', 'error');
    }
    
  } catch (error) {
    console.error('Error en comunicación:', error);
    removerEscribiendo();
    agregarMensaje(`❌ Error de conexión: ${error.message}. Verifica que el servidor Flask esté funcionando.`, 'bot', 'error');
  }
  
  resetearInactividad();
}

function agregarMensaje(mensaje, tipo, categoria = '') {
  const mensajeDiv = document.createElement('div');
  mensajeDiv.className = `${tipo}-msg`;
  
  if (categoria) {
    mensajeDiv.classList.add(categoria);
  }
  
  // Formatear mensaje con markdown básico
  const mensajeFormateado = formatearMensaje(mensaje);
  mensajeDiv.innerHTML = mensajeFormateado;
  
  chatBox.appendChild(mensajeDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
  
  // Efectos especiales según categoría
  if (categoria === 'emergencia') {
    activarModoEmergencia();
  } else if (categoria === 'ia_avanzada') {
    activarModoIA();
  }
}

function formatearMensaje(mensaje) {
  return mensaje
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/━+/g, '<hr style="border: 1px solid rgba(255,255,255,0.2); margin: 10px 0;">')
    .replace(/\n/g, '<br>');
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
  if (!indicadorIA) return;
  
  if (estado === 'activo') {
    indicadorIA.style.background = 'var(--accent-color)';
    indicadorIA.style.animation = 'pulse 2s infinite';
  } else {
    indicadorIA.style.background = 'var(--text-secondary)';
    indicadorIA.style.animation = 'none';
  }
}

// === COMANDOS ESPECIALES ===
function manejarComandosEspeciales(mensaje) {
  const comando = mensaje.toLowerCase().trim();
  
  switch(comando) {
    case 'menu':
    case 'opciones':
      mostrarMenu();
      return true;
    case 'limpiar':
    case 'clear':
      limpiarChat();
      return true;
    case 'estado':
    case 'estado sistema':
      mostrarEstadoSistema();
      return true;
    case 'metricas':
      mostrarMetricas();
      return true;
    case 'ayuda':
    case 'help':
      mostrarAyuda();
      return true;
    default:
      return false;
  }
}

function limpiarChat() {
  chatBox.innerHTML = `
    <div class="bot-msg">
      🤖 <strong>Chat limpiado</strong><br>
      ¿En qué puedo ayudarte?
    </div>
  `;
}

function mostrarEstadoSistema() {
  const tiempoSesion = Math.floor((Date.now() - metricas.inicioSesion) / 1000);
  const estadoHTML = `
    📊 <strong>Estado del Sistema</strong><br><br>
    🟢 <strong>Estado:</strong> Operativo<br>
    ⏱️ <strong>Tiempo de sesión:</strong> ${tiempoSesion}s<br>
    💬 <strong>Mensajes:</strong> ${metricas.mensajes}<br>
    🆔 <strong>ID de usuario:</strong> ${userId}<br>
    🔄 <strong>Última actividad:</strong> ${new Date(ultimaActividad).toLocaleTimeString()}
  `;
  agregarMensaje(estadoHTML, 'bot', 'info');
}

function mostrarAyuda() {
  const ayudaHTML = `
    ❓ <strong>Comandos disponibles:</strong><br><br>
    • <strong>menu</strong> - Mostrar opciones principales<br>
    • <strong>limpiar</strong> - Limpiar el chat<br>
    • <strong>estado</strong> - Ver estado del sistema<br>
    • <strong>metricas</strong> - Ver métricas detalladas<br>
    • <strong>ayuda</strong> - Mostrar esta ayuda<br><br>
    <em>También puedes usar los botones de acciones rápidas.</em>
  `;
  agregarMensaje(ayudaHTML, 'bot', 'info');
}

// === ACCIONES RÁPIDAS ===
function enviarAccionRapida(texto) {
  chatInput.value = texto;
  enviarMensaje();
}

// === SISTEMA DE NOTIFICACIONES ===
function mostrarNotificacion(mensaje, tipo = 'info', duracion = 3000) {
  const notificacion = document.createElement('div');
  notificacion.className = `notificacion ${tipo}`;
  notificacion.textContent = mensaje;
  
  if (notificacionesContainer) {
    notificacionesContainer.appendChild(notificacion);
    
    setTimeout(() => {
      notificacion.classList.add('fadeOut');
      setTimeout(() => {
        if (notificacion.parentNode) {
          notificacion.parentNode.removeChild(notificacion);
        }
      }, 300);
    }, duracion);
  }
}

// === SISTEMA DE MÉTRICAS ===
function mostrarMetricas() {
  const tiempoSesion = Math.floor((Date.now() - metricas.inicioSesion) / 1000);
  
  const metricasHTML = `
    <div class="metrica">
      <span class="metrica-label">Mensajes enviados:</span>
      <span class="metrica-valor">${metricas.mensajes}</span>
    </div>
    <div class="metrica">
      <span class="metrica-label">Tiempo de sesión:</span>
      <span class="metrica-valor">${tiempoSesion}s</span>
    </div>
    <div class="metrica">
      <span class="metrica-label">Usuario ID:</span>
      <span class="metrica-valor">${userId}</span>
    </div>
    <div class="metrica">
      <span class="metrica-label">Chat abierto:</span>
      <span class="metrica-valor">${chatAbierto ? 'Sí' : 'No'}</span>
    </div>
  `;
  
  if (metricasOverlay) {
    document.getElementById('metricas-content').innerHTML = metricasHTML;
    metricasOverlay.style.display = 'flex';
  }
}

function cerrarMetricas() {
  if (metricasOverlay) {
    metricasOverlay.style.display = 'none';
  }
}

// === EFECTOS VISUALES ===
function crearParticulas() {
  const particlesContainer = document.getElementById('particles');
  if (!particlesContainer) return;
  
  for (let i = 0; i < 50; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 20 + 's';
    particle.style.animationDuration = (Math.random() * 10 + 20) + 's';
    particlesContainer.appendChild(particle);
  }
}

function activarModoEmergencia() {
  document.body.classList.add('modo-emergencia');
  mostrarNotificacion('🚨 Modo emergencia activado', 'warning');
  
  setTimeout(() => {
    document.body.classList.remove('modo-emergencia');
  }, 5000);
}

function activarModoIA() {
  modoIA = true;
  actualizarIndicadorIA('ia-activo');
  mostrarNotificacion('🧠 Modo IA avanzado activado', 'info');
}

// === MONITOREO DEL SISTEMA ===
function iniciarMonitoreoSistema() {
  setInterval(() => {
    actualizarEstadoSistema('operativo');
    metricas.tiempoSesion = Date.now() - metricas.inicioSesion;
  }, 5000);
}

function actualizarEstadoSistema(estado) {
  if (!estadoIndicador || !estadoTexto) return;
  
  switch(estado) {
    case 'operativo':
      estadoIndicador.style.backgroundColor = '#4CAF50';
      estadoTexto.textContent = 'Sistema Operativo';
      break;
    case 'alerta':
      estadoIndicador.style.backgroundColor = '#FF9800';
      estadoTexto.textContent = 'Sistema en Alerta';
      break;
    case 'error':
      estadoIndicador.style.backgroundColor = '#F44336';
      estadoTexto.textContent = 'Sistema con Error';
      break;
  }
}

function actualizarEstadoSegunRespuesta(tipo) {
  if (tipo === 'emergencia') {
    actualizarEstadoSistema('alerta');
  } else if (tipo === 'error') {
    actualizarEstadoSistema('error');
  } else {
    actualizarEstadoSistema('operativo');
  }
}

// === DETECCIÓN DE ACTIVIDAD ===
function detectarEscritura() {
  ultimaActividad = Date.now();
  // Aquí puedes agregar lógica para mostrar "está escribiendo"
}

function resetearInactividad() {
  clearTimeout(timeoutInactividad);
  timeoutInactividad = setTimeout(() => {
    if (chatAbierto && contadorMensajes > 0) {
      agregarMensaje('¿Necesitas ayuda con algo más? Escribe "menu" para ver las opciones.', 'bot', 'info');
    }
  }, 120000); // 2 minutos
}

// === ATAJOS DE TECLADO ===
function manejarAtajos(e) {
  if (e.ctrlKey || e.metaKey) {
    switch(e.key) {
      case 'k':
        e.preventDefault();
        if (!chatAbierto) {
          toggleChat();
        }
        chatInput.focus();
        break;
      case 'l':
        e.preventDefault();
        limpiarChat();
        break;
      case 'm':
        e.preventDefault();
        mostrarMenu();
        break;
    }
  }
  
  if (e.key === 'Escape' && chatAbierto) {
    toggleChat();
  }
}

// === FUNCIONES GLOBALES ===
window.enviarAccionRapida = enviarAccionRapida;
window.mostrarMenu = mostrarMenu;
window.cerrarMetricas = cerrarMetricas;
window.mostrarMetricas = mostrarMetricas;