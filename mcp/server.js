#!/usr/bin/env node
/**
 * Servidor MCP (Model Context Protocol) para MBot Studio
 * 
 * Permite a cualquier agente LLM (Cursor, Claude Desktop, Antigravity, etc.)
 * crear, gestionar, buscar, alimentar conocimiento RAG y chatear con bots
 * de manera programática mediante herramientas estandarizadas.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import db, { initDatabase } from '../database/db.js';
import { BotService } from '../src/services/botService.js';
import { KnowledgeService } from '../src/services/knowledgeService.js';
import { SettingsService } from '../src/services/settingsService.js';

// Asegurar que la base de datos SQLite esté lista
initDatabase();

// Inicializar el servidor MCP
const server = new McpServer({
  name: 'mbot-studio-mcp',
  version: '1.0.0'
});

// ============================================================================
// 1. HERRAMIENTAS DE GESTIÓN DE BOTS / PERSONAJES (CRUD)
// ============================================================================

/**
 * create_bot: Crea un nuevo bot con perfil e identidad completos
 */
server.tool(
  'create_bot',
  'Crea un nuevo personaje o bot en el sistema MBot con identidad propia, tipo de memoria (simple o RAG), proveedor LLM (OpenAI o DeepSeek), modelo, temperatura y system prompt.',
  {
    name: z.string().describe('Nombre del personaje o bot (ej: Nikola Tesla, Don Quijote, Asistente DevOps)'),
    avatar: z.string().optional().describe('Emoji o avatar representativo (ej: ⚡, 🛡️, 🤖, 🧠, 👩‍🔬) [default: 🤖]'),
    role: z.string().optional().describe('Rol, profesión o especialidad del personaje (ej: Científico e Inventor) [default: Asistente]'),
    type: z.enum(['simple', 'rag']).describe("Tipo de arquitectura de memoria: 'simple' para historial conversacional directo en SQLite, 'rag' para memoria vectorial con embeddings de OpenAI"),
    provider: z.enum(['openai', 'deepseek']).describe("Proveedor de modelo de lenguaje: 'openai' o 'deepseek'"),
    model: z.string().optional().describe("Modelo de lenguaje a utilizar (ej: 'gpt-4o-mini', 'gpt-4o', 'deepseek-chat', 'deepseek-reasoner')"),
    temperature: z.number().min(0).max(1).optional().describe('Temperatura del modelo (0.0 para respuestas muy precisas a 1.0 para respuestas muy creativas) [default: 0.7]'),
    system_prompt: z.string().describe('Instrucciones de identidad del personaje (cómo debe pensar, hablar, tono, personalidad y directivas)')
  },
  async ({ name, avatar, role, type, provider, model, temperature, system_prompt }) => {
    try {
      const newBot = BotService.createBot({
        name,
        avatar: avatar || (type === 'rag' ? '🧠' : '🤖'),
        role: role || 'Asistente Personalizado',
        type,
        provider,
        model: model || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini'),
        temperature: temperature !== undefined ? temperature : 0.7,
        system_prompt
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Bot '${newBot.name}' creado exitosamente en SQLite.`,
              bot: newBot
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error al crear el bot: ${err.message}` }]
      };
    }
  }
);

/**
 * list_bots: Lista todos los bots registrados
 */
