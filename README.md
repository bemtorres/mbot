# 🤖 MBot Studio - Chatbots con Perfil, Identidad y Memoria SQLite

Plataforma completa desarrollada en **Node.js** para la creación y gestión de chatbots con **perfil propio e identidad configurable**, respaldados por una base de datos **SQLite**.

El sistema integra dos arquitecturas de memoria distintas, conexión con **OpenAI** y **DeepSeek**, interfaz web moderna diseñada con **Tailwind CSS**, herramientas CLI, y un **servidor MCP (Model Context Protocol)** completo para gestionar todo desde Cursor, Claude Desktop o Antigravity.

---

## 📖 Guías Rápidas Destacadas

- 🛠️ **[Guía: Cómo Crear Personajes y Bots por Código (Paso a Paso)](file:///c:/Users/benja/Desktop/mbot/CREAR_PERSONAJES_POR_CODIGO.md)**: Métodos por CLI interactivo, argumentos, Node.js directo, API REST y MCP.
- 🔌 **[Servidor MCP (Model Context Protocol)](#-servidor-mcp-model-context-protocol)**: Conecta cualquier asistente de IA para crear bots, inyectar conocimiento y chatear programáticamente.

---

## 🚀 Características Principales

### 1. Perfiles e Identidad Personalizada
- Cada bot tiene su propia identidad: **Nombre, Avatar (emoji/icono), Rol/Especialidad, Tono y System Prompt (Instrucciones de Identidad)**.
- Ajuste de **Temperatura** (creatividad vs precisión).
- Selector de proveedor LLM: **OpenAI** (`gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo`) o **DeepSeek** (`deepseek-chat`, `deepseek-reasoner`).
- **Personajes preconfigurados incluidos**:
  - 🤖 **Alex** (Asistente General - Memoria Simple)
  - 🧠 **Sophia** (Especialista en IA & RAG - Memoria RAG)
  - 🌹 **El Principito** (Filósofo poético)
  - 🧢 **El Brayan** (Chileno de barrio / Coa / Flaite carismático)
  - 🇨🇱 **Bernardo O'Higgins** (Padre de la Patria Chilena)
  - ⚓ **Arturo Prat Chacón** (Héroe Naval de Iquique)
  - 📜 **Gabriela Mistral** (Poetisa y Premio Nobel de Literatura)
  - 🏛️ **Sócrates** (Filósofo del Método Mayéutico)
  - ⚛️ **Albert Einstein** (Físico Teórico y Relatividad)

### 2. Dos Tipos de Memoria

#### 📝 Bot Tipo 1: Memoria de Texto Simple (Historial Conversacional)
- **Persistencia en SQLite**: Todos los mensajes se guardan en la tabla `messages`.
- **Contexto Directo**: Al enviar una pregunta, el servidor recupera los últimos mensajes de la conversación y los ensambla cronológicamente junto al prompt de identidad.
- **Sin Embeddings**: Mantiene coherencia y seguimiento temático de forma inmediata y económica.

#### 🧠 Bot Tipo 2: Memoria RAG Avanzada con Embeddings (Base de Conocimiento)
- **Fragmentación (Chunking)**: Divide documentos y textos extensos en bloques de ~450 caracteres con solapamiento (*overlap*).
- **Embeddings con OpenAI**: Utiliza el modelo oficial `text-embedding-3-small` (1536 dimensiones) para calcular los vectores numéricos.
- **Almacenamiento Vectorial en SQLite**: Los vectores y metadatos se indexan en la tabla `knowledge_embeddings`.
- **Búsqueda Semántica por Similitud de Coseno**: Cuando el usuario hace una pregunta, se genera el vector de la consulta con OpenAI y se calculan las similitudes en SQLite en tiempo real, recuperando los fragmentos más relevantes para inyectarlos al LLM junto con el historial.
- **Inspección en Chat**: En la interfaz, cada respuesta del bot RAG incluye un acordeón desplegable que muestra las fuentes exactas y el porcentaje de similitud utilizado.

### 3. Interfaz Web Adaptada a PC con Tailwind CSS
- Tema oscuro moderno inspirado en shadcn/ui.
- Sidebar con selector de bots, contadores de documentos e indicadores de estado.
- Chat con renderizado de Markdown completo (listas, negritas, bloques de código, citas).
- **Botón "Representación"**: Modal visual paso a paso que desglosa el pipeline exacto ejecutado por la IA (latencia, tokens de entrada y salida, fragmentos RAG recuperados).
- Modal de **Identidad de Bot**: crea nuevos bots o edita su System Prompt y parámetros.
- Modal de **Base de Conocimiento RAG**:
  - Listado de documentos y cantidad de fragmentos indexados.
  - Formulario para añadir nuevos textos con auto-vectorización.
  - **Pestaña de prueba semántica**: Permite probar cualquier consulta y ver la similitud de coseno en tiempo real con barras de progreso.
- Modal de **Ajustes de API**: Configura tus API Keys de OpenAI y DeepSeek directamente desde el navegador (se guardan de forma segura en SQLite).

---

## 🔌 Servidor MCP (Model Context Protocol)

MBot Studio incluye un servidor MCP oficial basado en `@modelcontextprotocol/sdk` que permite a clientes de IA como **Cursor**, **Claude Desktop** y **Antigravity** controlar el sistema mediante 14 herramientas estandarizadas.

### Iniciar el servidor MCP:
```bash
npm run mcp
```

### Herramientas Disponibles en el MCP:

| Herramienta | Descripción | Parámetros Clave |
|---|---|---|
| `create_bot` | Crea un nuevo personaje/bot con identidad propia | `name`, `avatar`, `role`, `type`, `provider`, `model`, `system_prompt`, `temperature` |
| `list_bots` | Lista todos los bots y sus estadísticas | *(ninguno)* |
| `get_bot` | Obtiene el perfil completo y prompt de un bot | `bot_id` |
| `update_bot` | Modifica identidad, prompt o configuración de un bot | `bot_id`, `name`, `system_prompt`, etc. |
| `delete_bot` | Elimina un bot y todos sus datos en SQLite | `bot_id` |
| `add_knowledge_document` | Fragmenta e indexa texto con embeddings de OpenAI | `bot_id`, `title`, `content` |
| `list_knowledge_documents` | Lista los documentos de conocimiento de un bot | `bot_id` |
| `get_knowledge_document` | Obtiene el texto y fragmentos de un documento | `document_id` |
| `delete_knowledge_document` | Elimina un documento y sus vectores embeddings | `document_id` |
| `test_semantic_search` | Prueba similitud de coseno en tiempo real | `bot_id`, `query` |
| `chat_with_bot` | Chatea con un bot (gestiona memoria y traza) | `bot_id`, `message`, `conversation_id` |
| `get_conversation_messages` | Obtiene el historial de mensajes de un bot | `bot_id` |
| `clear_conversation_memory` | Reinicia la memoria conversacional del bot | `bot_id` |
| `get_system_status` | Inspecciona claves API y métricas de SQLite | *(ninguno)* |
| `set_api_keys` | Configura o actualiza claves de OpenAI / DeepSeek | `openai_api_key`, `deepseek_api_key` |

### Configuración en Clientes MCP:

#### 1. Para Cursor (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "mbot-studio": {
      "command": "node",
      "args": [
        "c:/Users/benja/Desktop/mbot/mcp/server.js"
      ]
    }
  }
}
```

#### 2. Para Claude Desktop (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "mbot-studio": {
      "command": "node",
      "args": [
        "c:/Users/benja/Desktop/mbot/mcp/server.js"
      ]
    }
  }
}
```

