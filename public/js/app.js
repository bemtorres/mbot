/**
 * MBot Studio - Lógica principal del Frontend
 */

// Estado global de la aplicación
const state = {
  bots: [],
  activeBot: null,
  activeConversation: null,
  messages: [],
  isSending: false,
  settings: null,
  lastTrace: null,
  tracesByMessageId: {},
};

// Inicialización al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  if (window.lucide) lucide.createIcons();
  await loadSettingsStatus();
  await loadBots();
});

/* ========================================================
   MODO CLARO / OSCURO (THEME SWITCHER)
======================================================== */
function initTheme() {
  const savedTheme = localStorage.getItem('mbot_theme') || 'dark';
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  const html = document.documentElement;
  const icon = document.getElementById('theme-icon');
  
  if (theme === 'light') {
    html.classList.remove('dark');
    if (icon) icon.setAttribute('data-lucide', 'moon');
  } else {
    html.classList.add('dark');
    if (icon) icon.setAttribute('data-lucide', 'sun');
  }
  
  localStorage.setItem('mbot_theme', theme);
  if (window.lucide) lucide.createIcons();
}

function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  applyTheme(isDark ? 'light' : 'dark');
}

/* ========================================================
   CARGA DE CONFIGURACIÓN Y ESTADO DE APIS
======================================================== */
async function loadSettingsStatus() {
  try {
    const res = await API.getSettings();
    if (res.success) {
      state.settings = res.data;
      updateApiStatusIndicators(res.data);
    }
  } catch (err) {
    console.error('Error cargando ajustes:', err);
  }
}

function updateApiStatusIndicators(settings) {
  const openAiBadge = document.getElementById('badge-openai-status');
  const deepseekBadge = document.getElementById('badge-deepseek-status');
  const modalOpenAiStatus = document.getElementById('modal-openai-status-text');
  const modalDeepseekStatus = document.getElementById('modal-deepseek-status-text');

  if (settings.openai?.isConfigured) {
    openAiBadge.className = 'w-2 h-2 rounded-full bg-emerald-400';
    if (modalOpenAiStatus) modalOpenAiStatus.innerHTML = `<span class="text-emerald-400 font-semibold">✓ Conectada (${settings.openai.maskedKey})</span>`;
  } else {
    openAiBadge.className = 'w-2 h-2 rounded-full bg-amber-400 animate-pulse';
    if (modalOpenAiStatus) modalOpenAiStatus.innerHTML = '<span class="text-amber-400 font-medium">⚠️ No configurada</span>';
  }

  if (settings.deepseek?.isConfigured) {
    deepseekBadge.className = 'w-2 h-2 rounded-full bg-emerald-400';
    if (modalDeepseekStatus) modalDeepseekStatus.innerHTML = `<span class="text-emerald-400 font-semibold">✓ Conectada (${settings.deepseek.maskedKey})</span>`;
  } else {
    deepseekBadge.className = 'w-2 h-2 rounded-full bg-amber-400 animate-pulse';
    if (modalDeepseekStatus) modalDeepseekStatus.innerHTML = '<span class="text-amber-400 font-medium">⚠️ No configurada</span>';
  }
}

/* ========================================================
   GESTIÓN DE BOTS
======================================================== */
async function loadBots() {
  try {
    const res = await API.getBots();
    if (res.success && res.data.length > 0) {
      state.bots = res.data;
      renderBotsList();

      // Mantener el bot activo o seleccionar el primero
      if (!state.activeBot) {
        selectBot(state.bots[0].id);
      } else {
        const found = state.bots.find(b => b.id === state.activeBot.id);
        if (found) selectBot(found.id);
        else selectBot(state.bots[0].id);
      }
    } else {
      document.getElementById('bots-list').innerHTML = `
        <div class="text-center py-6 text-slate-400 text-xs">
          No hay bots creados. Haz clic en "Nuevo Bot".
        </div>
      `;
    }
  } catch (err) {
    console.error('Error cargando bots:', err);
  }
}

