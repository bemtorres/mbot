# 🤖 MBot Studio - Chatbots con Perfil, Identidad y Memoria SQLite

Plataforma completa desarrollada en **Node.js** para la creación y gestión de chatbots con **perfil propio e identidad configurable**, respaldados por una base de datos **SQLite**.

El sistema integra dos arquitecturas de memoria distintas, conexión con **OpenAI** y **DeepSeek**, y una interfaz web moderna diseñada con **Tailwind CSS**.

---

## 🚀 Características Principales

### 1. Perfiles e Identidad Personalizada
- Cada bot tiene su propia identidad: **Nombre, Avatar (emoji/icono), Rol/Especialidad, Tono y System Prompt (Instrucciones de Identidad)**.
- Ajuste de **Temperatura** (creatividad vs precisión).
- Selector de proveedor LLM: **OpenAI** (`gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo`) o **DeepSeek** (`deepseek-chat`, `deepseek-reasoner`).

### 2. Dos Tipos de Memoria

#### 📝 Bot Tipo 1: Memoria de Texto Simple (Historial Conversacional)
- **Persistencia en SQLite**: Todos los mensajes se guardan en la tabla `messages`.
- **Contexto Directo**: Al enviar una pregunta, el servidor recupera los últimos mensajes de la conversación y los ensambla cronológicamente junto al prompt de identidad.
- **Sin Embeddings**: Mantiene coherencia y seguimiento temático de forma inmediata y económica.
- *Bot preconfigurado de ejemplo*: **Alex**.

#### 🧠 Bot Tipo 2: Memoria RAG Avanzada con Embeddings (Base de Conocimiento)
- **Fragmentación (Chunking)**: Divide documentos y textos extensos en bloques de ~450 caracteres con solapamiento (*overlap*).
- **Embeddings con OpenAI**: Utiliza el modelo oficial `text-embedding-3-small` (1536 dimensiones) para calcular los vectores numéricos.
- **Almacenamiento Vectorial en SQLite**: Los vectores y metadatos se indexan en la tabla `knowledge_embeddings`.
- **Búsqueda Semántica por Similitud de Coseno**: Cuando el usuario hace una pregunta, se genera el vector de la consulta con OpenAI y se calculan las similitudes en SQLite en tiempo real, recuperando los fragmentos más relevantes para inyectarlos al LLM junto con el historial.
- **Inspección en Chat**: En la interfaz, cada respuesta del bot RAG incluye un acordeón desplegable que muestra las fuentes exactas y el porcentaje de similitud utilizado.
- *Bot preconfigurado de ejemplo*: **Sophia**.

### 3. Modelos y Proveedores Soportados
- **Chat:**
  - **OpenAI:** `gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo`.
  - **DeepSeek:** `deepseek-chat` (DeepSeek-V3), `deepseek-reasoner` (DeepSeek-R1).
- **Embeddings:**
  - **OpenAI:** `text-embedding-3-small` (obligatorio para la memoria vectorial).

### 4. Interfaz Web con Tailwind CSS
- Tema oscuro moderno con efectos de *glassmorphism*.
- Sidebar con selector de bots, contadores de documentos e indicadores de estado.
- Chat con renderizado de Markdown completo (listas, negritas, bloques de código, citas).
- Modal de **Identidad de Bot**: crea nuevos bots o edita su System Prompt y parámetros.
- Modal de **Base de Conocimiento RAG**:
  - Listado de documentos y cantidad de fragmentos indexados.
  - Formulario para añadir nuevos textos con auto-vectorización.
  - **Pestaña de prueba semántica**: Permite probar cualquier consulta y ver la similitud de coseno en tiempo real con barras de progreso.
- Modal de **Ajustes de API**: Configura tus API Keys de OpenAI y DeepSeek directamente desde el navegador (se guardan de forma segura en SQLite).

---

## 🛠️ Tecnologías Utilizadas

- **Entorno de Ejecución:** Node.js v24 (con soporte nativo para ES Modules y `node:sqlite`).
- **Servidor Web:** Express v5 + CORS.
- **Base de Datos:** SQLite (`node:sqlite DatabaseSync`) con WAL mode activado.
- **SDKs:** OpenAI Official SDK (usado tanto para OpenAI como para el endpoint compatible de DeepSeek).
- **Frontend:** HTML5, Vanilla JavaScript reactivo, Tailwind CSS, Lucide Icons y Marked.js.

---

## 📂 Estructura del Proyecto

```
mbot/
├── .env.example              # Plantilla de variables de entorno
├── .env                      # Configuración local (API Keys y puertos)
├── package.json              # Scripts y dependencias
├── database/
│   ├── bot.db                # Archivo de base de datos SQLite (auto-generado)
│   └── db.js                 # Inicialización de tablas y sembrado de bots
├── src/
│   ├── server.js             # Servidor Express y despacho estático
│   ├── services/
│   │   ├── botService.js       # Orquestador de memoria, perfiles y chat
│   │   ├── llmService.js       # Cliente unificado OpenAI & DeepSeek
│   │   ├── embeddingService.js # Generación de vectores con OpenAI
│   │   ├── vectorService.js    # Chunking y similitud de coseno
│   │   └── settingsService.js  # Gestión de API Keys en SQLite/.env
│   └── routes/
│       ├── botRoutes.js        # Endpoints CRUD de bots y conversaciones
│       ├── chatRoutes.js       # Endpoints de mensajes y chat
│       ├── knowledgeRoutes.js  # Endpoints de base de conocimiento RAG
│       └── settingsRoutes.js   # Endpoints de configuración de API Keys
└── public/
    ├── index.html            # Interfaz web con Tailwind CSS
    ├── css/
    │   └── styles.css        # Estilos visuales, scrollbars y markdown
    └── js/
        ├── api.js            # Cliente HTTP frontend
        └── app.js            # Lógica reactiva de la aplicación
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
*Nota: También puedes ingresar tus claves de forma interactiva en la interfaz web haciendo clic en **⚙️ Ajustes API**.*

### 4. Iniciar el servidor
```bash
npm start
```
O en modo desarrollo con auto-recarga:
```bash
npm run dev
```

### 5. Abrir en el navegador
Visita en tu navegador favorito:
👉 **`http://localhost:3000`**

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
| `POST` | `/api/chat` | Envía un mensaje y procesa memoria (Simple o RAG) |
| `GET` | `/api/conversations/:id/messages` | Recupera el historial de una conversación |
| `DELETE` | `/api/conversations/:id` | Limpia la memoria de una conversación |
| `GET` | `/api/bots/:id/knowledge` | Obtiene los documentos indexados de un bot |
| `POST` | `/api/bots/:id/knowledge` | Añade y vectoriza un documento con OpenAI |
| `DELETE` | `/api/knowledge/:id` | Elimina un documento y sus vectores |
| `POST` | `/api/bots/:id/knowledge/test-search` | Prueba similitud de coseno en tiempo real |
| `GET` | `/api/settings` | Obtiene el estado de las API Keys |
| `POST` | `/api/settings` | Guarda o actualiza claves de OpenAI / DeepSeek |
