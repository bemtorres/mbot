import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { BotService } from '../services/botService.js';

const router = Router();

// Los navegadores convierten el archivo elegido a un retrato WebP de 512 px.
router.post('/avatar', (req, res) => {
  const data = req.body?.image;
  if (typeof data !== 'string' || !/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    return res.status(400).json({ success: false, error: 'Selecciona una imagen WebP válida.' });
  }
  const image = Buffer.from(data.split(',')[1], 'base64');
  if (image.length < 20 || image.length > 2 * 1024 * 1024 ||
      image.toString('ascii', 0, 4) !== 'RIFF' || image.toString('ascii', 8, 12) !== 'WEBP' ||
      image.readUInt32LE(4) + 8 !== image.length) {
    return res.status(400).json({ success: false, error: 'Imagen WebP inválida o demasiado grande (máximo 2 MB).' });
  }
  try {
    const filename = `avatar-${randomUUID()}.webp`;
    const directory = fileURLToPath(new URL('../../public/images/bots/', import.meta.url));
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(directory + filename, image, { flag: 'wx' });
    res.status(201).json({ success: true, data: { avatar: `/images/bots/${filename}` } });
  } catch {
    res.status(500).json({ success: false, error: 'No se pudo guardar la imagen.' });
  }
});

// Listar todos los bots
router.get('/', (req, res) => {
  try {
    const bots = BotService.getAllBots();
    res.json({ success: true, data: bots });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Obtener un bot específico
router.get('/:id', (req, res) => {
  try {
    const bot = BotService.getBotById(req.params.id);
    if (!bot) {
      return res.status(404).json({ success: false, error: 'Bot no encontrado' });
    }
    res.json({ success: true, data: bot });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Crear nuevo perfil de bot
router.post('/', (req, res) => {
  try {
    const { name, avatar, role, type, provider, model, system_prompt, temperature } = req.body;
    if (!name || !system_prompt) {
      return res.status(400).json({ success: false, error: 'Nombre y System Prompt son obligatorios' });
    }
    const newBot = BotService.createBot({ name, avatar, role, type, provider, model, system_prompt, temperature });
    res.status(201).json({ success: true, data: newBot });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Actualizar perfil e identidad de bot
router.put('/:id', (req, res) => {
  try {
    const updated = BotService.updateBot(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Eliminar bot
router.delete('/:id', (req, res) => {
  try {
    const result = BotService.deleteBot(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Obtener conversaciones de un bot
router.get('/:id/conversations', (req, res) => {
  try {
    const convs = BotService.getConversations(req.params.id);
    res.json({ success: true, data: convs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Crear nueva conversación para un bot
router.post('/:id/conversations', (req, res) => {
  try {
    const conv = BotService.getOrCreateConversation(req.params.id);
    res.status(201).json({ success: true, data: conv });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
