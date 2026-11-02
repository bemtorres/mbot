import { randomUUID } from 'node:crypto';
import db from '../../database/db.js';
import { LLMService } from './llmService.js';
import { EmbeddingService } from './embeddingService.js';
import { VectorService } from './vectorService.js';
import { SettingsService } from './settingsService.js';

export class BotService {
  /**
   * Obtiene todos los perfiles de bots
   */
  static getAllBots() {
    return db.prepare(`
      SELECT 
        b.*,
        (SELECT COUNT(*) FROM conversations WHERE bot_id = b.id) as conversation_count,
        (SELECT COUNT(*) FROM knowledge_documents WHERE bot_id = b.id) as document_count,
        (SELECT COUNT(*) FROM knowledge_embeddings WHERE bot_id = b.id) as embedding_count
      FROM bots b
      ORDER BY b.created_at ASC
    `).all();
  }

  /**
   * Obtiene un bot por ID
   */
  static getBotById(id) {
    return db.prepare('SELECT * FROM bots WHERE id = ?').get(id);
  }

  /**
   * Crea un nuevo bot con identidad personalizada
   */
  static createBot({ name, avatar, role, type, provider, model, system_prompt, temperature }) {
    const id = `bot-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const botType = type === 'rag' ? 'rag' : 'simple';
    const botProvider = provider === 'deepseek' ? 'deepseek' : 'openai';
    const botModel = model || (botProvider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');
    const botAvatar = avatar || (botType === 'rag' ? '🧠' : '🤖');

    const stmt = db.prepare(`
      INSERT INTO bots (id, name, avatar, role, type, provider, model, system_prompt, temperature)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      name.trim(),
      botAvatar,
      role ? role.trim() : 'Asistente Personalizado',
      botType,
      botProvider,
      botModel,
      system_prompt.trim(),
      Number(temperature) || 0.7
    );

    // Crear conversación inicial
    const convId = `conv-${randomUUID()}`;
    db.prepare(`
      INSERT INTO conversations (id, bot_id, title)
      VALUES (?, ?, ?)
    `).run(convId, id, `Conversación con ${name.trim()}`);

    // Mensaje de bienvenida inicial
    db.prepare(`
      INSERT INTO messages (id, conversation_id, bot_id, role, content)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      `msg-${randomUUID()}`,
      convId,
      id,
      'assistant',
      `¡Hola! Soy **${name.trim()}** (${role || 'Asistente'}). Mi memoria es de tipo **${botType === 'rag' ? 'RAG con Embeddings' : 'Historial de Texto Simple'}**. ¿En qué puedo ayudarte hoy?`
    );

    return this.getBotById(id);
  }

  /**
   * Actualiza el perfil e identidad de un bot
   */
  static updateBot(id, data) {
    const existing = this.getBotById(id);
    if (!existing) {
      throw new Error(`Bot con ID ${id} no encontrado.`);
    }

    const name = data.name !== undefined ? data.name.trim() : existing.name;
    const avatar = data.avatar !== undefined ? data.avatar.trim() : existing.avatar;
    const role = data.role !== undefined ? data.role.trim() : existing.role;
    const type = data.type !== undefined ? (data.type === 'rag' ? 'rag' : 'simple') : existing.type;
    const provider = data.provider !== undefined ? (data.provider === 'deepseek' ? 'deepseek' : 'openai') : existing.provider;
    const model = data.model !== undefined ? data.model.trim() : existing.model;
    const system_prompt = data.system_prompt !== undefined ? data.system_prompt.trim() : existing.system_prompt;
    const temperature = data.temperature !== undefined ? Number(data.temperature) : existing.temperature;

    db.prepare(`
      UPDATE bots SET
        name = ?,
        avatar = ?,
        role = ?,
        type = ?,
        provider = ?,
        model = ?,
        system_prompt = ?,
        temperature = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, avatar, role, type, provider, model, system_prompt, temperature, id);