server.tool(
  'list_bots',
  'Lista todos los personajes y bots registrados en MBot Studio, mostrando su ID, nombre, avatar, rol, tipo de memoria, proveedor, modelo, cantidad de documentos y conversaciones.',
  {},
  async () => {
    try {
      const bots = BotService.getAllBots();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              total: bots.length,
              bots: bots.map(b => ({
                id: b.id,
                name: b.name,
                avatar: b.avatar,
                role: b.role,
                type: b.type,
                provider: b.provider,
                model: b.model,
                temperature: b.temperature,
                conversations: b.conversation_count,
                knowledge_documents: b.document_count,
                knowledge_embeddings: b.embedding_count,
                created_at: b.created_at
              }))
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error al listar bots: ${err.message}` }]
      };
    }
  }
);

/**
 * get_bot: Obtiene los detalles completos de un bot
 */
server.tool(
  'get_bot',
  'Obtiene los detalles completos de un bot específico por su ID (incluyendo su System Prompt completo, parámetros y estadísticas).',
  {
    bot_id: z.string().describe('El ID del bot (ej: bot-alex, bot-sophia, etc.)')
  },
  async ({ bot_id }) => {
    try {
      const bot = BotService.getBotById(bot_id);
      if (!bot) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Bot con ID '${bot_id}' no encontrado.` }]
        };
      }

      const docs = KnowledgeService.getDocuments(bot_id);
      const convs = BotService.getConversations(bot_id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              bot,
              knowledge_documents_count: docs.length,
              conversations_count: convs.length
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error al obtener bot: ${err.message}` }]
      };
    }
  }
);

/**
 * update_bot: Actualiza propiedades o System Prompt de un bot
 */
server.tool(
  'update_bot',
  'Actualiza los atributos o el System Prompt de un personaje o bot existente.',
  {
    bot_id: z.string().describe('El ID del bot a modificar'),
    name: z.string().optional().describe('Nuevo nombre del bot'),
    avatar: z.string().optional().describe('Nuevo emoji o avatar'),
    role: z.string().optional().describe('Nuevo rol o profesión'),
    type: z.enum(['simple', 'rag']).optional().describe("Nuevo tipo de memoria: 'simple' o 'rag'"),
    provider: z.enum(['openai', 'deepseek']).optional().describe("Nuevo proveedor: 'openai' o 'deepseek'"),
    model: z.string().optional().describe('Nuevo modelo'),
    temperature: z.number().min(0).max(1).optional().describe('Nueva temperatura (0.0 a 1.0)'),
    system_prompt: z.string().optional().describe('Nuevo System Prompt / Instrucciones de identidad')
  },
  async ({ bot_id, ...data }) => {
    try {
      const updatedBot = BotService.updateBot(bot_id, data);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Bot '${updatedBot.name}' actualizado con éxito.`,
              bot: updatedBot
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error al actualizar bot: ${err.message}` }]
      };
    }
  }
);

/**
 * delete_bot: Elimina un bot y sus datos asociados
 */
server.tool(
  'delete_bot',
  'Elimina permanentemente un bot y todos sus datos relacionados (conversaciones, mensajes, documentos de conocimiento y embeddings en SQLite).',
  {
    bot_id: z.string().describe('El ID del bot a eliminar')
  },
  async ({ bot_id }) => {
    try {
      const result = BotService.deleteBot(bot_id);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Bot '${bot_id}' y todos sus datos en SQLite fueron eliminados correctamente.`,
              result
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error al eliminar bot: ${err.message}` }]
      };
    }
  }
);

// ============================================================================
// 2. HERRAMIENTAS DE CONOCIMIENTO Y RAG (VECTOR EMBEDDINGS)
// ============================================================================

/**
 * add_knowledge_document: Agrega y fragmenta texto con embeddings OpenAI
 */
server.tool(
  'add_knowledge_document',
  'Agrega un documento o texto de conocimiento a un bot (ideal para bots RAG). El sistema fragmenta automáticamente el texto en chunks y genera los embeddings vectoriales con OpenAI text-embedding-3-small para indexarlos en SQLite.',
  {
    bot_id: z.string().describe('ID del bot al que se asociará este conocimiento'),
    title: z.string().describe('Título o tema descriptivo del documento'),
    content: z.string().describe('Texto completo o contenido a indexar en la memoria vectorial')
  },
  async ({ bot_id, title, content }) => {
    try {
      const bot = BotService.getBotById(bot_id);
      if (!bot) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Bot con ID '${bot_id}' no encontrado.` }]
        };
      }

      const result = await KnowledgeService.addDocument({
        botId: bot_id,
        title,
        content
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              document: result
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error al agregar conocimiento: ${err.message}` }]
      };
    }
  }
);

/**
 * list_knowledge_documents: Lista los documentos indexados de un bot
 */
server.tool(
  'list_knowledge_documents',
  'Lista todos los documentos de conocimiento indexados para un bot específico, con su cantidad de fragmentos (chunks) y fecha de creación.',
  {
    bot_id: z.string().describe('ID del bot a consultar')
  },
  async ({ bot_id }) => {
    try {
      const docs = KnowledgeService.getDocuments(bot_id);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              bot_id,
              total_documents: docs.length,
              documents: docs
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error al listar documentos de conocimiento: ${err.message}` }]
      };
    }
  }
);