---

## 🛠️ Tecnologías Utilizadas

- **Entorno de Ejecución:** Node.js v24 (con soporte nativo para ES Modules y `node:sqlite`).
- **Servidor Web:** Express v5 + CORS.
- **Protocolo MCP:** `@modelcontextprotocol/sdk` (v1.32.2) + Zod.
- **Base de Datos:** SQLite (`node:sqlite DatabaseSync`) con WAL mode activado.
- **SDKs:** OpenAI Official SDK (usado tanto para OpenAI como para el endpoint compatible de DeepSeek).
- **Frontend:** HTML5, Vanilla JavaScript reactivo, Tailwind CSS, Lucide Icons y Marked.js.

---

## 📂 Estructura del Proyecto

```
mbot/
├── .cursor/
│   └── mcp.json                  # Configuración MCP para Cursor
├── .env.example                  # Plantilla de variables de entorno
├── .env                          # Configuración local (API Keys y puertos)
├── package.json                  # Scripts y dependencias
├── mcp_config.json               # Configuración genérica del servidor MCP
├── CREAR_PERSONAJES_POR_CODIGO.md# Guía completa de creación de bots por código
├── README.md                     # Documentación principal
├── database/
│   ├── bot.db                    # Archivo de base de datos SQLite (auto-generado)
│   └── db.js                     # Inicialización de tablas y sembrado de bots
├── mcp/
│   └── server.js                 # Servidor MCP con 14 herramientas integradas
├── scripts/
│   └── create-bot.js             # CLI interactivo y por argumentos para crear bots
├── src/
│   ├── server.js                 # Servidor Express y despacho estático
│   ├── services/
│   │   ├── botService.js         # Orquestador de memoria, perfiles y chat
│   │   ├── llmService.js         # Cliente unificado OpenAI & DeepSeek
│   │   ├── embeddingService.js   # Generación de vectores con OpenAI
│   │   ├── vectorService.js      # Chunking y similitud de coseno
│   │   └── settingsService.js    # Gestión de API Keys en SQLite/.env
│   └── routes/
│       ├── botRoutes.js          # Endpoints CRUD de bots y conversaciones
│       ├── chatRoutes.js         # Endpoints de mensajes y chat
│       ├── knowledgeRoutes.js    # Endpoints de base de conocimiento RAG
│       └── settingsRoutes.js     # Endpoints de configuración de API Keys
└── public/
    ├── index.html                # Interfaz web con Tailwind CSS adaptada a PC
    ├── css/
    │   └── styles.css            # Estilos visuales, scrollbars y markdown
    └── js/
        ├── api.js                # Cliente HTTP frontend
        └── app.js                # Lógica reactiva de la aplicación
```

