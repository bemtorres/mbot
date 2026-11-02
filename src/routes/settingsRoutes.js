import { Router } from 'express';
import { SettingsService } from '../services/settingsService.js';

const router = Router();

// Obtener estado de configuración
router.get('/', (req, res) => {
  try {
    const status = SettingsService.getPublicStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Guardar o actualizar claves de API
router.post('/', (req, res) => {
  try {
    const { openaiApiKey, deepseekApiKey } = req.body;

    if (openaiApiKey !== undefined && openaiApiKey.trim() !== '') {
      SettingsService.set('OPENAI_API_KEY', openaiApiKey.trim());
    }

    if (deepseekApiKey !== undefined && deepseekApiKey.trim() !== '') {
      SettingsService.set('DEEPSEEK_API_KEY', deepseekApiKey.trim());
    }

    const updatedStatus = SettingsService.getPublicStatus();
    res.json({
      success: true,
      message: 'Configuración actualizada exitosamente',
      data: updatedStatus
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