function renderBotsList() {
  const container = document.getElementById('bots-list');
  const countBadge = document.getElementById('bots-count-badge');
  countBadge.innerText = `${state.bots.length} activo${state.bots.length === 1 ? '' : 's'}`;

  container.innerHTML = state.bots.map(bot => {
    const isActive = state.activeBot && state.activeBot.id === bot.id;
    const isRag = bot.type === 'rag';

    const memoryBadgeClass = isRag 
      ? 'border border-purple-800/40 bg-purple-950/30 text-purple-300' 
      : 'border border-zinc-700 bg-zinc-800/60 text-zinc-300';

    const memoryLabel = isRag ? '🧠 RAG Embeddings' : '📝 Memoria Simple';
    const providerLabel = bot.provider === 'deepseek' ? 'DeepSeek' : 'OpenAI';

    return `
      <div 
        onclick="selectBot('${bot.id}')"
        class="group p-2.5 rounded-lg cursor-pointer transition border ${
          isActive 
            ? 'bg-zinc-900 border-zinc-800 text-zinc-100 shadow-xs' 
            : 'border-transparent hover:border-zinc-800/80 hover:bg-zinc-900/50 text-zinc-400 hover:text-zinc-200'
        }"
      >
        <div class="flex items-start gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-sm shrink-0 mt-0.5">
            ${bot.avatar || '🤖'}
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1">
              <h4 class="font-medium text-xs truncate ${isActive ? 'text-zinc-100 font-semibold' : 'text-zinc-300'}">
                ${escapeHtml(bot.name)}
              </h4>
              <span class="text-[9px] px-1 py-0.2 rounded font-mono uppercase bg-zinc-800/80 text-zinc-400 border border-zinc-700/60 shrink-0">
                ${providerLabel}
              </span>
            </div>

            <p class="text-[11px] text-zinc-500 truncate mt-0.5">${escapeHtml(bot.role || 'Asistente')}</p>

            <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span class="text-[9px] font-mono px-1.5 py-0.2 rounded ${memoryBadgeClass}">
                ${memoryLabel}
              </span>
              ${isRag ? `
                <span class="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                  ${bot.document_count || 0} doc
                </span>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

async function selectBot(botId) {
  const bot = state.bots.find(b => b.id === botId);
  if (!bot) return;

  state.activeBot = bot;
  renderBotsList();

  // Actualizar Header
  document.getElementById('active-bot-avatar').innerText = bot.avatar || '🤖';
  document.getElementById('active-bot-name').innerText = bot.name;
  document.getElementById('active-bot-role').innerText = bot.role || 'Asistente';

  const typeBadge = document.getElementById('active-bot-type-badge');
  const isRag = bot.type === 'rag';
  
  if (isRag) {
    typeBadge.className = 'text-[10px] px-2 py-0.5 rounded-full font-mono border border-purple-900/60 bg-purple-950/40 text-purple-300';
    typeBadge.innerText = 'Memoria RAG (Embeddings)';
  } else {
    typeBadge.className = 'text-[10px] px-2 py-0.5 rounded-full font-mono border border-emerald-900/60 bg-emerald-950/40 text-emerald-400';
    typeBadge.innerText = 'Memoria Simple (SQLite)';
  }

  const providerLabel = bot.provider === 'deepseek' ? 'DeepSeek' : 'OpenAI';
  document.getElementById('active-bot-provider').innerText = `${providerLabel} • ${bot.model}`;

  // Mostrar u ocultar botón de Base de Conocimiento
  const btnKnowledge = document.getElementById('btn-knowledge-base');
  const quickPromptRag = document.getElementById('quick-prompt-rag');
  const docCountBadge = document.getElementById('active-bot-doc-count');

  if (isRag) {
    btnKnowledge.classList.remove('hidden');
    quickPromptRag.classList.remove('hidden');
    docCountBadge.innerText = bot.document_count || 0;
  } else {
    btnKnowledge.classList.add('hidden');
    quickPromptRag.classList.add('hidden');
  }

  // Cargar conversación del bot
  await loadBotConversation(bot.id);
}

async function loadBotConversation(botId) {
  try {
    const convRes = await API.getConversations(botId);
    let conv = null;

    if (convRes.success && convRes.data.length > 0) {
      conv = convRes.data[0];
    } else {
      // Si no existe, cargar una nueva
      const createRes = await fetch(`/api/bots/${botId}/conversations`, { method: 'POST' });
      const newConv = await createRes.json();
      conv = newConv.data;
    }

    state.activeConversation = conv;
    await loadMessages(conv.id);
  } catch (err) {
    console.error('Error cargando conversación:', err);
  }
}

async function loadMessages(conversationId) {
  const container = document.getElementById('messages-container');
  container.innerHTML = '<div class="text-center py-6 text-slate-500 text-xs">Cargando memoria del bot...</div>';

  try {
    const res = await API.getMessages(conversationId);
    if (res.success) {
      state.messages = res.data;
      renderMessages();
    }
  } catch (err) {
    console.error('Error cargando mensajes:', err);
  }
}

/* ========================================================
   RENDERIZADO DE MENSAJES Y CHAT
======================================================== */
function renderMessages() {
  const container = document.getElementById('messages-container');
  
  if (state.messages.length === 0) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400">
        <div class="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-2xl mb-3 shadow-sm">
          ${state.activeBot ? state.activeBot.avatar : '🤖'}
        </div>
        <h4 class="text-sm font-semibold text-zinc-100 mb-1">Conversación con ${escapeHtml(state.activeBot?.name || 'el bot')}</h4>
        <p class="text-xs text-zinc-400 max-w-md leading-relaxed">
          ${state.activeBot?.type === 'rag' 
            ? 'Bot con memoria aumentada por Embeddings de OpenAI y búsqueda semántica en SQLite.'
            : 'Bot con memoria conversacional de texto simple guardada en SQLite.'}
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.messages.map(msg => {
    const isUser = msg.role === 'user';
    const parsedContent = marked.parse(msg.content || '');

    // Si tiene fragmentos RAG utilizados
    let sourcesHtml = '';
    if (!isUser && msg.context_used && Array.isArray(msg.context_used) && msg.context_used.length > 0) {
      const snippets = msg.context_used.map((src, i) => `
        <div class="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs mt-1.5">
          <div class="flex items-center justify-between text-[11px] text-purple-300 font-medium mb-1">
            <span>📄 ${escapeHtml(src.doc_title || 'Documento')} (Fragmento #${src.chunk_index + 1})</span>
            <span class="bg-purple-950/60 text-purple-300 border border-purple-800/40 px-1.5 py-0.2 rounded font-mono text-[10px]">
              Similitud: ${(src.similarity * 100).toFixed(1)}%
            </span>
          </div>
          <p class="text-zinc-400 font-mono text-[11px] leading-relaxed">${escapeHtml(src.chunk_text)}</p>
        </div>
      `).join('');

      sourcesHtml = `
        <details class="mt-2 text-xs group">
          <summary class="cursor-pointer select-none inline-flex items-center gap-1.5 px-2 py-1 rounded border border-purple-800/30 bg-purple-950/20 text-purple-300 hover:bg-purple-950/40 transition text-[11px] font-medium">
            <i data-lucide="brain" class="w-3.5 h-3.5"></i>
            <span>🧠 ${msg.context_used.length} fragmento${msg.context_used.length === 1 ? '' : 's'} de memoria RAG recuperado${msg.context_used.length === 1 ? '' : 's'}</span>
          </summary>
          <div class="space-y-1.5 mt-2 pl-1 border-l-2 border-purple-700/40">
            ${snippets}
          </div>
        </details>
      `;
    }

    if (isUser) {
      return `
        <div class="max-w-4xl mx-auto flex justify-end">
          <div class="max-w-[85%] sm:max-w-[70%] rounded-2xl rounded-tr-xs bg-zinc-100 text-zinc-900 px-4 py-2.5 shadow-xs text-sm leading-relaxed">
            <div class="text-[11px] font-semibold text-zinc-600 mb-0.5 text-right">
              Tú
            </div>
            <div class="text-sm leading-relaxed whitespace-pre-wrap">${escapeHtml(msg.content)}</div>
            <div class="text-[10px] text-zinc-500 text-right mt-1 font-mono">
              ${formatTime(msg.created_at)}
            </div>
          </div>
        </div>
      `;
    } else {
      const traceData = msg.trace || state.tracesByMessageId[msg.id];
      const traceBadgeText = traceData 
        ? `${traceData.totalTokens || 0} tokens • ${traceData.totalDurationMs || 0}ms`
        : 'Ver pipeline';

      return `
        <div class="max-w-4xl mx-auto flex items-start gap-3">
          <div class="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-sm shrink-0 shadow-xs mt-0.5">
            ${state.activeBot ? state.activeBot.avatar : '🤖'}
          </div>
          <div class="max-w-[95%] sm:max-w-[85%] rounded-2xl rounded-tl-xs bg-[#0c0c0e] border border-zinc-800 text-zinc-100 px-4 py-3 shadow-xs">
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <span class="text-xs font-semibold text-zinc-200 tracking-tight">${escapeHtml(state.activeBot?.name || 'Bot')}</span>
              <span class="text-[10px] text-zinc-500 font-mono">${formatTime(msg.created_at)}</span>
            </div>
            <div class="prose-chat text-sm leading-relaxed">${parsedContent}</div>
            ${sourcesHtml}

            <!-- Botón Representación Paso a Paso del Mensaje -->
            <div class="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2 flex-wrap">
              <button 
                onclick="openRepresentationModal('${msg.id}')" 
                class="inline-flex items-center gap-1.5 h-6 px-2.5 rounded border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-medium transition shadow-xs"
                title="Inspeccionar paso a paso cómo se generó esta respuesta"
              >
                <i data-lucide="git-merge" class="w-3.5 h-3.5 text-amber-400"></i>
                <span>⚡ Representación</span>
              </button>
              <span class="text-[10px] text-zinc-500 font-mono">
                ${traceBadgeText} • SQLite
              </span>
            </div>
          </div>
        </div>
      `;
    }
  }).join('');

  if (window.lucide) lucide.createIcons();
  scrollToBottom();
}

function scrollToBottom() {
  const container = document.getElementById('messages-container');
  container.scrollTop = container.scrollHeight;
}

/* ========================================================
   ENVÍO DE MENSAJES Y CHAT
======================================================== */
async function handleSendMessage(event) {
  if (event) event.preventDefault();
  if (state.isSending) return;

  const input = document.getElementById('message-input');
  const text = input.value.trim();
  if (!text) return;

  if (!state.activeBot || !state.activeConversation) {
    alert('No hay un bot o conversación activa seleccionada.');
    return;
  }

  // Desactivar input mientras procesa
  state.isSending = true;
  input.value = '';
  input.style.height = 'auto';
  document.getElementById('send-btn').disabled = true;

  // Añadir mensaje del usuario temporalmente al UI
  const tempUserMsg = {
    id: `temp-${Date.now()}`,
    role: 'user',
    content: text,
    created_at: new Date().toISOString()
  };
  state.messages.push(tempUserMsg);
  renderMessages();

  // Mostrar visualización animada del pipeline paso a paso
  appendTypingIndicator();

  try {
    const res = await API.sendMessage(state.activeBot.id, state.activeConversation.id, text);
    removeTypingIndicator();

    if (res.success) {
      if (res.data.trace) {
        state.lastTrace = res.data.trace;
        state.tracesByMessageId[res.data.messageId] = res.data.trace;
      }

      const assistantMsg = {
        id: res.data.messageId,
        role: 'assistant',
        content: res.data.reply,
        context_used: res.data.sourcesUsed || null,
        trace: res.data.trace || null,
        created_at: new Date().toISOString()
      };
      state.messages.push(assistantMsg);
      renderMessages();
    } else {
      state.messages.push({
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `❌ **Error:** ${res.error || 'Ocurrió un error al procesar el mensaje.'}`,
        created_at: new Date().toISOString()
      });
      renderMessages();
    }
  } catch (err) {
    removeTypingIndicator();
    state.messages.push({
      id: `err-${Date.now()}`,
      role: 'assistant',
      content: `❌ **Error de red o servidor:** ${err.message}`,
      created_at: new Date().toISOString()
    });
    renderMessages();
  } finally {
    state.isSending = false;
    document.getElementById('send-btn').disabled = false;
    input.focus();
  }
}

function appendTypingIndicator() {
  const container = document.getElementById('messages-container');
  const typingDiv = document.createElement('div');
  typingDiv.id = 'typing-indicator-box';
  typingDiv.className = 'max-w-4xl mx-auto flex items-start gap-3 w-full';
  
  const isRag = state.activeBot?.type === 'rag';
  const provider = (state.activeBot?.provider || 'openai').toUpperCase();
  const model = state.activeBot?.model || 'gpt-4o-mini';

  typingDiv.innerHTML = `
    <div class="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-sm shrink-0 shadow-xs mt-0.5">
      ${state.activeBot ? state.activeBot.avatar : '🤖'}
    </div>
    <div class="w-full max-w-md rounded-2xl rounded-tl-xs bg-[#0c0c0e] border border-zinc-800 p-3.5 shadow-md space-y-2.5">
      
      <!-- Cabecera del Indicador en Vivo -->
      <div class="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
          <span class="text-xs font-semibold text-zinc-200 tracking-tight">Ejecutando Flujo del Sistema...</span>
        </div>
        <button onclick="openRepresentationModal()" class="h-6 px-2 rounded border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[10px] font-medium transition">
          ⚡ Representación
        </button>
      </div>

      <!-- Pasos visuales en tiempo real -->
      <div class="space-y-1.5 text-[11px] font-mono text-zinc-300">
        <div class="flex items-center gap-2 text-emerald-400">
          <span class="w-4 text-center">✓</span>
          <span>1. Entrada guardada en SQLite (tabla 'messages')</span>
        </div>
        <div class="flex items-center gap-2 text-emerald-400">
          <span class="w-4 text-center">✓</span>
          <span>2. Recuperando historial previo en SQLite</span>
        </div>
        <div class="flex items-center gap-2 text-amber-300 animate-pulse">
          <span class="w-4 text-center">⏳</span>
          <span>${isRag ? '3. OpenAI Embeddings & Similitud Coseno en SQLite...' : '3. Ensamblando contexto directo (Memoria Simple)...'}</span>
        </div>
        <div class="flex items-center gap-2 text-zinc-400">
          <span class="w-4 text-center">⏳</span>
          <span>4. Enviando prompt a ${provider} (${model})...</span>
        </div>
        <div class="flex items-center gap-2 text-zinc-500">
          <span class="w-4 text-center">⏳</span>
          <span>5. Esperando tokens devueltos y persistencia final...</span>
        </div>
      </div>

      <div class="pt-1 flex items-center justify-between text-[10px] text-zinc-500 border-t border-zinc-800/60 font-mono">
        <span>SQLite + ${isRag ? 'OpenAI Embeddings' : 'Historial Simple'}</span>
        <div class="flex gap-1">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>

    </div>
  `;
  container.appendChild(typingDiv);
  if (window.lucide) lucide.createIcons();
  scrollToBottom();
}

function removeTypingIndicator() {
  const el = document.getElementById('typing-indicator-box');
  if (el) el.remove();
}

function handleInputKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSendMessage();
  }
}

function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
}