/**
 * get_knowledge_document: Obtiene el contenido de un documento específico
 */
server.tool(
  'get_knowledge_document',
  'Obtiene el contenido completo y detalles de un documento de conocimiento por su ID.',
  {
    document_id: z.string().describe('ID del documento de conocimiento')
  },
  async ({ document_id }) => {
    try {
      const doc = db.prepare('SELECT * FROM knowledge_documents WHERE id = ?').get(document_id);
      if (!doc) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Documento con ID '${document_id}' no encontrado.` }]
        };
      }

      const chunks = db.prepare('SELECT chunk_index, chunk_text, token_count FROM knowledge_embeddings WHERE doc_id = ? ORDER BY chunk_index ASC').all(document_id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              document: doc,
              chunks_count: chunks.length,
              chunks
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error al obtener documento: ${err.message}` }]
      };
    }
  }
);

/**
 * delete_knowledge_document: Elimina un documento y sus embeddings
 */
server.tool(
  'delete_knowledge_document',
  'Elimina un documento de conocimiento y todos sus vectores embeddings asociados de la base de datos SQLite.',
  {
    document_id: z.string().describe('ID del documento a eliminar')
  },
  async ({ document_id }) => {
    try {
      const result = KnowledgeService.deleteDocument(document_id);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Documento de conocimiento '${document_id}' y sus vectores eliminados.`,
              result
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error al eliminar documento: ${err.message}` }]
      };
    }
  }
);

/**
 * test_semantic_search: Realiza una búsqueda semántica de similitud de coseno
 */
server.tool(
  'test_semantic_search',
  'Ejecuta una prueba de búsqueda semántica vectorial en tiempo real contra los documentos indexados de un bot, calculando similitud de coseno con embeddings de OpenAI.',
  {
    bot_id: z.string().describe('ID del bot con memoria RAG'),
    query: z.string().describe('Pregunta o texto de consulta para evaluar similitud semántica')
  },
  async ({ bot_id, query }) => {
    try {
      const searchResult = await KnowledgeService.testSearch({
        botId: bot_id,
        query
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(searchResult, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error en búsqueda semántica: ${err.message}` }]
      };
    }
  }
);

// ============================================================================
// 3. HERRAMIENTAS DE CHAT, MEMORIA Y EJECUCIÓN
// ============================================================================

/**
 * chat_with_bot: Envía un mensaje y obtiene respuesta con memoria y traza
 */
server.tool(
  'chat_with_bot',
  'Envía un mensaje para chatear con un bot. Si el bot tiene memoria Simple, recupera el historial de conversación en SQLite. Si tiene memoria RAG, busca fragmentos semánticos relevantes mediante embeddings, construye el contexto y consulta al modelo de lenguaje (OpenAI o DeepSeek). Guarda la interacción y devuelve la respuesta junto con el desglose de ejecución (tokens, latencia, fuentes usadas).',
  {
    bot_id: z.string().describe('ID del bot con el que se desea chatear'),
    message: z.string().describe('Mensaje o pregunta del usuario'),
    conversation_id: z.string().optional().describe('ID de conversación existente (si se omite, se utiliza o crea automáticamente la conversación activa del bot)')
  },
  async ({ bot_id, message, conversation_id }) => {
    try {
      const bot = BotService.getBotById(bot_id);
      if (!bot) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Bot con ID '${bot_id}' no encontrado.` }]
        };
      }

      let activeConvId = conversation_id;
      if (!activeConvId) {
        const conv = BotService.getOrCreateConversation(bot_id);
        activeConvId = conv.id;
      }

      const chatResponse = await BotService.processChatMessage({
        botId: bot_id,
        conversationId: activeConvId,
        userMessage: message
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              bot_name: bot.name,
              bot_type: bot.type,
              conversation_id: activeConvId,
              assistant_response: chatResponse.assistantMessage.content,
              context_used: chatResponse.assistantMessage.context_used,
              trace: chatResponse.trace
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error al procesar mensaje con el bot: ${err.message}` }]
      };
    }
  }
);

/**
 * get_conversation_messages: Obtiene el historial de la conversación activa
 */
server.tool(
  'get_conversation_messages',
  'Recupera el historial cronológico completo de mensajes de la conversación activa de un bot.',
  {
    bot_id: z.string().describe('ID del bot a consultar')
  },
  async ({ bot_id }) => {
    try {
      const conv = BotService.getOrCreateConversation(bot_id);
      const messages = BotService.getMessages(conv.id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              bot_id,
              conversation_id: conv.id,
              total_messages: messages.length,
              messages: messages.map(m => ({
                id: m.id,
                role: m.role,
                content: m.content,
                context_used: m.context_used,
                created_at: m.created_at
              }))
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error al obtener mensajes: ${err.message}` }]
      };
    }
  }
);

