import db from '../../database/db.js';
import dotenv from 'dotenv';
dotenv.config({ quiet: true });

export class SettingsService {
  /**
   * Obtiene una configuración priorizando la base de datos y luego .env
   */
  static get(key) {
    try {
      const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
      if (row && row.value) {
        return row.value;
      }
    } catch {
      // Ignorar si la tabla aún no está lista
    }

    return process.env[key] || '';
  }

  /**
   * Guarda una configuración en la base de datos
   */
  static set(key, value) {
    const stmt = db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(key, value);
  }

  /**
   * Retorna el estado público de configuración (enmascarando claves secretas)
   */
  static getPublicStatus() {
    const openAiKey = this.get('OPENAI_API_KEY');
    const deepseekKey = this.get('DEEPSEEK_API_KEY');

    return {
      openai: {
        isConfigured: Boolean(openAiKey && openAiKey.trim().length > 10),
        maskedKey: openAiKey ? this.maskKey(openAiKey) : '',
        defaultModel: this.get('DEFAULT_OPENAI_MODEL') || 'gpt-4o-mini',
        embeddingModel: this.get('DEFAULT_EMBEDDING_MODEL') || 'text-embedding-3-small'
      },
      deepseek: {
        isConfigured: Boolean(deepseekKey && deepseekKey.trim().length > 10),
        maskedKey: deepseekKey ? this.maskKey(deepseekKey) : '',
        defaultModel: this.get('DEFAULT_DEEPSEEK_MODEL') || 'deepseek-chat'
      }
    };
  }

  static maskKey(key) {
    if (!key || key.length < 8) return '••••••••';
    return `${key.slice(0, 7)}...${key.slice(-4)}`;
  }
}
