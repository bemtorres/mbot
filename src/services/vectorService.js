import db from '../../database/db.js';

export class VectorService {
  /**
   * Divide un texto en fragmentos (chunks) con solapamiento para indexar en RAG
   * @param {string} text - Texto largo
   * @param {number} chunkSize - Tamaño máximo aproximado por chunk (caracteres)
   * @param {number} overlap - Solapamiento entre chunks para no perder contexto
   * @returns {string[]} Lista de fragmentos
   */
  static splitTextIntoChunks(text, chunkSize = 500, overlap = 80) {
    if (!text || text.trim().length === 0) return [];
    
    // Normalizar saltos de línea
    const cleanText = text.replace(/\r\n/g, '\n').trim();
    if (cleanText.length <= chunkSize) {
      return [cleanText];
    }

    const chunks = [];
    let start = 0;

    while (start < cleanText.length) {
      let end = start + chunkSize;

      if (end >= cleanText.length) {
        chunks.push(cleanText.substring(start).trim());
        break;
      }

      // Intentar cortar en el último salto de línea o punto antes del límite
      const slice = cleanText.substring(start, end);
      let breakPoint = slice.lastIndexOf('\n');
      if (breakPoint === -1 || breakPoint < chunkSize * 0.5) {
        breakPoint = slice.lastIndexOf('. ');
      }
      if (breakPoint === -1 || breakPoint < chunkSize * 0.5) {
        breakPoint = slice.lastIndexOf(' ');
      }

      // Si no encuentra espacio razonable, cortar en el límite
      const actualCut = (breakPoint !== -1 && breakPoint > chunkSize * 0.3) 
        ? start + breakPoint + 1 
        : end;

      const chunk = cleanText.substring(start, actualCut).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      // Avanzar con solapamiento
      start = actualCut - overlap;
      if (start < 0) start = 0;
      if (start >= cleanText.length) break;
    }

    return chunks;
  }

  /**
   * Calcula la similitud de coseno entre dos vectores numéricos
   * sim(A, B) = (A • B) / (||A|| * ||B||)
   * @param {number[]} vecA
   * @param {number[]} vecB
   * @returns {number} Valor entre -1 y 1 (usualmente 0 a 1 para embeddings normalizados)
   */
  static cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    const len = vecA.length;
    for (let i = 0; i < len; i++) {
      const a = vecA[i];
      const b = vecB[i];
      dotProduct += a * b;
      normA += a * a;
      normB += b * b;
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Busca los fragmentos de conocimiento más relevantes para un bot dado un vector de consulta
   * @param {string} botId - ID del bot
   * @param {number[]} queryEmbedding - Vector de la pregunta del usuario
   * @param {number} topK - Cantidad de fragmentos a recuperar (default 3)
   * @param {number} minSimilarity - Umbral mínimo de similitud (default 0.25)
   * @returns {Array<{id: string, chunk_text: string, title: string, similarity: number, chunk_index: number}>}
   */
  static searchSimilarChunks(botId, queryEmbedding, topK = 3, minSimilarity = 0.25) {
    // Obtener todos los fragmentos asociados a este bot junto con el título del documento
    const rows = db.prepare(`
      SELECT 
        e.id,
        e.chunk_text,
        e.chunk_index,
        e.embedding,
        d.title as doc_title
      FROM knowledge_embeddings e
      JOIN knowledge_documents d ON e.doc_id = d.id
      WHERE e.bot_id = ?
    `).all(botId);

    if (!rows || rows.length === 0) {
      return [];
    }

    const scoredChunks = [];

    for (const row of rows) {
      try {
        const storedVec = typeof row.embedding === 'string' 
          ? JSON.parse(row.embedding) 
          : row.embedding;

        const similarity = this.cosineSimilarity(queryEmbedding, storedVec);

        if (similarity >= minSimilarity) {
          scoredChunks.push({
            id: row.id,
            chunk_text: row.chunk_text,
            chunk_index: row.chunk_index,
            doc_title: row.doc_title,
            similarity: Number(similarity.toFixed(4))
          });
        }
      } catch (err) {
        console.error('Error parseando embedding de chunk:', row.id, err);
      }
    }

    // Ordenar de mayor a menor similitud
    scoredChunks.sort((a, b) => b.similarity - a.similarity);

    return scoredChunks.slice(0, topK);
  }
}