/**
 * clear_conversation_memory: Limpia el historial de mensajes
 */
server.tool(
  'clear_conversation_memory',
  'Borra el historial de mensajes de la conversación activa de un bot, permitiendo reiniciar el chat desde cero manteniendo la identidad y el conocimiento RAG intactos.',
  {
    bot_id: z.string().describe('ID del bot')
  },
  async ({ bot_id }) => {
    try {
      const conv = BotService.getOrCreateConversation(bot_id);
      const result = BotService.clearConversation(conv.id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Memoria de conversación del bot '${bot_id}' limpiada exitosamente.`,
              result
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error al limpiar conversación: ${err.message}` }]
      };
    }
  }
);

// ============================================================================
// 4. HERRAMIENTAS DE ESTADO DEL SISTEMA Y AJUSTES API
// ============================================================================

/**
 * get_system_status: Retorna el estado general de MBot
 */
server.tool(
  'get_system_status',
  'Obtiene el estado general del sistema MBot: estado de claves API de OpenAI y DeepSeek (enmascaradas), modelos por defecto, total de bots, total de documentos RAG y total de fragmentos vectoriales.',
  {},
  async () => {
    try {
      const publicStatus = SettingsService.getPublicStatus();
      const stats = {
        total_bots: db.prepare('SELECT COUNT(*) as count FROM bots').get().count,
        total_documents: db.prepare('SELECT COUNT(*) as count FROM knowledge_documents').get().count,
        total_embeddings: db.prepare('SELECT COUNT(*) as count FROM knowledge_embeddings').get().count,
        total_conversations: db.prepare('SELECT COUNT(*) as count FROM conversations').get().count,
        total_messages: db.prepare('SELECT COUNT(*) as count FROM messages').get().count
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              api_keys: publicStatus,
              database_stats: stats,
              sqlite_path: 'database/bot.db'
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error al obtener estado del sistema: ${err.message}` }]
      };
    }
  }
);

/**
 * set_api_keys: Actualiza las API Keys en SQLite
 */
server.tool(
  'set_api_keys',
  'Configura o actualiza las API Keys de OpenAI o DeepSeek en la base de datos SQLite para uso inmediato por los bots y embeddings.',
  {
    openai_api_key: z.string().optional().describe('Nueva API Key de OpenAI (sk-...)'),
    deepseek_api_key: z.string().optional().describe('Nueva API Key de DeepSeek (sk-...)')
  },
  async ({ openai_api_key, deepseek_api_key }) => {
    try {
      if (openai_api_key !== undefined) {
        SettingsService.set('OPENAI_API_KEY', openai_api_key.trim());
      }
      if (deepseek_api_key !== undefined) {
        SettingsService.set('DEEPSEEK_API_KEY', deepseek_api_key.trim());
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Claves de API actualizadas correctamente en la base de datos SQLite.',
              status: SettingsService.getPublicStatus()
            }, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error al guardar claves API: ${err.message}` }]
      };
    }
  }
);

// ============================================================================
// INICIAR TRANSPORTE STDIO
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🚀 MBot Studio MCP Server corriendo sobre STDIO.');
}

main().catch((err) => {
  console.error('❌ Error fatal en el servidor MCP:', err);
  process.exit(1);
});