function sendQuickPrompt(promptText) {
  const input = document.getElementById('message-input');
  input.value = promptText;
  handleSendMessage();
}

async function clearChatHistory() {
  if (!state.activeConversation) return;
  if (!confirm(`¿Deseas limpiar toda la memoria conversacional de este chat con ${state.activeBot?.name}?`)) return;

  try {
    const res = await API.clearConversation(state.activeConversation.id);
    if (res.success) {
      await loadMessages(state.activeConversation.id);
    }
  } catch (err) {
    alert('Error al limpiar conversación: ' + err.message);
  }
}

/* ========================================================
   MODAL: EDITAR / CREAR PERFIL DEL BOT (IDENTIDAD)
======================================================== */
function openCreateBotModal() {
  document.getElementById('modal-bot-title').innerText = 'Crear Nuevo Bot con Identidad';
  document.getElementById('bot-form-id').value = '';
  document.getElementById('bot-form-avatar').value = '🤖';
  document.getElementById('bot-form-name').value = '';
  document.getElementById('bot-form-role').value = '';
  document.querySelector('input[name="bot-form-type"][value="simple"]').checked = true;
  document.getElementById('bot-form-provider').value = 'openai';
  handleProviderChange();
  document.getElementById('bot-form-temperature').value = '0.7';
  document.getElementById('temp-val-display').innerText = '0.7';
  document.getElementById('bot-form-prompt').value = 
`Eres un chatbot inteligente con una identidad propia bien definida.
Tu personalidad es atenta, profesional y enfocada en resolver problemas.
Mantén siempre el hilo de la conversación y responde de manera clara y estructurada.`;

  document.getElementById('btn-delete-bot').classList.add('hidden');
  document.getElementById('modal-bot-profile').classList.remove('hidden');
  document.getElementById('modal-bot-profile').classList.add('flex');
}

