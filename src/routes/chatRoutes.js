import { Router } from 'express';
import { BotService } from '../services/botService.js';

const router = Router();

// Enviar mensaje en una conversación
router.post('/chat', async (req, res) => {
  try {
    const { botId, conversationId, message } = req.body;
    if (!botId || !message) {
      return res.status(400).json({ success: false, error: 'botId y message son requeridos' });
    }

    const result = await BotService.processChatMessage({
      botId,
      conversationId,
      userMessage: message
    });

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error en /api/chat:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Obtener mensajes de una conversación
router.get('/conversations/:id/messages', (req, res) => {
  try {
    const messages = BotService.getMessages(req.params.id);
    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Limpiar historial de una conversación
router.delete('/conversations/:id', (req, res) => {
  try {
    const result = BotService.clearConversation(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
