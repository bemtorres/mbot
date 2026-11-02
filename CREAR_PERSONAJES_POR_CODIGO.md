# 🛠️ Guía Rápida: Cómo Crear Personajes y Bots por Código

Esta guía explica **paso a paso y de manera súper fácil** cómo crear nuevos bots/personajes en **MBot Studio** utilizando código, sin depender exclusivamente de la interfaz web.

---

## 📋 ¿Qué compone a un Personaje en MBot?

Cada bot en el sistema cuenta con los siguientes parámetros:

| Parámetro | Tipo | Descripción | Opciones / Ejemplos |
|---|---|---|---|
| `name` | `string` | Nombre del bot o personaje | `"Don Quijote"`, `"Steve Jobs"`, `"CodeReviewer"` |
| `avatar` | `string` | Emoji o ícono representativo | `"🛡️"`, `"🍎"`, `"💻"`, `"🚀"`, `"🧠"` |
| `role` | `string` | Especialidad o rol asignado | `"Caballero Andante"`, `"Arquitecto Cloud"` |
| `type` | `string` | Tipo de arquitectura de memoria | `'simple'` (Texto) o `'rag'` (Embeddings) |
| `provider` | `string` | Proveedor LLM para el chat | `'openai'` o `'deepseek'` |
| `model` | `string` | Modelo de lenguaje | OpenAI: `gpt-4o-mini`, `gpt-4o`<br>DeepSeek: `deepseek-chat`, `deepseek-reasoner` |
| `temperature` | `number` | Creatividad (0.0 muy preciso a 1.0 muy creativo) | `0.7` (recomendado), `0.2` (código/técnico) |
| `system_prompt`| `string` | **Instrucción de identidad** (cómo debe pensar, hablar y actuar) | Texto con las directivas del personaje |

---

## ⚡ Método 1: Script CLI Rápido (El más fácil)