function openEditBotModal() {
  if (!state.activeBot) return;
  const bot = state.activeBot;

  document.getElementById('modal-bot-title').innerText = `Editar Identidad: ${bot.name}`;
  document.getElementById('bot-form-id').value = bot.id;
  document.getElementById('bot-form-avatar').value = bot.avatar || '🤖';
  document.getElementById('bot-form-name').value = bot.name;
  document.getElementById('bot-form-role').value = bot.role || '';
  
  const typeRadio = document.querySelector(`input[name="bot-form-type"][value="${bot.type}"]`);
  if (typeRadio) typeRadio.checked = true;

  document.getElementById('bot-form-provider').value = bot.provider || 'openai';
  handleProviderChange(bot.model);

  document.getElementById('bot-form-temperature').value = bot.temperature || 0.7;
  document.getElementById('temp-val-display').innerText = bot.temperature || 0.7;
  document.getElementById('bot-form-prompt').value = bot.system_prompt;

  document.getElementById('btn-delete-bot').classList.remove('hidden');
  document.getElementById('modal-bot-profile').classList.remove('hidden');
  document.getElementById('modal-bot-profile').classList.add('flex');
}

function closeBotProfileModal() {
  document.getElementById('modal-bot-profile').classList.add('hidden');
  document.getElementById('modal-bot-profile').classList.remove('flex');
}

