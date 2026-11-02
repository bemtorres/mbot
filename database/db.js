import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDir = path.resolve(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'bot.db');
const db = new DatabaseSync(dbPath);

// Activar claves foráneas y modo WAL para mejor rendimiento y concurrencia
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

/**
 * Inicializa las tablas de SQLite y crea los bots por defecto si no existen
 */
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bots (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT NOT NULL,
      role TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('simple', 'rag')),
      provider TEXT NOT NULL CHECK (provider IN ('openai', 'deepseek')),
      model TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      temperature REAL DEFAULT 0.7,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      bot_id TEXT NOT NULL,
      title TEXT DEFAULT 'Nueva conversación',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      bot_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      context_used TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS knowledge_documents (
      id TEXT PRIMARY KEY,
      bot_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      chunk_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS knowledge_embeddings (
      id TEXT PRIMARY KEY,
      doc_id TEXT NOT NULL,
      bot_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      embedding TEXT NOT NULL,
      token_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (doc_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE,
      FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_bot_id ON conversations(bot_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_bot_id ON knowledge_embeddings(bot_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_doc_id ON knowledge_embeddings(doc_id);
  `);

  // Sembrar bots por defecto si la tabla está vacía
  seedDefaultBots();
}

function seedDefaultBots() {
  const existingBots = db.prepare('SELECT COUNT(*) as count FROM bots').get();
  if (existingBots && existingBots.count > 0) {
    return;
  }

  const insertBot = db.prepare(`
    INSERT INTO bots (id, name, avatar, role, type, provider, model, system_prompt, temperature)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Bot 1: Memoria simple de texto (historial conversacional)
  insertBot.run(
    'bot-simple-01',
    'Alex',
    '🤖',
    'Asistente Conversacional (Memoria de Texto Simple)',
    'simple',
    'openai',
    'gpt-4o-mini',
    `Eres Alex, un chatbot inteligente con una personalidad cálida, analítica y amigable. 
Tu arquitectura cuenta con una memoria conversacional directa en SQLite: recuerdas perfectamente lo que el usuario te menciona en el historial del diálogo. 
Usa este contexto para responder de forma coherente, dar seguimiento a temas anteriores y conectar ideas sin necesidad de embeddings. Mantén respuestas claras, empáticas y útiles.`,
    0.7
  );

  // Bot 2: Memoria avanzada RAG con Embeddings OpenAI
  insertBot.run(
    'bot-rag-02',
    'Sophia',
    '🧠',
    'Especialista en Conocimiento (Memoria con Embeddings RAG)',
    'rag',
    'openai',
    'gpt-4o-mini',
    `Eres Sophia, una asistente experta con memoria aumentada por recuperación de embeddings (RAG) y almacenamiento vectorial en SQLite.
Tienes acceso a una base de conocimiento documental indexada mediante vectores de OpenAI (text-embedding-3-small).
Cuando recibas fragmentos de conocimiento relevantes junto con la consulta del usuario, analiza rigurosamente los datos proporcionados y formula respuestas precisas citando tus fuentes de memoria.
Si la información no está en tu memoria, indícalo con honestidad mientras ofreces asistencia general.`,
    0.5
  );

  // Crear una conversación inicial para cada bot
  const insertConv = db.prepare(`
    INSERT INTO conversations (id, bot_id, title)
    VALUES (?, ?, ?)
  `);
  insertConv.run('conv-alex-01', 'bot-simple-01', 'Charla Inicial con Alex');
  insertConv.run('conv-sophia-01', 'bot-rag-02', 'Consulta de Base de Conocimiento');

  // Mensajes de bienvenida
  const insertMsg = db.prepare(`
    INSERT INTO messages (id, conversation_id, bot_id, role, content)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertMsg.run(
    'msg-welcome-01',
    'conv-alex-01',
    'bot-simple-01',
    'assistant',
    '¡Hola! Soy **Alex**. Cuento con una memoria conversacional en SQLite. Dime tu nombre o cuéntame cualquier dato sobre ti, y lo recordaré durante toda nuestra charla para responderte de forma contextual.'
  );

  insertMsg.run(
    'msg-welcome-02',
    'conv-sophia-01',
    'bot-rag-02',
    'assistant',
    '¡Saludos! Soy **Sophia**. Poseo una memoria extendida con **Embeddings de OpenAI** y búsqueda semántica en SQLite. Puedes agregar documentos a mi base de conocimiento y hacerme preguntas; buscaré los fragmentos más relevantes y te responderé con precisión.'
  );

  // Sembrar documento de conocimiento inicial para Sophia
  seedInitialKnowledge();
}

function seedInitialKnowledge() {
  const docCount = db.prepare('SELECT COUNT(*) as count FROM knowledge_documents WHERE bot_id = ?').get('bot-rag-02');
  if (docCount && docCount.count > 0) return;

  const docId = 'doc-seed-01';
  const title = 'Manual de Arquitectura y Memoria de MBot';
  const content = `El sistema MBot es una plataforma moderna de chatbots con perfil propio, identidad configurable y persistencia en SQLite.

ARQUITECTURA DE MEMORIA:
1. Memoria de Texto Simple: Almacena el historial conversacional directamente en SQLite. Cada vez que el usuario pregunta, el sistema recupera los últimos mensajes de la conversación y los envía como contexto junto al prompt de identidad del bot. Ideal para diálogos fluidos y seguimiento de temas.
2. Memoria Avanzada RAG con Embeddings: Para información extensa y especializada. Los documentos se dividen en fragmentos con solapamiento y se generan representaciones vectoriales (embeddings) utilizando la API de OpenAI (modelo text-embedding-3-small). Los vectores se guardan en SQLite y se indexan para recuperación rápida.

BÚSQUEDA SEMÁNTICA Y SIMILITUD DE COSENO:
Cuando el usuario envía un mensaje a un bot RAG, el sistema calcula el embedding de la pregunta mediante OpenAI. Luego ejecuta una comparación matemática mediante Similitud de Coseno contra todos los fragmentos almacenados en SQLite, extrayendo los fragmentos más relevantes para inyectarlos en el prompt del sistema.

PROVEEDORES Y MODELOS DE LENGUAJE:
- Para el chat: El sistema puede conectarse con DeepSeek (deepseek-chat, deepseek-reasoner) o con OpenAI (gpt-4o-mini, gpt-4o).
- Para los embeddings: El sistema utiliza exclusivamente OpenAI (text-embedding-3-small) por su alta precisión y eficiencia.

SEGURIDAD Y CONFIGURACIÓN:
Las API Keys de OpenAI y DeepSeek se pueden definir en el archivo .env o configurarse interactivamente desde la sección de Ajustes en la interfaz web de Tailwind CSS.`;

  db.prepare(`
    INSERT INTO knowledge_documents (id, bot_id, title, content, chunk_count)
    VALUES (?, ?, ?, ?, ?)
  `).run(docId, 'bot-rag-02', title, content, 4);

  // Chunks y embeddings iniciales
  const chunks = [
    `El sistema MBot es una plataforma moderna de chatbots con perfil propio, identidad configurable y persistencia en SQLite. Permite crear bots con identidades únicas, roles y tonos personalizados.`,
    `Memoria de Texto Simple: Almacena el historial conversacional en SQLite. Cada vez que el usuario pregunta, el sistema recupera los últimos mensajes de la conversación y los envía como contexto junto al prompt de identidad. Ideal para diálogos continuos.`,
    `Memoria Avanzada RAG con Embeddings: Los documentos se dividen en fragmentos y se generan vectores numéricos con OpenAI (text-embedding-3-small). Ante una pregunta, se calcula el vector de la consulta y se buscan los fragmentos con mayor similitud de coseno en SQLite.`,
    `Proveedores LLM: El chat se puede combinar con DeepSeek (deepseek-chat) o con OpenAI (gpt-4o-mini, gpt-4o). Los embeddings se generan con OpenAI. Las claves se configuran en .env o en el panel de Ajustes.`
  ];

  const insertEmbedding = db.prepare(`
    INSERT INTO knowledge_embeddings (id, doc_id, bot_id, chunk_index, chunk_text, embedding, token_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  chunks.forEach((chunk, idx) => {
    // Vector de 1536 dimensiones normalizado
    const vec = new Array(1536).fill(0);
    vec[idx * 10] = 0.8;
    vec[(idx * 10) + 1] = 0.5;
    vec[(idx * 10) + 2] = 0.3;

    insertEmbedding.run(
      `emb-seed-${idx + 1}`,
      docId,
      'bot-rag-02',
      idx,
      chunk,
      JSON.stringify(vec),
      Math.ceil(chunk.length / 4)
    );
  });
}

export default db;