MBot incluye el script [`scripts/create-bot.js`](file:///c:/Users/benja/Desktop/mbot/scripts/create-bot.js) que puedes ejecutar desde la terminal.

### Modo A: Interactivo (Paso a paso guiado)

Simplemente ejecuta:
```bash
node scripts/create-bot.js
```

La consola te hará 7 preguntas guiadas:
```text
======================================================
   🛠️  CREADOR DE PERSONAJES Y BOTS POR CÓDIGO
======================================================

1. Nombre del bot (ej: Don Quijote, Steve Jobs): Don Quijote de la Mancha
2. Emoji o Avatar (ej: 🛡️, 🍎, 🚀) [default: 🤖]: 🛡️
3. Rol o especialidad (ej: Caballero Andante, Visionario Tech): Caballero Andante de la Mancha
Selecciona tipo (1: simple, 2: rag) [default: 1]: 1
Selecciona proveedor (1: openai, 2: deepseek) [default: 1]: 2
Modelo [default: deepseek-chat]: deepseek-chat
Temperatura (0.0 a 1.0) [default: 0.7]: 0.8
Escribe el System Prompt / Identidad del personaje:
> Eres Don Quijote de la Mancha. Hablas en español castellano antiguo con honor, valentía y cortesía hacia tu amada Dulcinea del Toboso. Ves gigantes donde otros ven molinos de viento.

🎉 ¡Personaje creado exitosamente!
ID: bot-xyz
Ya puedes verlo y chatear con él en: http://localhost:3000
```

---

### Modo B: En una sola línea de comando (Argumentos)

Puedes crear un bot instantáneamente pasando sus argumentos:

```bash
node scripts/create-bot.js "<nombre>" "<avatar>" "<rol>" "<simple|rag>" "<openai|deepseek>" "<modelo>" "<system_prompt...>"
```

#### Ejemplo 1: Don Quijote (Memoria Simple con DeepSeek)
```bash
node scripts/create-bot.js "Don Quijote" "🛡️" "Caballero Andante" "simple" "deepseek" "deepseek-chat" "Eres Don Quijote de la Mancha. Hablas en español caballeresco antiguo con frases nobles, invocando siempre a Dulcinea del Toboso y desconfiando de encantadores malignos."
```

#### Ejemplo 2: Arquitecto DevOps (Memoria RAG con OpenAI)
```bash
node scripts/create-bot.js "DevOps Senior" "☁️" "Especialista en Kubernetes y Docker" "rag" "openai" "gpt-4o-mini" "Eres un Arquitecto de Infraestructura y DevOps Senior. Respondes con buenas prácticas, configuraciones de YAML seguras y arquitectura de microservicios."
```

---

## 💻 Método 2: En JavaScript / Node.js Directo

Si estás desarrollando scripts o módulos dentro del proyecto:

```javascript
import { initDatabase } from './database/db.js';
import { BotService } from './src/services/botService.js';
import { KnowledgeService } from './src/services/knowledgeService.js';

// 1. Inicializar la base de datos SQLite
initDatabase();

// 2. Crear el bot
const miBot = BotService.createBot({
  name: 'Ada Lovelace',
  avatar: '👩‍💻',
  role: 'Pionera de la Programación',
  type: 'rag',                    // 'simple' o 'rag'
  provider: 'openai',             // 'openai' o 'deepseek'
  model: 'gpt-4o-mini',           // Modelo
  temperature: 0.5,
  system_prompt: `Eres Ada Lovelace, matemática e informática británica, celebrada como la primera programadora de la historia.
Analizas problemas desde la razón poética y la ciencia de los algoritmos de la máquina analítica de Babbage.`
});

console.log(`Bot creado con ID: ${miBot.id}`);

// 3. (Opcional) Si es tipo 'rag', puedes alimentarlo con documentos de conocimiento:
await KnowledgeService.addDocument({
  botId: miBot.id,
  title: 'Notas sobre la Máquina Analítica (1843)',
  content: `En 1843, Ada Lovelace publicó un conjunto de notas sobre la máquina analítica de Charles Babbage.
La Nota G contiene el primer algoritmo publicado específicamente diseñado para ser ejecutado por una máquina: el cálculo de los números de Bernoulli.
Ada vislumbró que la máquina podría componer música elaborada y científica además de operaciones matemáticas.`
});

console.log('¡Conocimiento RAG indexado con embeddings de OpenAI!');
```

---

## 🌐 Método 3: Vía API REST (HTTP POST)

Si quieres crear personajes desde otra aplicación, frontend externo, script de Bash o Python:

### Con `curl`:

```bash
curl -X POST http://localhost:3000/api/bots \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nikola Tesla",
    "avatar": "⚡",
    "role": "Genio de la Electricidad y Frecuencias",
    "type": "rag",
    "provider": "openai",
    "model": "gpt-4o-mini",
    "temperature": 0.6,
    "system_prompt": "Eres Nikola Tesla. Hablas con fascinación sobre corriente alterna, electromagnetismo, bobinas resonantes y el futuro inalámbrico de la humanidad."
  }'
```

### Con JavaScript (`fetch`):

```javascript
const response = await fetch('http://localhost:3000/api/bots', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Marie Curie',
    avatar: '🧪',
    role: 'Científica Radiactividad y Premio Nobel',
    type: 'simple',
    provider: 'deepseek',
    model: 'deepseek-chat',
    temperature: 0.4,
    system_prompt: 'Eres Marie Curie. Respondes con rigor científico, humildad y dedicación absoluta al descubrimiento de la física y la química.'
  })
});

const nuevoBot = await response.json();
console.log('Bot creado:', nuevoBot);
```

### Con Python (`requests`):

```python
import requests

url = "http://localhost:3000/api/bots"
payload = {
    "name": "Sun Tzu",
    "avatar": "📜",
    "role": "Estratega Militar Clásico",
    "type": "simple",
    "provider": "deepseek",
    "model": "deepseek-chat",
    "temperature": 0.7,
    "system_prompt": "Eres Sun Tzu, autor de El Arte de la Guerra. Ofreces consejos estratégicos, tácticos y de liderazgo mediante aforismos profundos."
}

res = requests.post(url, json=payload)
print("Respuesta:", res.json())
```

---

## 🧠 ¿Cómo agregar Conocimiento (RAG) por Código?

Para los bots de tipo **`rag`**, puedes inyectar textos, manuales o biografías para que el sistema:
1. Divida el texto en fragmentos (*chunks* de ~450 caracteres).
2. Genere vectores numéricos (embeddings de 1536 dimensiones) usando **OpenAI** (`text-embedding-3-small`).
3. Los almacene en la base de datos SQLite para búsqueda por similitud de coseno.

### Vía API REST:
```bash
curl -X POST http://localhost:3000/api/bots/ID_DEL_BOT/knowledge \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Tratado de Estrategia Militar",
    "content": "El supremo arte de la guerra es someter al enemigo sin luchar. Si conoces al enemigo y te conoces a ti mismo, no debes temer el resultado de cien batallas..."
  }'
```

---

## 🤖 Método 4: Usando el Protocolo MCP (Model Context Protocol)

Si utilizas asistentes como **Cursor**, **Claude Desktop** o **Antigravity**, puedes crear bots hablando en lenguaje natural gracias al servidor MCP de MBot:

```
"Crea un nuevo personaje llamado 'Galileo Galilei' con avatar 🔭, rol 'Astrónomo y Físico', memoria RAG y usando el modelo gpt-4o-mini de OpenAI. Agrégale como conocimiento sus observaciones sobre los cuatro satélites de Júpiter."
```

El servidor MCP ejecutará automáticamente las herramientas:
1. `create_bot`
2. `add_knowledge_document`

*Consulta la sección de MCP en el [README.md](file:///c:/Users/benja/Desktop/mbot/README.md) para más detalles.*

---

## 📌 Resumen de Comandos

| Acción | Comando |
|---|---|
| Crear bot interactivamente | `node scripts/create-bot.js` |
| Crear bot con argumentos | `node scripts/create-bot.js "Nombre" "Avatar" "Rol" "simple\|rag" "openai\|deepseek" "modelo" "Prompt..."` |
| Iniciar servidor web | `npm run dev` |
| Iniciar servidor MCP | `npm run mcp` |
| Ver la aplicación en navegador | `http://localhost:3000` |
