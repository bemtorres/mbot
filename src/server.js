import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { initDatabase } from '../database/db.js';
import botRoutes from './routes/botRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import knowledgeRoutes from './routes/knowledgeRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicializar SQLite
console.log('📦 Inicializando base de datos SQLite...');
initDatabase();
console.log('✅ Base de datos SQLite lista.');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir frontend estático con Tailwind
const publicPath = path.resolve(__dirname, '../public');
app.use(express.static(publicPath));

// Rutas de API
app.use('/api/bots', botRoutes);
app.use('/api', chatRoutes);
app.use('/api', knowledgeRoutes);
app.use('/api/settings', settingsRoutes);

// Endpoint de salud
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Fallback para SPA en Express 5: servir index.html para rutas frontend
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint no encontrado' });
  }
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor MBot iniciado con éxito!`);
  console.log(`📡 URL Local: http://localhost:${PORT}`);
  console.log(`🧠 Base de Datos: SQLite (database/bot.db)`);
  console.log(`🤖 Bots activos: Alex (Memoria Simple) & Sophia (Memoria RAG Embeddings)`);
  console.log(`⚡ Modelos disponibles: DeepSeek y OpenAI`);
  console.log(`✨ Interfaz Web: Tailwind CSS habilitado\n`);
});