function setFormAvatar(emoji) {
  document.getElementById('bot-form-avatar').value = emoji;
}

function handleProviderChange(selectedModel = null) {
  const provider = document.getElementById('bot-form-provider').value;
  const modelSelect = document.getElementById('bot-form-model');

  if (provider === 'deepseek') {
    modelSelect.innerHTML = `
      <option value="deepseek-chat">deepseek-chat (DeepSeek-V3)</option>
      <option value="deepseek-reasoner">deepseek-reasoner (DeepSeek-R1 Razonamiento)</option>
    `;
  } else {
    modelSelect.innerHTML = `
      <option value="gpt-4o-mini">gpt-4o-mini (Rápido y Económico)</option>
      <option value="gpt-4o">gpt-4o (Máxima Capacidad)</option>
      <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
    `;
  }

  if (selectedModel) {
    modelSelect.value = selectedModel;
  }
}

async function handleSaveBotProfile(event) {
  event.preventDefault();

  const id = document.getElementById('bot-form-id').value;
  const avatar = document.getElementById('bot-form-avatar').value.trim() || '🤖';
  const name = document.getElementById('bot-form-name').value.trim();
  const role = document.getElementById('bot-form-role').value.trim();
  const type = document.querySelector('input[name="bot-form-type"]:checked').value;
  const provider = document.getElementById('bot-form-provider').value;
  const model = document.getElementById('bot-form-model').value;
  const temperature = parseFloat(document.getElementById('bot-form-temperature').value);
  const system_prompt = document.getElementById('bot-form-prompt').value.trim();

  const payload = { avatar, name, role, type, provider, model, temperature, system_prompt };

  try {
    if (id) {
      // Actualizar existente
      const res = await API.updateBot(id, payload);
      if (res.success) {
        closeBotProfileModal();
        await loadBots();
        selectBot(id);
      } else {
        alert('Error: ' + res.error);
      }
    } else {
      // Crear nuevo
      const res = await API.createBot(payload);
      if (res.success) {
        closeBotProfileModal();
        await loadBots();
        selectBot(res.data.id);
      } else {
        alert('Error: ' + res.error);
      }
    }
  } catch (err) {
    alert('Error al guardar bot: ' + err.message);
  }
}

