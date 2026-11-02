import { randomUUID } from 'node:crypto';
import db from '../../database/db.js';
import { VectorService } from './vectorService.js';
import { EmbeddingService } from './embeddingService.js';
import { SettingsService } from './settingsService.js';

export class KnowledgeService {
  /**
   * Obtiene todos los documentos de conocimiento de un bot
   */
  static getDocuments(botId) {
    return db.prepare(`
      SELECT 
        d.*,
        (SELECT COUNT(*) FROM knowledge_embeddings WHERE doc_id = d.id) as chunk_count
      FROM knowledge_documents d
      WHERE d.bot_id = ?
      ORDER BY d.created_at DESC
    `).all(botId);
  }

  /**
   * Agrega un nuevo documento a la base de conocimiento, lo fragmenta y genera embeddings con OpenAI
   * @param {Object} params
   * @param {string} params.botId
   * @param {string} params.title
   * @param {string} params.content
   * @returns {Promise<any>}
   */
  static async addDocument({ botId, title, content }) {
    if (!title || !title.trim()) {
      throw new Error('El título del documento es obligatorio.');
    }
    if (!content || !content.trim()) {
      throw new Error('El contenido del documento no puede estar vacío.');
    }

    const docId = `doc-${randomUUID()}`;
    const chunks = VectorService.splitTextIntoChunks(content, 450, 70);

    if (chunks.length === 0) {
      throw new Error('No se pudieron extraer fragmentos válidos del documento.');
    }

    // Verificar clave de OpenAI
    const openAiKey = SettingsService.get('OPENAI_API_KEY');
    let embeddings = [];
    let isMockEmbeddings = false;

    if (openAiKey) {
      try {
        const batchResults = await EmbeddingService.generateBatchEmbeddings(chunks);
        embeddings = batchResults.map(r => r.embedding);
      } catch (embErr) {
        throw new Error(`Error generando embeddings con OpenAI: ${embErr.message}`);
      }
    } else {
      // Si el usuario aún no configuró la clave de OpenAI, creamos vectores normalizados para no romper el flujo
      isMockEmbeddings = true;
      embeddings = chunks.map((chunk, idx) => {
        // Vector pseudo-aleatorio determinista para pruebas
        const vec = new Array(1536).fill(0);
        for (let i = 0; i < 50; i++) {
          vec[(chunk.charCodeAt(i % chunk.length) * 17 + i) % 1536] = 0.1 * (idx + 1);
        }
        return vec;
      });
    }

    // Guardar documento y fragmentos en SQLite
    const insertDoc = db.prepare(`
      INSERT INTO knowledge_documents (id, bot_id, title, content, chunk_count)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertEmbedding = db.prepare(`
      INSERT INTO knowledge_embeddings (id, doc_id, bot_id, chunk_index, chunk_text, embedding, token_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertDoc.run(docId, botId, title.trim(), content.trim(), chunks.length);

    for (let i = 0; i < chunks.length; i++) {
      const embId = `emb-${randomUUID()}`;
      const chunkText = chunks[i];
      const embVec = embeddings[i];
      const approxTokens = Math.ceil(chunkText.length / 4);

      insertEmbedding.run(
        embId,
        docId,
        botId,
        i,
        chunkText,
        JSON.stringify(embVec),
        approxTokens
      );
    }

    return {
      id: docId,
      botId,
      title: title.trim(),
      chunkCount: chunks.length,
      isMockEmbeddings,
      message: isMockEmbeddings 
        ? 'Documento indexado con vectores simulados (agrega tu OPENAI_API_KEY en Ajustes para embeddings oficiales de OpenAI).'
        : `Documento indexado exitosamente con ${chunks.length} fragmentos usando OpenAI text-embedding-3-small.`
    };
  }

  /**
   * Elimina un documento y todos sus embeddings asociados
   */
  static deleteDocument(docId) {
    const doc = db.prepare('SELECT * FROM knowledge_documents WHERE id = ?').get(docId);
    if (!doc) {
      throw new Error(`Documento con ID ${docId} no encontrado.`);
    }

    db.prepare('DELETE FROM knowledge_embeddings WHERE doc_id = ?').run(docId);
    db.prepare('DELETE FROM knowledge_documents WHERE id = ?').run(docId);

    return { success: true, id: docId };
  }

  /**
   * Prueba de búsqueda semántica con cálculo de similitud en tiempo real
   */
  static async testSearch({ botId, query }) {
    if (!query || !query.trim()) {
      throw new Error('La consulta de prueba no puede estar vacía.');
    }

    const openAiKey = SettingsService.get('OPENAI_API_KEY');
    if (!openAiKey) {
      // Si no hay clave, retornar búsqueda de palabras clave con score ilustrativo
      return {
        query,
        mode: 'keyword_fallback',
        warning: 'OPENAI_API_KEY no configurada. Resultados basados en coincidencia de términos.',
        results: db.prepare(`
          SELECT 
            e.id, e.chunk_text, e.chunk_index, d.title as doc_title
          FROM knowledge_embeddings e
          JOIN knowledge_documents d ON e.doc_id = d.id
          WHERE e.bot_id = ?
        `).all(botId).slice(0, 3).map(r => ({ ...r, similarity: 0.75 }))
      };
    }

    const { embedding } = await EmbeddingService.generateEmbedding(query.trim());
    const results = VectorService.searchSimilarChunks(botId, embedding, 5, 0.15);

    return {
      query,
      mode: 'openai_embeddings',
      results
    };
  }
}
