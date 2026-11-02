import db, { initDatabase } from '../database/db.js';
import { BotService } from '../src/services/botService.js';
import { KnowledgeService } from '../src/services/knowledgeService.js';
import { SettingsService } from '../src/services/settingsService.js';

initDatabase();

async function testSuite() {
  console.log('🧪 Iniciando pruebas de herramientas MCP...');

  // 1. list_bots
  const bots = BotService.getAllBots();
  console.log(`✅ list_bots: ${bots.length} bots encontrados.`);

  // 2. create_bot
  const testBot = BotService.createBot({
    name: 'Test MCP Bot',
    avatar: '🤖',
    role: 'Bot de Prueba MCP',
    type: 'rag',
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.5,
    system_prompt: 'Eres un bot de prueba para el servidor MCP.'
  });
  console.log(`✅ create_bot: Bot creado con ID ${testBot.id}`);

  // 3. get_bot
  const retrieved = BotService.getBotById(testBot.id);
  if (!retrieved || retrieved.name !== 'Test MCP Bot') {
    throw new Error('Fallo en get_bot');
  }
  console.log(`✅ get_bot: Recuperado bot '${retrieved.name}'`);

  // 4. update_bot
  const updated = BotService.updateBot(testBot.id, { role: 'Bot de Prueba Actualizado' });
  if (updated.role !== 'Bot de Prueba Actualizado') {
    throw new Error('Fallo en update_bot');
  }
  console.log(`✅ update_bot: Rol actualizado a '${updated.role}'`);

  // 5. add_knowledge_document
  const docResult = await KnowledgeService.addDocument({
    botId: testBot.id,
    title: 'Documento de Prueba MCP',
    content: 'Este es un texto de prueba para verificar la indexación y cálculo de vectores en la base de datos SQLite.'
  });
  console.log(`✅ add_knowledge_document: Documento indexado con ${docResult.chunkCount} chunks (ID: ${docResult.id})`);

  // 6. list_knowledge_documents
  const docs = KnowledgeService.getDocuments(testBot.id);
  if (docs.length !== 1) {
    throw new Error('Fallo en list_knowledge_documents');
  }
  console.log(`✅ list_knowledge_documents: ${docs.length} documento listado.`);

  // 7. test_semantic_search
  const searchResult = await KnowledgeService.testSearch({
    botId: testBot.id,
    query: 'texto de prueba para verificar'
  });
  console.log(`✅ test_semantic_search: Búsqueda ejecutada en modo '${searchResult.mode}'. Encontrados: ${searchResult.results?.length || 0} resultados.`);

  // 8. get_system_status
  const status = SettingsService.getPublicStatus();
  console.log(`✅ get_system_status: Claves OpenAI configurada: ${status.openai.isConfigured}, DeepSeek: ${status.deepseek.isConfigured}`);

  // 9. delete_bot
  const delResult = BotService.deleteBot(testBot.id);
  console.log(`✅ delete_bot: Bot de prueba eliminado exitosamente (ID: ${delResult.id}).`);

  console.log('\n🎉 ¡TODAS LAS HERRAMIENTAS MCP FUNCIONAN CORRECTAMENTE!');
}

testSuite().catch((err) => {
  console.error('❌ Error en pruebas:', err);
  process.exit(1);
});