    return this.getBotById(id);
  }

  /**
   * Elimina un bot y sus datos asociados (en cascada)
   */
  static deleteBot(id) {
    const existing = this.getBotById(id);
    if (!existing) {
      throw new Error(`Bot con ID ${id} no encontrado.`);
    }
    db.prepare('DELETE FROM bots WHERE id = ?').run(id);
    return { success: true, id };
  }

  /**
   * Obtiene o crea una conversación activa para un bot
   */
  static getOrCreateConversation(botId) {
    let conv = db.prepare('SELECT * FROM conversations WHERE bot_id = ? ORDER BY created_at DESC LIMIT 1').get(botId);
    if (!conv) {
      const convId = `conv-${randomUUID()}`;
      db.prepare(`
        INSERT INTO conversations (id, bot_id, title)
        VALUES (?, ?, 'Nueva conversación')
      `).run(convId, botId);
      conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
    }
    return conv;
  }

  /**
   * Obtiene las conversaciones de un bot
   */
  static getConversations(botId) {
    return db.prepare(`
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
      FROM conversations c
      WHERE c.bot_id = ?
      ORDER BY c.created_at DESC
    `).all(botId);
  }

  /**
   * Obtiene los mensajes de una conversación
   */
  static getMessages(conversationId) {
    const msgs = db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(conversationId);

    return msgs.map(m => {
      let contextUsed = null;
      if (m.context_used) {
        try {
          contextUsed = JSON.parse(m.context_used);
        } catch {
          contextUsed = null;
        }
      }
      return {
        ...m,
        context_used: contextUsed
      };
    });
  }

  /**
   * Limpia el historial de una conversación
   */
  static clearConversation(conversationId) {
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
    if (!conv) throw new Error('Conversación no encontrada');

    db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversationId);
    
    // Añadir mensaje de reinicio
    const bot = this.getBotById(conv.bot_id);
    if (bot) {
      db.prepare(`
        INSERT INTO messages (id, conversation_id, bot_id, role, content)
        VALUES (?, ?, ?, 'assistant', ?)
      `).run(
        `msg-${randomUUID()}`,
        conversationId,
        bot.id,
        `Memoria de conversación limpiada. ¡Comencemos de nuevo! Soy **${bot.name}**.`
      );
    }

    return { success: true };
  }

  /**
   * PROCESAMIENTO PRINCIPAL DE MENSAJE:
   * Maneja tanto Bot 1 (Memoria Simple) como Bot 2 (Memoria RAG con Embeddings)
   */
  static async processChatMessage({ botId, conversationId, userMessage }) {
    if (!userMessage || !userMessage.trim()) {
      throw new Error('El mensaje no puede estar vacío');
    }

    const bot = this.getBotById(botId);
    if (!bot) {
      throw new Error(`Bot con ID ${botId} no encontrado`);
    }

    let conversation = conversationId 
      ? db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId)
      : this.getOrCreateConversation(botId);

    if (!conversation) {
      conversation = this.getOrCreateConversation(botId);
    }

    const totalStartTime = Date.now();
    const traceSteps = [];

    // Paso 1: Entrada y guardado del mensaje en SQLite
    const step1Start = Date.now();
    const userMsgId = `msg-${randomUUID()}`;
    db.prepare(`
      INSERT INTO messages (id, conversation_id, bot_id, role, content)
      VALUES (?, ?, ?, 'user', ?)
    `).run(userMsgId, conversation.id, bot.id, userMessage.trim());
    const step1Duration = Date.now() - step1Start;

    traceSteps.push({
      stepNumber: 1,
      id: 'step_input_sqlite',
      title: '1. Entrada y Registro en SQLite',
      icon: 'message-square',
      status: 'completed',
      durationMs: step1Duration,
      summary: `Mensaje recibido (${userMessage.trim().length} caracteres, ~${Math.ceil(userMessage.trim().length / 4)} tokens) y guardado en tabla 'messages'.`,
      details: {
        messageId: userMsgId,
        charCount: userMessage.trim().length,
        estimatedTokens: Math.ceil(userMessage.trim().length / 4),
        database: 'SQLite (database/bot.db)',
        table: 'messages'
      }
    });

    // Paso 2: Recuperación de memoria conversacional en SQLite
    const step2Start = Date.now();
    const previousMessages = db.prepare(`
      SELECT role, content FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(conversation.id);

    const recentHistory = previousMessages.slice(-16).map(m => ({
      role: m.role,
      content: m.content
    }));
    const step2Duration = Date.now() - step2Start;

    traceSteps.push({
      stepNumber: 2,
      id: 'step_history_sqlite',
      title: '2. Consulta de Memoria Conversacional (SQLite)',
      icon: 'database',
      status: 'completed',
      durationMs: step2Duration,
      summary: `Recuperados ${recentHistory.length} mensajes previos de SQLite para mantener el hilo contextual.`,
      details: {
        conversationId: conversation.id,
        totalHistoricalMessages: previousMessages.length,
        contextWindowTurns: recentHistory.length,
        sqliteQuery: 'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
      }
    });

    // Paso 3: Memoria RAG y Búsqueda Vectorial (OpenAI Embeddings)
    const step3Start = Date.now();
    let retrievedChunks = [];
    let systemInstruction = bot.system_prompt;
    let ragDetails = {
      isRag: bot.type === 'rag',
      chunksRetrieved: 0,
      embeddingModel: 'N/A'
    };

    if (bot.type === 'rag') {
      try {
        const openAiKey = SettingsService.get('OPENAI_API_KEY');
        if (openAiKey) {
          ragDetails.embeddingModel = 'OpenAI text-embedding-3-small (1536 dims)';
          // Generar embedding con OpenAI para la consulta del usuario
          const { embedding } = await EmbeddingService.generateEmbedding(userMessage.trim());
          // Buscar fragmentos más similares en SQLite
          retrievedChunks = VectorService.searchSimilarChunks(bot.id, embedding, 3, 0.25);
        } else {
          ragDetails.embeddingModel = 'Modo Simulación RAG (búsqueda de términos)';
          retrievedChunks = this.searchKeywordChunks(bot.id, userMessage.trim(), 2);
        }

        ragDetails.chunksRetrieved = retrievedChunks.length;
        ragDetails.matchedSources = retrievedChunks.map(c => ({
          document: c.doc_title,
          similarityScore: (c.similarity * 100).toFixed(1) + '%',
          chunkIndex: c.chunk_index
        }));

        if (retrievedChunks.length > 0) {
          const contextBlocks = retrievedChunks.map((c, i) => 
            `[Fragmento #${i + 1} de "${c.doc_title}"] (Similitud: ${(c.similarity * 100).toFixed(1)}%):\n${c.chunk_text}`
          ).join('\n\n');

          systemInstruction += `\n\n--- FRAGMENTOS DE CONOCIMIENTO RECUPERADOS DE LA MEMORIA RAG ---\n${contextBlocks}\n--- FIN DE FRAGMENTOS ---\n\nInstrucción de memoria: Utiliza los fragmentos anteriores para enriquecer tu respuesta si son relevantes. Menciona o cita los datos específicos para dar mayor precisión y autoridad a tu respuesta.`;
        }
      } catch (embErr) {
        console.warn('Advertencia en recuperación RAG:', embErr.message);
        ragDetails.error = embErr.message;
      }
    }
    const step3Duration = Date.now() - step3Start;

    traceSteps.push({
      stepNumber: 3,
      id: 'step_rag_embeddings',
      title: bot.type === 'rag' ? '3. Búsqueda Vectorial RAG (OpenAI Embeddings)' : '3. Memoria de Texto Simple (Sin Embeddings)',
      icon: 'brain',
      status: 'completed',
      durationMs: step3Duration,
      summary: bot.type === 'rag' 
        ? (retrievedChunks.length > 0
            ? `Se vectorizó la consulta con OpenAI y se encontraron ${retrievedChunks.length} fragmentos relevantes mediante Similitud de Coseno en SQLite.`
            : `Se vectorizó con OpenAI pero no se hallaron fragmentos con similitud superior al umbral.`)
        : `Bot tipo Simple: Se omite búsqueda de embeddings. Se apoya exclusivamente en el contexto directo de SQLite.`,
      details: ragDetails
    });

    // Paso 4: Ensamblado del Prompt e Identidad
    const step4Start = Date.now();
    const promptMessages = [
      { role: 'system', content: systemInstruction },
      ...recentHistory
    ];
    const totalPromptChars = promptMessages.reduce((acc, m) => acc + (m.content ? m.content.length : 0), 0);
    const approxPromptTokens = Math.ceil(totalPromptChars / 4);
    const step4Duration = Date.now() - step4Start;

    traceSteps.push({
      stepNumber: 4,
      id: 'step_prompt_assembly',
      title: '4. Ensamblado del Prompt e Identidad',
      icon: 'layers',
      status: 'completed',
      durationMs: step4Duration,
      summary: `Se combinó la identidad de ${bot.name}, el contexto y el historial en ${promptMessages.length} bloques de conversación (~${approxPromptTokens} tokens estimados).`,
      details: {
        botName: bot.name,
        systemPromptLength: bot.system_prompt.length,
        totalBlocks: promptMessages.length,
        totalPromptChars,
        approxPromptTokens,
        ragContextAttached: retrievedChunks.length > 0
      }
    });

    // Paso 5: Solicitud al Modelo de Lenguaje (OpenAI o DeepSeek)
    const step5Start = Date.now();
    const completion = await LLMService.chatCompletion({
      provider: bot.provider,
      model: bot.model,
      messages: promptMessages,
      temperature: bot.temperature
    });
    const step5Duration = completion.latencyMs || (Date.now() - step5Start);

    traceSteps.push({
      stepNumber: 5,
      id: 'step_llm_call',
      title: `5. Llamada a ${completion.provider.toUpperCase()} (${completion.model})`,
      icon: 'cpu',
      status: 'completed',
      durationMs: step5Duration,
      summary: `Llamada completada a ${completion.provider.toUpperCase()}. Tokens enviados: ${completion.usage?.prompt_tokens || 0}. Tokens devueltos: ${completion.usage?.completion_tokens || 0}.`,
      details: {
        provider: completion.provider,
        model: completion.model,
        temperature: bot.temperature,
        promptTokens: completion.usage?.prompt_tokens || approxPromptTokens,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
        networkLatencyMs: step5Duration
      }
    });

    // Paso 6: Persistencia de la Respuesta en SQLite
    const step6Start = Date.now();
    const assistantMsgId = `msg-${randomUUID()}`;
    const contextJson = retrievedChunks.length > 0 ? JSON.stringify(retrievedChunks) : null;

    db.prepare(`
      INSERT INTO messages (id, conversation_id, bot_id, role, content, context_used)
      VALUES (?, ?, ?, 'assistant', ?, ?)
    `).run(assistantMsgId, conversation.id, bot.id, completion.content, contextJson);

    // Actualizar título de la conversación si es el primer intercambio
    if (previousMessages.length <= 2) {
      const summaryTitle = userMessage.trim().substring(0, 35) + (userMessage.length > 35 ? '...' : '');
      db.prepare('UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(summaryTitle, conversation.id);
    }
    const step6Duration = Date.now() - step6Start;

    traceSteps.push({
      stepNumber: 6,
      id: 'step_persistence',
      title: '6. Guardado de Respuesta en SQLite',
      icon: 'check-circle-2',
      status: 'completed',
      durationMs: step6Duration,
      summary: `Respuesta de ${completion.content.length} caracteres guardada en SQLite con trazabilidad de contexto.`,
      details: {
        assistantMessageId: assistantMsgId,
        charCount: completion.content.length,
        contextSavedInDb: Boolean(contextJson)
      }
    });

    const totalDuration = Date.now() - totalStartTime;

    const executionTrace = {
      timestamp: new Date().toISOString(),
      botName: bot.name,
      botType: bot.type,
      provider: completion.provider,
      model: completion.model,
      totalDurationMs: totalDuration,
      totalTokens: completion.usage?.total_tokens || 0,
      promptTokens: completion.usage?.prompt_tokens || approxPromptTokens,
      completionTokens: completion.usage?.completion_tokens || 0,
      steps: traceSteps
    };

    return {
      messageId: assistantMsgId,
      conversationId: conversation.id,
      reply: completion.content,
      model: completion.model,
      provider: completion.provider,
      botType: bot.type,
      sourcesUsed: retrievedChunks,
      historyCount: previousMessages.length + 1,
      trace: executionTrace
    };
  }

  /**
   * Búsqueda de respaldo por palabras clave si no hay clave OpenAI configurada
   */
  static searchKeywordChunks(botId, query, limit = 2) {
    const terms = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (terms.length === 0) return [];

    const rows = db.prepare(`
      SELECT 
        e.id, e.chunk_text, e.chunk_index, d.title as doc_title
      FROM knowledge_embeddings e
      JOIN knowledge_documents d ON e.doc_id = d.id
      WHERE e.bot_id = ?
    `).all(botId);

    const matches = [];
    for (const row of rows) {
      const lower = row.chunk_text.toLowerCase();
      let matchCount = 0;
      for (const t of terms) {
        if (lower.includes(t)) matchCount++;
      }
      if (matchCount > 0) {
        matches.push({
          id: row.id,
          chunk_text: row.chunk_text,
          chunk_index: row.chunk_index,
          doc_title: row.doc_title,
          similarity: Number((0.5 + (matchCount / (terms.length * 2))).toFixed(2))
        });
      }
    }

    matches.sort((a, b) => b.similarity - a.similarity);
    return matches.slice(0, limit);
  }
}
