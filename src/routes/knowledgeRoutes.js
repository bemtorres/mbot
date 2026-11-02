import { Router } from 'express';
import { KnowledgeService } from '../services/knowledgeService.js';

const router = Router();

// Listar documentos de conocimiento de un bot
router.get('/bots/:id/knowledge', (req, res) => {
  try {
    const docs = KnowledgeService.getDocuments(req.params.id);
    res.json({ success: true, data: docs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Agregar nuevo documento con embeddings de OpenAI
router.post('/bots/:id/knowledge', async (req, res) => {
  try {
    const { title, content } = req.body;
    const botId = req.params.id;

    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Título y contenido son obligatorios' });
    }

    const result = await KnowledgeService.addDocument({ botId, title, content });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error('Error al agregar documento RAG:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Eliminar un documento de conocimiento
router.delete('/knowledge/:id', (req, res) => {
  try {
    const result = KnowledgeService.deleteDocument(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Probar búsqueda semántica y ver cálculo de similitud
router.post('/bots/:id/knowledge/test-search', async (req, res) => {
  try {
    const { query } = req.body;
    const result = await KnowledgeService.testSearch({
      botId: req.params.id,
      query
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
