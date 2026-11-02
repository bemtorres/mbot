import OpenAI from 'openai';
import { SettingsService } from './settingsService.js';

export class EmbeddingService {
  /**
   * Obtiene la instancia del cliente OpenAI con la clave actual
   */
  static getClient() {
    const apiKey = SettingsService.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY no está configurada. Por favor, añádela en Ajustes o en el archivo .env.');
    }
    return new OpenAI({ apiKey });
  }

  /**
   * Genera un embedding para un texto usando el modelo de OpenAI
   * @param {string} text - Texto a vectorizar
   * @param {string} model - Modelo a usar (default: text-embedding-3-small)
   * @returns {Promise<{embedding: number[], usage: any}>}
   */
  static async generateEmbedding(text, model = null) {
    const selectedModel = model || SettingsService.get('DEFAULT_EMBEDDING_MODEL') || 'text-embedding-3-small';
    const apiKey = SettingsService.get('OPENAI_API_KEY');

    // Si no hay API Key configurada, advertir con mensaje claro
    if (!apiKey) {
      throw new Error(
        'Falta la clave OPENAI_API_KEY. Ve a "Ajustes" en la barra superior de la aplicación para configurar tu API Key de OpenAI.'
      );
    }

    const client = this.getClient();
    const cleanText = text.replace(/\n+/g, ' ').trim();

    const response = await client.embeddings.create({
      model: selectedModel,
      input: cleanText,
      encoding_format: 'float',
    });

    return {
      embedding: response.data[0].embedding,
      usage: response.usage,
      model: selectedModel
    };
  }

  /**
   * Genera embeddings en lote para múltiples fragmentos de texto
   * @param {string[]} texts - Lista de fragmentos
   * @param {string} model
   * @returns {Promise<Array<{embedding: number[], index: number}>>}
   */
  static async generateBatchEmbeddings(texts, model = null) {
    if (!texts || texts.length === 0) return [];
    
    const selectedModel = model || SettingsService.get('DEFAULT_EMBEDDING_MODEL') || 'text-embedding-3-small';
    const client = this.getClient();

    const cleanTexts = texts.map(t => t.replace(/\n+/g, ' ').trim());

    const response = await client.embeddings.create({
      model: selectedModel,
      input: cleanTexts,
      encoding_format: 'float',
    });

    return response.data.map((item, idx) => ({
      index: idx,
      embedding: item.embedding
    }));
  }
}