---

## ⚙️ Instalación y Puesta en Marcha

### 1. Clonar o acceder al proyecto
```bash
cd c:\Users\benja\Desktop\mbot
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar API Keys (Opcional en este paso)
Puedes definir tus claves en el archivo `.env`:
```env
PORT=3000
OPENAI_API_KEY=tu_clave_de_openai
DEEPSEEK_API_KEY=tu_clave_de_deepseek
```
*Nota: También puedes ingresar tus claves de forma interactiva en la interfaz web haciendo clic en **⚙️ Ajustes API** o mediante la herramienta MCP `set_api_keys`.*

### 4. Iniciar el servidor web
```bash
npm run dev
```

Visita en tu navegador:
👉 **`http://localhost:3000`**

### 5. Iniciar el servidor MCP (Para agentes IA)
```bash
npm run mcp
```

---

## 🧠 Estructura de la Base de Datos SQLite

El archivo de base de datos se genera automáticamente en `database/bot.db` con el siguiente esquema relacional:

- **`bots`**: Guarda los perfiles (`id`, `name`, `avatar`, `role`, `type`, `provider`, `model`, `system_prompt`, `temperature`).
- **`conversations`**: Agrupa los hilos de chat por bot (`id`, `bot_id`, `title`).
- **`messages`**: Almacena cada interacción (`id`, `conversation_id`, `bot_id`, `role`, `content`, `context_used`).
- **`knowledge_documents`**: Almacena documentos de conocimiento para bots RAG (`id`, `bot_id`, `title`, `content`, `chunk_count`).
- **`knowledge_embeddings`**: Almacena cada fragmento de texto junto con su vector embedding en formato JSON (`id`, `doc_id`, `bot_id`, `chunk_index`, `chunk_text`, `embedding`, `token_count`).
- **`app_settings`**: Guarda configuraciones dinámicas como las API Keys (`key`, `value`).

---

## 🔌 Endpoints de la API REST

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/bots` | Lista todos los perfiles de bots |
| `POST` | `/api/bots` | Crea un nuevo perfil con identidad propia |
| `PUT` | `/api/bots/:id` | Actualiza la identidad o prompt del bot |
| `DELETE` | `/api/bots/:id` | Elimina un bot y sus datos asociados |
| `POST` | `/api/chat` | Envía un mensaje y procesa memoria (Simple o RAG) con traza de ejecución |
| `GET` | `/api/conversations/:id/messages` | Recupera el historial de una conversación |
| `DELETE` | `/api/conversations/:id` | Limpia la memoria de una conversación |
| `GET` | `/api/bots/:id/knowledge` | Obtiene los documentos indexados de un bot |
| `POST` | `/api/bots/:id/knowledge` | Añade y vectoriza un documento con OpenAI |
| `DELETE` | `/api/knowledge/:id` | Elimina un documento y sus vectores |
| `POST` | `/api/bots/:id/knowledge/test-search` | Prueba similitud de coseno en tiempo real |
| `GET` | `/api/settings` | Obtiene el estado de las API Keys |
| `POST` | `/api/settings` | Guarda o actualiza claves de OpenAI / DeepSeek |