async function handleDeleteCurrentBot() {
  const id = document.getElementById('bot-form-id').value;
  if (!id) return;

  if (!confirm('¿Seguro que deseas eliminar este bot? Se borrarán sus conversaciones y embeddings asociados.')) {
    return;
  }

  try {
    const res = await API.deleteBot(id);
    if (res.success) {
      closeBotProfileModal();
      state.activeBot = null;
      await loadBots();
    } else {
      alert('Error: ' + res.error);
    }
  } catch (err) {
    alert('Error al eliminar bot: ' + err.message);
  }
}

/* ========================================================
   MODAL: BASE DE CONOCIMIENTO (RAG Y EMBEDDINGS)
======================================================== */
async function openKnowledgeModal() {
  if (!state.activeBot || state.activeBot.type !== 'rag') return;

  document.getElementById('knowledge-bot-name').innerText = state.activeBot.name;
  document.getElementById('modal-knowledge').classList.remove('hidden');
  document.getElementById('modal-knowledge').classList.add('flex');

  switchKnowledgeTab('docs');
  await loadKnowledgeDocs();
}

function closeKnowledgeModal() {
  document.getElementById('modal-knowledge').classList.add('hidden');
  document.getElementById('modal-knowledge').classList.remove('flex');
}

function switchKnowledgeTab(tab) {
  const tabs = ['docs', 'add', 'test'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const content = document.getElementById(`tab-content-${t}`);
    if (t === tab) {
      btn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-white border border-slate-700';
      content.classList.remove('hidden');
    } else {
      btn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60';
      content.classList.add('hidden');
    }
  });
}

async function loadKnowledgeDocs() {
  if (!state.activeBot) return;

  const container = document.getElementById('knowledge-docs-list');
  const countBadge = document.getElementById('knowledge-tab-count');

  try {
    const res = await API.getKnowledgeDocs(state.activeBot.id);
    if (res.success) {
      const docs = res.data;
      countBadge.innerText = docs.length;

      if (docs.length === 0) {
        container.innerHTML = `
          <div class="text-center py-8 text-slate-500 text-xs">
            No hay documentos en la base de conocimiento de ${state.activeBot.name}.
            <br>Haz clic en <strong>+ Añadir Documento</strong> para indexar información con OpenAI Embeddings.
          </div>
        `;
        return;
      }

      container.innerHTML = docs.map(doc => `
        <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-start justify-between gap-3 hover:border-slate-700 transition">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h5 class="font-bold text-sm text-slate-200 truncate">${escapeHtml(doc.title)}</h5>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                ${doc.chunk_count} fragmentos (embeddings)
              </span>
            </div>
            <p class="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">${escapeHtml(doc.content)}</p>
            <div class="text-[10px] text-slate-500 mt-2 flex items-center gap-2">
              <span>Registrado: ${formatDate(doc.created_at)}</span>
              <span>•</span>
              <span class="text-indigo-400">SQLite Vector Store</span>
            </div>
          </div>

          <button 
            onclick="handleDeleteKnowledgeDoc('${doc.id}')"
            class="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition shrink-0" 
            title="Eliminar documento y sus embeddings"
          >
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      `).join('');

      if (window.lucide) lucide.createIcons();
    }
  } catch (err) {
    console.error('Error cargando documentos de conocimiento:', err);
  }
}

