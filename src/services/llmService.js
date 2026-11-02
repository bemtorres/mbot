import OpenAI from 'openai';
import { SettingsService } from './settingsService.js';

export class LLMService {
  /**
   * Crea una instancia de cliente OpenAI configurada para OpenAI o DeepSeek
   * @param {'openai' | 'deepseek'} provider
   */
  static getClient(provider = 'openai') {
    if (provider === 'deepseek') {
      const apiKey = SettingsService.get('DEEPSEEK_API_KEY');
      if (!apiKey) {
        throw new Error('DEEPSEEK_API_KEY no está configurada. Agrégala en Ajustes o en el archivo .env.');
      }
      return new OpenAI({
        apiKey,
        baseURL: 'https://api.deepseek.com',
      });
    }

    // Default: OpenAI
    const apiKey = SettingsService.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY no está configurada. Agrégala en Ajustes o en el archivo .env.');
    }
    return new OpenAI({ apiKey });
  }

  /**
   * Ejecuta una llamada de completado de chat usando OpenAI o DeepSeek
   * @param {Object} params
   * @param {'openai' | 'deepseek'} params.provider
   * @param {string} params.model
   * @param {Array<{role: string, content: string}>} params.messages
   * @param {number} params.temperature
   * @returns {Promise<{content: string, model: string, provider: string, usage: any}>}
   */
  static async chatCompletion({ provider = 'openai', model, messages, temperature = 0.7 }) {
    const activeProvider = provider === 'deepseek' ? 'deepseek' : 'openai';
    const targetModel = model || (activeProvider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');

    const apiKey = activeProvider === 'deepseek' 
      ? SettingsService.get('DEEPSEEK_API_KEY') 
      : SettingsService.get('OPENAI_API_KEY');

    // Modo demostrativo inteligente si el usuario aún no configuró la clave de API
    if (!apiKey) {
      return this.generateSimulatedResponse({
        provider: activeProvider,
        model: targetModel,
        messages
      });
    }

    const client = this.getClient(activeProvider);

    const response = await client.chat.completions.create({
      model: targetModel,
      messages,
      temperature,
      max_tokens: 1500,
    });

    const choice = response.choices[0];
    const content = choice.message?.content || '';

    return {
      content,
      model: response.model || targetModel,
      provider: activeProvider,
      usage: response.usage
    };
  }

  /**
   * Genera una respuesta simulada cuando la API key aún no se ha ingresado,
   * permitiendo explorar la interfaz y validar que la memoria funciona.
   */
  static generateSimulatedResponse({ provider, model, messages }) {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    const systemMsg = messages.find(m => m.role === 'system')?.content || '';
    const hasRagContext = systemMsg.includes('FRAGMENTOS DE CONOCIMIENTO RECUPERADOS');
    const historyCount = messages.filter(m => m.role === 'user' || m.role === 'assistant').length;

    let reply = `🤖 **[Modo Simulación / Sin API Key Activa]**\n\n`;
    reply += `He recibido tu mensaje: *" ${lastUserMsg} "*\n\n`;
    
    if (hasRagContext) {
      reply += `🧠 **Memoria RAG activa:** Se detectaron fragmentos de conocimiento relevantes en SQLite. Cuando configures tu clave de OpenAI en **Ajustes**, estos fragmentos serán analizados por ${provider.toUpperCase()} (${model}).\n\n`;
    } else {
      reply += `📝 **Memoria de Texto Simple:** La memoria conversacional en SQLite tiene almacenados **${historyCount} mensajes** en esta sesión.\n\n`;
    }

    reply += `> 💡 **Para activar respuestas en tiempo real con ${provider.toUpperCase()}:** Haz clic en el botón de **⚙️ Ajustes** en la esquina superior derecha e ingresa tu clave API de ${provider === 'deepseek' ? 'DeepSeek' : 'OpenAI'}.`;

    return {
      content: reply,
      model: `${model} (demo)`,
      provider,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    };
  }
}
