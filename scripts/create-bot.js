#!/usr/bin/env node
/**
 * Script interactivo y por argumentos para crear bots/personajes por código
 * 
 * Uso rápido por argumentos:
 *   node scripts/create-bot.js "Nombre" "Avatar" "Rol" "simple|rag" "openai|deepseek" "modelo" "System Prompt..."
 * 
 * Uso interactivo:
 *   node scripts/create-bot.js
 */

import { initDatabase } from '../database/db.js';
import { BotService } from '../src/services/botService.js';
import { KnowledgeService } from '../src/services/knowledgeService.js';
import readline from 'node:readline';

// Inicializar SQLite
initDatabase();

const args = process.argv.slice(2);

async function run() {
  if (args.length >= 7) {
    // Modo directo por argumentos
    const [name, avatar, role, type, provider, model, ...promptParts] = args;
    const system_prompt = promptParts.join(' ');

    console.log(`\n🤖 Creando personaje: ${avatar} ${name}...`);

    const newBot = BotService.createBot({
      name,
      avatar,
      role,
      type: type.toLowerCase() === 'rag' ? 'rag' : 'simple',
      provider: provider.toLowerCase() === 'deepseek' ? 'deepseek' : 'openai',
      model,
      system_prompt,
      temperature: 0.7
    });

    console.log(`✅ ¡Bot creado exitosamente!`);
    console.log(`   ID: ${newBot.id}`);
    console.log(`   Nombre: ${newBot.name}`);
    console.log(`   Tipo de Memoria: ${newBot.type.toUpperCase()}`);
    console.log(`   Proveedor: ${newBot.provider} (${newBot.model})\n`);
    process.exit(0);
  }

  // Modo interactivo por consola
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  console.log('\n======================================================');
  console.log('   🛠️  CREADOR DE PERSONAJES Y BOTS POR CÓDIGO');
  console.log('======================================================\n');

  const name = (await question('1. Nombre del bot (ej: Don Quijote, Steve Jobs): ')).trim();
  if (!name) {
    console.error('❌ El nombre es obligatorio.');
    rl.close();
    process.exit(1);
  }

  const avatar = (await question('2. Emoji o Avatar (ej: 🛡️, 🍎, 🚀) [default: 🤖]: ')).trim() || '🤖';
  const role = (await question('3. Rol o especialidad (ej: Caballero Andante, Visionario Tech): ')).trim() || 'Asistente';

  console.log('\nTipos de memoria:');
  console.log('  1. simple -> Historial conversacional de texto en SQLite');
  console.log('  2. rag    -> Memoria con embeddings vectoriales de OpenAI en SQLite');
  const typeChoice = (await question('Selecciona tipo (1 o 2) [default: 1]: ')).trim();
  const type = typeChoice === '2' ? 'rag' : 'simple';

  console.log('\nProveedores LLM:');
  console.log('  1. openai   (gpt-4o-mini, gpt-4o)');
  console.log('  2. deepseek (deepseek-chat, deepseek-reasoner)');
  const providerChoice = (await question('Selecciona proveedor (1 o 2) [default: 1]: ')).trim();
  const provider = providerChoice === '2' ? 'deepseek' : 'openai';
  const defaultModel = provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini';
  const model = (await question(`Modelo [default: ${defaultModel}]: `)).trim() || defaultModel;

  const tempInput = (await question('Temperatura (0.0 a 1.0) [default: 0.7]: ')).trim();
  const temperature = parseFloat(tempInput) || 0.7;

  console.log('\nEscribe el System Prompt / Identidad del personaje:');
  const system_prompt = (await question('> ')).trim();

  rl.close();

  console.log('\n📦 Registrando bot en la base de datos SQLite...');

  const createdBot = BotService.createBot({
    name,
    avatar,
    role,
    type,
    provider,
    model,
    system_prompt,
    temperature
  });

  console.log('\n🎉 ¡Personaje creado exitosamente!');
  console.log('------------------------------------------------------');
  console.log(`ID:           ${createdBot.id}`);
  console.log(`Nombre:       ${createdBot.avatar} ${createdBot.name}`);
  console.log(`Rol:          ${createdBot.role}`);
  console.log(`Memoria:      ${createdBot.type === 'rag' ? '🧠 RAG Embeddings (SQLite)' : '📝 Simple Conversacional (SQLite)'}`);
  console.log(`Modelo:       ${createdBot.provider.toUpperCase()} (${createdBot.model})`);
  console.log(`Temperatura:  ${createdBot.temperature}`);
  console.log('------------------------------------------------------');
  console.log('Ya puedes verlo y chatear con él en: http://localhost:3000\n');
}

run().catch((err) => {
  console.error('\n❌ Error al crear el personaje:', err.message);
  process.exit(1);
});
