// -------------------------
// Frontend JS - flujo guiado
// -------------------------
const chatMessages = document.getElementById('chatMessages');
const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendButton');
const statusLine = document.getElementById('statusLine');
const fileModalEl = document.getElementById('fileModal');
const pdfFrame = document.getElementById('pdfFrame');
const modalTitle = document.getElementById('modalTitle');
const modalDownload = document.getElementById('modalDownload');
const bsFileModal = new bootstrap.Modal(fileModalEl);

let state = 'menu'; // menu | waiting_alarm_number | waiting_alarm_element
let alarmData = { numero: '', elemento: '' };

// Helpers
function addMessage(text, who='bot', options=[]) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${who}`;
  const bubble = document.createElement('div');
  bubble.className = `bubble ${who}`;
  bubble.innerHTML = text;
  wrapper.appendChild(bubble);

  if (options && options.length) {
    const opts = document.createElement('div');
    opts.className = 'options-container';
    options.forEach(opt => {
      const b = document.createElement('button');
      b.className = 'btn btn-outline-primary option-btn';
      if (who === 'user') b.classList.add('btn-sm');
      b.textContent = opt.text;
      b.onclick = () => handleOptionClick(opt.value, opt);
      opts.appendChild(b);
    });
    wrapper.appendChild(opts);
  }

  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addUserMessage(text) {
  addMessage(escapeHtml(text), 'user');
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function setStatus(text) { statusLine.innerText = text; }

function enableInput() { input.disabled=false; sendBtn.disabled=false; input.focus(); }
function disableInput() { input.disabled=true; sendBtn.disabled=true; }

// Inicial: comprobar health y saludar
async function init() {
  setStatus('Comprobando servidor...');
  // poll /health a la espera del csv (intenta 6 veces)
  let tries = 0, ok=false;
  while (tries < 6) {
    try {
      const res = await fetch('/health');
      const js = await res.json();
      if (js.csv_loaded) {
        setStatus(`Listo — ${js.rows} filas`);
        ok = true;
        break;
      } else {
        setStatus('Cargando datos en backend...');
      }
    } catch (e) {
      setStatus('Servidor no disponible — intentando...');
    }
    tries++;
    await new Promise(r => setTimeout(r, 800));
  }
  if (!ok) setStatus('Advertencia: CSV no cargado — pruebe igual.');
  enableInput();
  showMenu();
}

// Mostrar menu inicial (llama al endpoint chat_message para consistencia)
async function showMenu() {
  disableInput();
  try {
    const res = await fetch('/chat_message', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({}) });
    const js = await res.json();
    addMessage(js.response, 'bot', js.options);
    state = 'menu';
  } catch (e) {
    addMessage('❌ Error al obtener menú del servidor. Usa las opciones locales.', 'bot');
    // fallback local menu
    addMessage("Buen día... Elige una opción:\n1. Alarmas\n2. Documentación", 'bot', [
      {text: '🚨 Alarmas', value:'1'},
      {text: '📚 Documentación', value:'2'}
    ]);
  } finally {
    enableInput();
  }
}

// manejo clicks en botones de opción
function handleOptionClick(value, opt) {
  addUserMessage(opt.text || value);
  if (value === '1') {
    state = 'waiting_alarm_number';
    addMessage('Por favor ingresa el número de alarma que deseas consultar:', 'bot');
    enableInput();
    input.focus();
  } else if (value === '2') {
    addMessage('📚 Documentación disponible en /static/instructivos/', 'bot');
    addMessage('¿Deseas volver al menú?', 'bot', [{text:'🏠 Menú principal', value:'menu'}]);
  } else if (value === 'menu') {
    showMenu();
  } else if (value === 'open_pdf' && opt.file_path) {
    openPdf(opt.file_path, opt.text || 'Instructivo');
  } else {
    addMessage('Funcionalidad próximamente.', 'bot');
  }
}

// Envío desde input
sendBtn.addEventListener('click', onSend);
input.addEventListener('keypress', (e)=>{ if (e.key==='Enter') onSend(); });

async function onSend(){
  const txt = input.value.trim();
  if (!txt) return;
  addUserMessage(txt);
  input.value='';
  disableInput();

  if (state === 'waiting_alarm_number') {
    alarmData.numero = txt;
    state = 'waiting_alarm_element';
    addMessage('Por favor ingresa el nombre del elemento que reporta la alarma:', 'bot');
    enableInput();
    return;
  } else if (state === 'waiting_alarm_element') {
    alarmData.elemento = txt;
    await buscarAlarmaBackend(alarmData);
    state = 'menu';
    alarmData = {numero:'', elemento:''};
    enableInput();
    return;
  } else {
    try {
      const res = await fetch('/chat_message', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({message: txt})
      });
      const js = await res.json();
      addMessage(js.response, 'bot', js.options || []);
    } catch (e) {
      addMessage('❌ Error de conexión al backend.', 'bot');
    } finally {
      enableInput();
    }
  }
}

// buscar alarma via /buscar_alarma
async function buscarAlarmaBackend(data) {
  addMessage('Buscando alarma...', 'bot');
  try {
    const res = await fetch('/buscar_alarma', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(data)
    });
    const js = await res.json();
    if (!res.ok) {
      addMessage(`❌ Error servidor: ${js.message || res.statusText}`, 'bot');
      return;
    }
    if (js.success && js.encontrada) {
      const alarma = js.datos;
      let html = `<div><strong>📊 Detalles</strong></div>
                  <div><small><strong>Número:</strong> ${escapeHtml(alarma.get('NUMERO', alarma.NUMERO || alarma.get('numero') || 'N/A') || 'N/A')}</small></div>
                  <div><small><strong>Elemento:</strong> ${escapeHtml(alarma.get('ELEMENTO', alarma.get('elemento') || 'N/A'))}</small></div>
                  <div><small><strong>Descripción:</strong> ${escapeHtml(alarma.get('TEXTO 1 DE LA ALARMA','N/A'))}</small></div>
                  <div style="margin-top:8px;"></div>`;
      const opts = [];
      if (js.pdf_path) {
        opts.push({text: '📄 Ver PDF', value: 'open_pdf', file_path: js.pdf_path});
      }
      opts.push({text: '🏠 Menú principal', value: 'menu'});
      addMessage(html, 'bot', opts);
    } else {
      addMessage(`❌ ${js.message || 'No se encontró la alarma.'}`, 'bot');
      addMessage('¿Deseas volver al menú?', 'bot', [{text:'🏠 Menú principal', value:'menu'}]);
    }
  } catch (e) {
    addMessage('❌ Error en la búsqueda (conexión).', 'bot');
  }
}

// abrir pdf en modal
function openPdf(path, title='Instructivo') {
  modalTitle.textContent = title;
  pdfFrame.src = path;
  modalDownload.href = path;
  bsFileModal.show();
}

// iniciar
init();
