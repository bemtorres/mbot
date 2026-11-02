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
};

// Inicialización al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();
  await loadSettingsStatus();
  await loadBots();
});

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
      ? 'bg-purple-500/10 text-purple-300 border-purple-500/20' 
      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';

    const memoryLabel = isRag ? '🧠 RAG Embeddings' : '📝 Memoria Simple';
    const providerLabel = bot.provider === 'deepseek' ? 'DeepSeek' : 'OpenAI';

    return `
      <div 
        onclick="selectBot('${bot.id}')"
        class="group p-3 rounded-xl cursor-pointer transition border ${
          isActive 
            ? 'bg-slate-800/90 border-indigo-500 shadow-md shadow-indigo-500/10' 
            : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
        }"
      >
        <div class="flex items-start gap-3">
          <div class="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-lg shrink-0">
            ${bot.avatar || '🤖'}
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1">
              <h4 class="font-bold text-sm text-white truncate ${isActive ? 'text-indigo-300' : ''}">
                ${escapeHtml(bot.name)}
              </h4>
              <span class="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase bg-slate-800/80 text-slate-400 border border-slate-700/60 shrink-0">
                ${providerLabel}
              </span>
            </div>

            <p class="text-xs text-slate-400 truncate mt-0.5">${escapeHtml(bot.role || 'Asistente')}</p>

            <div class="flex items-center gap-1.5 mt-2 flex-wrap">
              <span class="text-[10px] px-2 py-0.5 rounded-full border font-medium ${memoryBadgeClass}">
                ${memoryLabel}
              </span>
              ${isRag ? `
                <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  ${bot.document_count || 0} doc${bot.document_count === 1 ? '' : 's'}
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
    typeBadge.className = 'text-[11px] px-2 py-0.5 rounded-full font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20';
    typeBadge.innerText = 'Memoria RAG (Embeddings)';
  } else {
    typeBadge.className = 'text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    typeBadge.innerText = 'Memoria de Texto Simple (SQLite)';
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
      <div class="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
        <div class="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-center text-3xl mb-3 shadow-inner">
          ${state.activeBot ? state.activeBot.avatar : '🤖'}
        </div>
        <h4 class="text-base font-bold text-white mb-1">¡Inicia la conversación con ${escapeHtml(state.activeBot?.name || 'el bot')}!</h4>
        <p class="text-xs text-slate-400 max-w-md">
          ${state.activeBot?.type === 'rag' 
            ? 'Este bot cuenta con memoria aumentada por Embeddings de OpenAI y búsqueda semántica en SQLite.'
            : 'Este bot cuenta con memoria conversacional de texto simple guardada directamente en SQLite.'}
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
        <div class="p-2.5 rounded-lg bg-slate-900/90 border border-purple-500/20 text-xs mt-1.5">
          <div class="flex items-center justify-between text-[11px] text-purple-300 font-semibold mb-1">
            <span>📄 ${escapeHtml(src.doc_title || 'Documento')} (Fragmento #${src.chunk_index + 1})</span>
            <span class="bg-purple-900/40 px-1.5 py-0.5 rounded border border-purple-500/30 font-mono text-[10px]">
              Similitud: ${(src.similarity * 100).toFixed(1)}%
            </span>
          </div>
          <p class="text-slate-300 font-mono text-[11px] leading-relaxed">${escapeHtml(src.chunk_text)}</p>
        </div>
      `).join('');

      sourcesHtml = `
        <details class="mt-2 text-xs group">
          <summary class="cursor-pointer select-none inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 hover:bg-purple-500/20 transition text-[11px] font-medium">
            <i data-lucide="brain" class="w-3.5 h-3.5"></i>
            <span>🧠 ${msg.context_used.length} fragmento${msg.context_used.length === 1 ? '' : 's'} de memoria RAG recuperado${msg.context_used.length === 1 ? '' : 's'}</span>
          </summary>
          <div class="space-y-1.5 mt-2 pl-1 border-l-2 border-purple-500/40">
            ${snippets}
          </div>
        </details>
      `;
    }

    if (isUser) {
      return `
        <div class="flex justify-end">
          <div class="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-sm bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 py-3 shadow-md shadow-indigo-600/15">
            <div class="text-xs font-semibold text-indigo-200 mb-0.5 flex items-center justify-end gap-1">
              <span>Tú</span>
            </div>
            <div class="text-sm leading-relaxed whitespace-pre-wrap">${escapeHtml(msg.content)}</div>
            <div class="text-[10px] text-indigo-300/80 text-right mt-1">
              ${formatTime(msg.created_at)}
            </div>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-base shrink-0 shadow-sm mt-0.5">
            ${state.activeBot ? state.activeBot.avatar : '🤖'}
          </div>
          <div class="max-w-[90%] sm:max-w-[80%] rounded-2xl rounded-tl-sm bg-slate-900/80 border border-slate-800 text-slate-100 px-4 py-3 shadow-md">
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="text-xs font-bold text-indigo-300">${escapeHtml(state.activeBot?.name || 'Bot')}</span>
              <span class="text-[10px] text-slate-500 font-mono">${formatTime(msg.created_at)}</span>
            </div>
            <div class="prose-chat text-sm leading-relaxed">${parsedContent}</div>
            ${sourcesHtml}
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

  // Mostrar indicador de escritura del bot
  appendTypingIndicator();

  try {
    const res = await API.sendMessage(state.activeBot.id, state.activeConversation.id, text);
    removeTypingIndicator();

    if (res.success) {
      const assistantMsg = {
        id: res.data.messageId,
        role: 'assistant',
        content: res.data.reply,
        context_used: res.data.sourcesUsed || null,
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
  typingDiv.className = 'flex items-start gap-3';
  typingDiv.innerHTML = `
    <div class="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-base shrink-0 mt-0.5">
      ${state.activeBot ? state.activeBot.avatar : '🤖'}
    </div>
    <div class="rounded-2xl rounded-tl-sm bg-slate-900/80 border border-slate-800 px-4 py-3 flex items-center gap-1.5">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <span class="text-xs text-slate-400 ml-1.5 font-mono">
        ${state.activeBot?.type === 'rag' ? 'Consultando memoria RAG...' : 'Pensando...'}
      </span>
    </div>
  `;
  container.appendChild(typingDiv);
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