async function handleAddDocument(event) {
  event.preventDefault();
  if (!state.activeBot) return;

  const titleInput = document.getElementById('doc-input-title');
  const contentInput = document.getElementById('doc-input-content');
  const submitBtn = document.getElementById('btn-submit-doc');

  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  if (!title || !content) return;

  submitBtn.disabled = true;
  submitBtn.innerHTML = `
    <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
    <span>Vectorizando con OpenAI...</span>
  `;

  try {
    const res = await API.addKnowledgeDoc(state.activeBot.id, title, content);
    if (res.success) {
      alert(`✅ ${res.data.message}`);
      titleInput.value = '';
      contentInput.value = '';
      switchKnowledgeTab('docs');
      await loadKnowledgeDocs();
      await loadBots(); // Actualizar contador en sidebar
    } else {
      alert(`Error al indexar: ${res.error}`);
    }
  } catch (err) {
    alert(`Error de conexión al generar embeddings: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `
      <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
      <span>Fragmentar y Generar Embeddings</span>
    `;
    if (window.lucide) lucide.createIcons();
  }
}

async function handleDeleteKnowledgeDoc(docId) {
  if (!confirm('¿Seguro que deseas eliminar este documento y todos sus vectores de SQLite?')) return;

  try {
    const res = await API.deleteKnowledgeDoc(docId);
    if (res.success) {
      await loadKnowledgeDocs();
      await loadBots();
    } else {
      alert('Error: ' + res.error);
    }
  } catch (err) {
    alert('Error al eliminar: ' + err.message);
  }
}

async function handleTestSearch(event) {
  event.preventDefault();
  if (!state.activeBot) return;

  const queryInput = document.getElementById('test-search-query');
  const resultsContainer = document.getElementById('test-search-results');
  const query = queryInput.value.trim();
  if (!query) return;

  resultsContainer.innerHTML = '<div class="text-xs text-purple-300 py-3">Vectorizando consulta y comparando cosenos en SQLite...</div>';

  try {
    const res = await API.testSemanticSearch(state.activeBot.id, query);
    if (res.success && res.data.results) {
      const results = res.data.results;
      if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="text-xs text-slate-500 py-2">No se encontraron fragmentos con suficiente similitud.</div>';
        return;
      }

      resultsContainer.innerHTML = `
        <div class="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
          <span>Top Fragmentos Recuperados:</span>
          <span class="text-[11px] text-purple-400 font-mono">${res.data.mode === 'openai_embeddings' ? 'Vector OpenAI (Coseno)' : 'Coincidencia fallback'}</span>
        </div>
        ${results.map((r, i) => `
          <div class="p-3 rounded-xl bg-slate-900 border border-purple-500/30 text-xs space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-200">#${i + 1} ${escapeHtml(r.doc_title || 'Doc')} (Chunk #${r.chunk_index + 1})</span>
              <span class="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono font-bold text-[11px]">
                ${(r.similarity * 100).toFixed(1)}% Similitud
              </span>
            </div>
            <div class="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div class="bg-gradient-to-r from-purple-500 to-indigo-500 h-1.5 rounded-full" style="width: ${Math.min(100, r.similarity * 100)}%"></div>
            </div>
            <p class="text-slate-400 font-mono text-[11px] mt-1.5 leading-relaxed bg-slate-950/60 p-2 rounded border border-slate-800/80">
              ${escapeHtml(r.chunk_text)}
            </p>
          </div>
        `).join('')}
      `;
    }
  } catch (err) {
    resultsContainer.innerHTML = `<div class="text-xs text-rose-400 py-2">Error en la prueba: ${err.message}</div>`;
  }
}

/* ========================================================
   MODAL: AJUSTES DE API KEYS
======================================================== */
function openSettingsModal() {
  document.getElementById('modal-settings').classList.remove('hidden');
  document.getElementById('modal-settings').classList.add('flex');
}

function closeSettingsModal() {
  document.getElementById('modal-settings').classList.add('hidden');
  document.getElementById('modal-settings').classList.remove('flex');
}

async function saveApiSettings() {
  const openAiKey = document.getElementById('input-openai-key').value.trim();
  const deepseekKey = document.getElementById('input-deepseek-key').value.trim();

  const payload = {};
  if (openAiKey) payload.openaiApiKey = openAiKey;
  if (deepseekKey) payload.deepseekApiKey = deepseekKey;

  try {
    const res = await API.saveSettings(payload);
    if (res.success) {
      alert('✅ Claves actualizadas exitosamente en SQLite.');
      closeSettingsModal();
      document.getElementById('input-openai-key').value = '';
      document.getElementById('input-deepseek-key').value = '';
      await loadSettingsStatus();
    } else {
      alert('Error: ' + res.error);
    }
  } catch (err) {
    alert('Error al guardar configuración: ' + err.message);
  }
}

/* ========================================================
   MODAL: REPRESENTACIÓN VISUAL DEL FLUJO DEL SISTEMA
======================================================== */
function openRepresentationModal(messageId = null) {
  let trace = null;

  if (messageId && state.tracesByMessageId[messageId]) {
    trace = state.tracesByMessageId[messageId];
  } else if (state.lastTrace) {
    trace = state.lastTrace;
  } else {
    // Generar un trace ilustrativo basado en el bot activo
    const bot = state.activeBot || { name: 'Alex', type: 'simple', provider: 'openai', model: 'gpt-4o-mini' };
    trace = createDefaultTraceForBot(bot);
  }

  // Actualizar cabecera y estadísticas
  const botBadge = document.getElementById('rep-bot-badge');
  botBadge.innerText = `${trace.botName} (${trace.botType === 'rag' ? 'RAG Embeddings' : 'Memoria Simple'})`;

  document.getElementById('rep-stat-time').innerText = `${trace.totalDurationMs || 0} ms`;
  document.getElementById('rep-stat-prompt-tokens').innerText = trace.promptTokens || 0;
  document.getElementById('rep-stat-completion-tokens').innerText = trace.completionTokens || 0;
  document.getElementById('rep-stat-model').innerText = `${(trace.provider || 'openai').toUpperCase()} • ${trace.model || 'gpt-4o-mini'}`;

  // Actualizar nodo RAG en el pipeline gráfico
  const ragNode = document.getElementById('pipe-step-rag');
  if (ragNode) {
    if (trace.botType === 'rag') {
      ragNode.className = 'p-2 rounded-lg bg-purple-950/40 border border-purple-500/40 flex flex-col items-center';
    } else {
      ragNode.className = 'p-2 rounded-lg bg-slate-950/80 border border-slate-800 opacity-60 flex flex-col items-center';
    }
  }

  // Renderizar pasos
  const container = document.getElementById('rep-steps-container');
  container.innerHTML = trace.steps.map(step => {
    let detailsHtml = '';
    if (step.details) {
      detailsHtml = `
        <details class="mt-2 text-xs group">
          <summary class="cursor-pointer text-slate-400 hover:text-slate-200 select-none text-[11px] inline-flex items-center gap-1 font-mono">
            <span>🔍 Ver detalles técnicos y métricas</span>
          </summary>
          <pre class="mt-1.5 p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 text-slate-300 font-mono text-[11px] overflow-x-auto">${escapeHtml(JSON.stringify(step.details, null, 2))}</pre>
        </details>
      `;
    }

    return `
      <div class="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition space-y-2">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2.5">
            <span class="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs">
              ${step.stepNumber}
            </span>
            <h5 class="font-bold text-sm text-slate-100">${escapeHtml(step.title)}</h5>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              Completado
            </span>
            <span class="text-[11px] font-mono text-amber-400/90 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-500/20">
              ${step.durationMs} ms
            </span>
          </div>
        </div>
        <p class="text-xs text-slate-300 leading-relaxed pl-8">
          ${escapeHtml(step.summary)}
        </p>
        <div class="pl-8">
          ${detailsHtml}
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('modal-representation').classList.remove('hidden');
  document.getElementById('modal-representation').classList.add('flex');
  if (window.lucide) lucide.createIcons();
}

function closeRepresentationModal() {
  document.getElementById('modal-representation').classList.add('hidden');
  document.getElementById('modal-representation').classList.remove('flex');
}

function createDefaultTraceForBot(bot) {
  const isRag = bot.type === 'rag';
  return {
    botName: bot.name,
    botType: bot.type,
    provider: bot.provider,
    model: bot.model,
    totalDurationMs: 420,
    totalTokens: 185,
    promptTokens: 110,
    completionTokens: 75,
    steps: [
      {
        stepNumber: 1,
        title: '1. Entrada y Registro en SQLite',
        durationMs: 8,
        summary: 'Mensaje del usuario recibido, tokenizado aproximadamente y registrado en la tabla messages de SQLite.',
        details: { database: 'SQLite (database/bot.db)', table: 'messages', action: 'INSERT INTO messages' }
      },
      {
        stepNumber: 2,
        title: '2. Consulta de Memoria Conversacional (SQLite)',
        durationMs: 12,
        summary: 'Se consultó SQLite para recuperar los mensajes previos de la sesión y preservar el hilo del diálogo.',
        details: { action: 'SELECT role, content FROM messages WHERE conversation_id = ?' }
      },
      {
        stepNumber: 3,
        title: isRag ? '3. Búsqueda Vectorial RAG (OpenAI Embeddings)' : '3. Memoria de Texto Simple (Sin Embeddings)',
        durationMs: isRag ? 140 : 2,
        summary: isRag 
          ? 'Vectorización de la pregunta con OpenAI (text-embedding-3-small) y búsqueda de fragmentos con mayor similitud de coseno en SQLite.'
          : 'Modo Memoria Simple: Se omite la generación de embeddings y se utiliza el texto del historial directamente.',
        details: isRag 
          ? { model: 'text-embedding-3-small', dims: 1536, metric: 'Cosine Similarity', vectorTable: 'knowledge_embeddings' }
          : { mode: 'simple_conversational_text' }
      },
      {
        stepNumber: 4,
        title: '4. Ensamblado del Contexto e Identidad',
        durationMs: 5,
        summary: `Se combinaron las instrucciones maestras de identidad (${bot.name}), el contexto de memoria y el historial.`,
        details: { botIdentity: bot.name, role: bot.role }
      },
      {
        stepNumber: 5,
        title: `5. Llamada a ${bot.provider.toUpperCase()} (${bot.model})`,
        durationMs: 245,
        summary: `Envío del prompt al endpoint de ${bot.provider.toUpperCase()}. Se recibieron los tokens generados de vuelta.`,
        details: { provider: bot.provider, model: bot.model, promptTokens: 110, completionTokens: 75, totalTokens: 185 }
      },
      {
        stepNumber: 6,
        title: '6. Guardado de Respuesta en SQLite',
        durationMs: 10,
        summary: 'Respuesta persistida en SQLite con metadatos de contexto para auditoría continua.',
        details: { table: 'messages', saved: true }
      }
    ]
  };
}

/* ========================================================
   HELPERS Y UTILIDADES
======================================================== */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.innerText = str;
  return div.innerHTML;
}

function formatTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}
