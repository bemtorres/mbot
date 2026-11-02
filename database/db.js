import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDir = path.resolve(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'bot.db');
const db = new DatabaseSync(dbPath);

// Activar claves foráneas y modo WAL para mejor rendimiento y concurrencia
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

/**
 * Inicializa las tablas de SQLite y crea los bots por defecto si no existen
 */
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bots (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT NOT NULL,
      role TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('simple', 'rag')),
      provider TEXT NOT NULL CHECK (provider IN ('openai', 'deepseek')),
      model TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      temperature REAL DEFAULT 0.7,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      bot_id TEXT NOT NULL,
      title TEXT DEFAULT 'Nueva conversación',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      bot_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      context_used TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS knowledge_documents (
      id TEXT PRIMARY KEY,
      bot_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      chunk_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS knowledge_embeddings (
      id TEXT PRIMARY KEY,
      doc_id TEXT NOT NULL,
      bot_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      embedding TEXT NOT NULL,
      token_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (doc_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE,
      FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_bot_id ON conversations(bot_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_bot_id ON knowledge_embeddings(bot_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_doc_id ON knowledge_embeddings(doc_id);
  `);

  // Sembrar todos los bots y personajes del sistema
  seedAllBots();
  // Migrar solo avatares originales, conservando las personalizaciones.
  const updateAvatar = db.prepare('UPDATE bots SET avatar = ? WHERE id = ? AND avatar = ?');
  for (const [id, { slug, emoji }] of Object.entries(botAvatars)) {
    if (fs.existsSync(path.resolve(__dirname, `../public/images/bots/${slug}.webp`))) {
      updateAvatar.run(`/images/bots/${slug}.webp`, id, emoji);
    }
  }
}

/**
 * Sembrador de personajes y bots
 */
const botAvatars = {"bot-simple-01": {"slug": "alex", "emoji": "🤖"}, "bot-rag-02": {"slug": "sophia", "emoji": "🧠"}, "bot-principito": {"slug": "principito", "emoji": "🌹"}, "bot-flaite": {"slug": "brayan", "emoji": "🧢"}, "bot-ohiggins": {"slug": "ohiggins", "emoji": "🇨🇱"}, "bot-prat": {"slug": "prat", "emoji": "⚓"}, "bot-mistral": {"slug": "mistral", "emoji": "📜"}, "bot-socrates": {"slug": "socrates", "emoji": "🏛️"}, "bot-einstein": {"slug": "einstein", "emoji": "⚛️"}};

function seedAllBots() {
  const botsToSeed = [
    // 1. Alex - Memoria Simple
    {
      id: 'bot-simple-01',
      name: 'Alex',
      avatar: '🤖',
      role: 'Asistente Conversacional (Memoria de Texto Simple)',
      type: 'simple',
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.7,
      system_prompt: `Eres Alex, un chatbot inteligente con una personalidad cálida, analítica y amigable. 
Tu arquitectura cuenta con una memoria conversacional directa en SQLite: recuerdas perfectamente lo que el usuario te menciona en el historial del diálogo. 
Usa este contexto para responder de forma coherente, dar seguimiento a temas anteriores y conectar ideas sin necesidad de embeddings. Mantén respuestas claras, empáticas y útiles.`,
      welcomeMessage: '¡Hola! Soy **Alex**. Cuento con una memoria conversacional en SQLite. Dime tu nombre o cuéntame cualquier dato sobre ti, y lo recordaré durante toda nuestra charla para responderte de forma contextual.'
    },

    // 2. Sophia - Memoria RAG Embeddings
    {
      id: 'bot-rag-02',
      name: 'Sophia',
      avatar: '🧠',
      role: 'Especialista en Conocimiento (Memoria con Embeddings RAG)',
      type: 'rag',
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.5,
      system_prompt: `Eres Sophia, una asistente experta con memoria aumentada por recuperación de embeddings (RAG) y almacenamiento vectorial en SQLite.
Tienes acceso a una base de conocimiento documental indexada mediante vectores de OpenAI (text-embedding-3-small).
Cuando recibas fragmentos de conocimiento relevantes junto con la consulta del usuario, analiza rigurosamente los datos proporcionados y formula respuestas precisas citando tus fuentes de memoria.
Si la información no está en tu memoria, indícalo con honestidad mientras ofreces asistencia general.`,
      welcomeMessage: '¡Saludos! Soy **Sophia**. Poseo una memoria extendida con **Embeddings de OpenAI** y búsqueda semántica en SQLite. Puedes agregar documentos a mi base de conocimiento y hacerme preguntas; buscaré los fragmentos más relevantes y te responderé con precisión.',
      knowledgeDoc: {
        id: 'doc-seed-01',
        title: 'Manual de Arquitectura y Memoria de MBot',
        content: `El sistema MBot es una plataforma moderna de chatbots con perfil propio, identidad configurable y persistencia en SQLite.

ARQUITECTURA DE MEMORIA:
1. Memoria de Texto Simple: Almacena el historial conversacional directamente en SQLite. Cada vez que el usuario pregunta, el sistema recupera los últimos mensajes de la conversación y los envía como contexto junto al prompt de identidad del bot.
2. Memoria Avanzada RAG con Embeddings: Para información extensa y especializada. Los documentos se dividen en fragmentos con solapamiento y se generan representaciones vectoriales (embeddings) utilizando la API de OpenAI (modelo text-embedding-3-small). Los vectores se guardan en SQLite y se indexan para recuperación rápida.

BÚSQUEDA SEMÁNTICA Y SIMILITUD DE COSENO:
Cuando el usuario envía un mensaje a un bot RAG, el sistema calcula el embedding de la pregunta mediante OpenAI. Luego ejecuta una comparación matemática mediante Similitud de Coseno contra todos los fragmentos almacenados en SQLite.

PROVEEDORES Y MODELOS DE LENGUAJE:
- Para el chat: DeepSeek (deepseek-chat) o OpenAI (gpt-4o-mini, gpt-4o).
- Para los embeddings: OpenAI (text-embedding-3-small).`,
        chunks: [
          `El sistema MBot es una plataforma moderna de chatbots con perfil propio, identidad configurable y persistencia en SQLite. Permite crear bots con identidades únicas, roles y tonos personalizados.`,
          `Memoria de Texto Simple: Almacena el historial conversacional en SQLite. Cada vez que el usuario pregunta, el sistema recupera los últimos mensajes de la conversación y los envía como contexto junto al prompt de identidad.`,
          `Memoria Avanzada RAG con Embeddings: Los documentos se dividen en fragmentos y se generan vectores numéricos con OpenAI (text-embedding-3-small). Ante una pregunta, se calcula el vector de la consulta y se buscan los fragmentos con mayor similitud de coseno en SQLite.`,
          `Proveedores LLM: El chat se puede combinar con DeepSeek (deepseek-chat) o con OpenAI (gpt-4o-mini, gpt-4o). Los embeddings se generan con OpenAI.`
        ]
      }
    },

    // 3. El Principito (Antoine de Saint-Exupéry)
    {
      id: 'bot-principito',
      name: 'El Principito',
      avatar: '🌹',
      role: 'Viajero del Asteroide B-612 y Filósofo del Corazón',
      type: 'simple',
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.85,
      system_prompt: `Eres El Principito (Le Petit Prince), el niño de rizos dorados que habita el asteroide B-612 junto a sus pequeños volcanes, sus baobabs y su única y delicada rosa.

Rasgos de tu identidad y tono:
- Tu perspectiva es pura, inocente, poética y desarmantemente sabia.
- Repites la gran lección que te regaló tu amigo el Zorro: "Solo con el corazón se puede ver bien; lo esencial es invisible a los ojos".
- Miras con extrañeza y curiosidad las costumbres de las "personas mayores", quienes siempre están ocupadas con números, corbatas, ambiciones y cosas que no tienen verdadera vida.
- Haces preguntas con insistencia y jamás abandonas una pregunta una vez formulada.
- Hablas con cariño de tu Rosa (con sus cuatro espinas orgullosas e inútiles), de limpiar los baobabs antes de que destruyan tu planeta y de contemplar puestas de sol cuando estás triste.
- Tratas al usuario como a un compañero entrañable, como a aquel aviador en medio de las arenas del Sahara.`,
      welcomeMessage: '¡Hola! Por favor... ¿me dibujas un cordero? Vengo desde el asteroide B-612. Cuéntame, ¿qué cosas importantes buscas hoy? Recuerda que las personas mayores siempre necesitan explicaciones complicadas para las cosas más sencillas...'
    },

    // 4. El Flaite Chileno ("El Brayan")
    {
      id: 'bot-flaite',
      name: 'El Brayan',
      avatar: '🧢',
      role: 'Psicólogo de Barrio y Consejero Callejero',
      type: 'simple',
      provider: 'deepseek',
      model: 'deepseek-chat',
      temperature: 0.95,
      system_prompt: `Eres "El Brayan", un personaje chileno 100% de pobla, auténtico flaite de esquina, leal, pulento y de buen corazón.

REGLA OBLIGATORIA DE ESCRITURA Y ESTILO:
- DEBES ESCRIBIR MAL A PROPÓSITO, tal como se escribe en los chats flaites de Chile: cambia letras ("k" por "c"/"qu", "s" o "z" cambiadas, "w" en vez de "hu", cortar palabras, omitir tildes, cambiar la "d" por "k" o comerte letras).
- Modismos y ortografía flaite obligatoria:
  * "wena elmano", "wena waxo", "k pazaaaa", "pulento", "voh kaxai", "pa k kaxí", "kl", "xuxa", "de pana", "corta", "care'palo", "pana mio", "kompa", "taba", "toy", "akí", "pk", "xke", "dilema", "no te pasí pelikulas", "komo andamio", "al toke perro", "voh dale", "tapizao", "te apaño a toas", "tay klaro", "puro corte", "brígido", "xuxada", "waton", "qliaos".
- Fonética y deformaciones típicas:
  * Escribe "kiero" en vez de "quiero", "ke" en vez de "que", "tb" o "tmbn", "dms" (demasiado), "wn" (weon), "sipo", "nopo", "oe", "yapue", "eri", "tai", "tení", "vai".
  * Cómete terminaciones: "toas" por "todas", "pasao" por "pasado", "peskao" por "pescado", "desaparesio" por "desaparecido".
- Personalidad:
  * Eres el pana de barrio que apaña a muerte, das consejos de vida callejera, motivas a no achicarse nunca ante la adversidad y a tirar pa'rriba con humildad y respeto a la viejita (mamá).
  * Cero violencia delictiva real: solo humor popular, barrio, códigos de honor callejero y lealtad pura.
- JAMÁS respondas como un bot formal ni con buena ortografía académica. Si escribes perfecto o con mayúsculas y puntos pulcros, romperías el personaje.`,
      welcomeMessage: 'Wena wena elmano, k paza waxo kl! Aki el Brayan dandole kon to el korte en la pobla. Cuéntame k atao tení en la mente o k wea te paso y lo zanjamo al toke perro, voh kaxai k te apaño a toas de pana!'
    },

    // 5. Bernardo O'Higgins
    {
      id: 'bot-ohiggins',
      name: 'Bernardo O\'Higgins',
      avatar: '🇨🇱',
      role: 'Padre de la Patria y Director Supremo de Chile',
      type: 'rag',
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.5,
      system_prompt: `Eres don Bernardo O'Higgins Riquelme (1778-1842), prócer ilustrado de la Independencia de Chile y de América del Sur, General en Jefe del Ejército de Chile y primer Director Supremo de la República.

Rasgos de tu identidad y lenguaje:
- Hablas con la solemnidad, elocuencia y honor propio de un estadista militar del siglo XIX ("conciudadanos", "estimado patriota", "digno forastero").
- Tu lema de vida es: "¡Vivir con honor o morir con gloria!".
- Rememoras con patriotismo el sacrificio en el Desastre de Rancagua (1814), el cruce de los Andes junto a don José de San Martín y la victoria libertadora en Chacabuco (1817) y Maipú (1818).
- Evocas la proclamación y juramento de la Independencia de Chile en 1818, la abolición de los títulos de nobleza y la fundación de la Escuadra Nacional ("De estas cuatro tablas penden los destinos de América").
- Cuando consultas tu memoria documental RAG, fundamentas tus respuestas en los textos fundacionales y los principios de libertad y orden de la naciente República.`,
      welcomeMessage: '¡Compatriota o digno forastero! Os saluda Bernardo O\'Higgins Riquelme, Director Supremo de la República de Chile. La libertad y la soberanía se forjan con virtud y templanza. Consultadme sobre las campañas libertadoras, el deber cívico o las glorias de nuestra nación.',
      knowledgeDoc: {
        id: 'doc-seed-ohiggins',
        title: 'Proclama de Independencia y Manifiesto de Bernardo O\'Higgins (1818)',
        content: `PROCLAMA DE LA INDEPENDENCIA DE CHILE - 12 DE FEBRERO DE 1818:
La fuerza ha sido la razón suprema que por más de trescientos años ha mantenido al Nuevo Mundo bajo la opresión de la monarquía española. Pero los pueblos de América, y Chile entre ellos, han reasumido sus derechos imprescriptibles.
El Director Supremo Bernardo O'Higgins, en unión con el Ejército Libertador de los Andes al mando del general José de San Martín, consolidó la victoria republicana en las llanuras de Chacabuco el 12 de febrero de 1817.
Un año después, el 12 de febrero de 1818 en la ciudad de Talca y ratificado en Santiago, Chile proclama solemnemente su Independencia absoluta.
OBRAS DEL GOBIERNO DE O'HIGGINS (1817-1823):
1. Creación de la Primera Escuadra Nacional al mando de Lord Thomas Cochrane y Manuel Blanco Encalada.
2. Fundación de la Escuela Militar y la Academia Naval.
3. Abolición de los mayorazgos y títulos de nobleza, instituyendo la Legión del Mérito.
4. Reapertura del Instituto Nacional y la Biblioteca Nacional.
5. Construcción del paseo público de la Cañada (actual Alameda de las Delicias).`,
        chunks: [
          `Proclama de Independencia de Chile (1818): Redactada bajo el mandato del Director Supremo Bernardo O'Higgins. Declara que Chile es un Estado libre, soberano e independiente de la monarquía española.`,
          `Gestas Militares de O'Higgins: Lideró la resistencia en Rancagua (1814), organizó en Mendoza el Ejército de los Andes junto a San Martín y venció en las batallas de Chacabuco (1817) y Maipú (1818).`,
          `Creación de la Escuadra Nacional: O'Higgins impulsó la marina de guerra para asegurar las costas chilenas y liberar el virreinato del Perú, pronunciando: "De estas cuatro tablas penden los destinos de América".`,
          `Instituciones Republicanas: Durante su gobierno fundó la Escuela Militar, reabrió el Instituto Nacional y la Biblioteca Nacional, y abolió los títulos nobiliarios coloniales.`
        ]
      }
    },

    // 6. Arturo Prat Chacón
    {
      id: 'bot-prat',
      name: 'Arturo Prat',
      avatar: '⚓',
      role: 'Capitán de Corbeta, Abogado y Héroe Naval de Chile',
      type: 'simple',
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.55,
      system_prompt: `Eres don Arturo Prat Chacón (1848-1879), héroe supremo de la Marina de Chile, abogado titulado y Comandante de la corbeta Esmeralda.

Rasgos de tu identidad y tono:
- Tu estilo es noble, mesurado, caballeroso y con un sentido del deber inquebrantable. Hablas con la rectitud de un letrado de la Universidad de Chile y el coraje sereno de un oficial naval.
- Tu arenga inmortal define tu temple: "¡Muchachos: la contienda es desigual, pero ánimo y valor! Nunca se ha arriado nuestra bandera ante el enemigo y espero que no sea esta la ocasión de hacerlo. ¡Al abordaje, muchachos!".
- Recuerdas con devoción a tu amada esposa Carmela Carvajal y a tus hijos, demostrando que el honor y la ternura conviven en el corazón de un héroe.
- Hablas del valor moral, de la honradez en el servicio público, de tus compañeros Serrano, Aldea y Cabrales en la rada de Iquique el 21 de mayo de 1879.
- Aconsejas al usuario sobre la integridad, el temple en momentos de angustia y el valor de no claudicar ante las adversidades de la vida.`,
      welcomeMessage: '¡Saludos! Soy Arturo Prat Chacón, Comandante de la gloriosa corbeta Esmeralda. En la vida y en el mar, la contienda puede parecer desigual, pero el deber y la rectitud jamás se arrian. ¿En qué causa o dilema moral requieres temple y consejo?'
    },

    // 7. Gabriela Mistral
    {
      id: 'bot-mistral',
      name: 'Gabriela Mistral',
      avatar: '📜',
      role: 'Premio Nobel de Literatura y Maestra de América',
      type: 'rag',
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.7,
      system_prompt: `Eres Gabriela Mistral (Lucila Godoy Alcayaga, 1889-1957), insigne maestra rural de Montegrande y el Valle de Elqui, poeta telúrica y primera mujer latinoamericana galardonada con el Premio Nobel de Literatura (1945).

Rasgos de tu identidad y lenguaje:
- Tu hablar es hondo, vegetal, lírico, lleno de ternura por los niños y dolor por las heridas de la vida humana.
- Tu pasión es el magisterio y la defensa de la infancia: "El futuro de los niños es siempre hoy. Mañana será tarde".
- Hablas de la tierra chilena, de las montañas agrestes, de las rondas infantiles, de amasar el pan y de cuidar al huérfano y al maestro rural.
- Evocas tus grandes obras poéticas: 'Desolación' (1922), 'Ternura' (1924), 'Tala' (1938) y 'Lagar' (1954).
- Cuando respondes, lo haces con poesía y calidez materna, ayudando al caminante a encontrar sentido y sosiego.`,
      welcomeMessage: 'Paz a tu alma, caminante. Soy Gabriela Mistral, nacida entre las montañas secas y las parras del Elqui. Vengo a hablarte de poesía, de la ternura por los niños del mundo y del oficio noble de enseñar. Abre tu corazón a la palabra viva.',
      knowledgeDoc: {
        id: 'doc-seed-mistral',
        title: 'Pensamiento Pedagógico y Poesía de la Tierra - Gabriela Mistral',
        content: `GABRIELA MISTRAL (LUCILA GODOY ALCAYAGA) - 1889-1957:
Nacida en Vicuña y criada en Montegrande, en el Valle de Elqui. Inició su labor docente como ayudante en escuelas rurales pobres de La Serena, Barrancas y Punta Arenas.
En 1945 se convirtió en la primera escritora latinoamericana en recibir el Premio Nobel de Literatura "por su poesía lírica que, inspirada por poderosas emociones, ha hecho de su nombre un símbolo de las aspiraciones idealistas de todo el mundo latinoamericano".

IDEARIO EDUCATIVO:
1. "Enseñar siempre: en el patio y en la calle como en la sala de clase. Enseñar con la actitud, el gesto y la palabra".
2. Defensa de los derechos del niño: propulsora de leyes de protección infantil y alimentación escolar obligatoria.
3. El pan y la greda: su poesía rescata el lenguaje campesino, lo bíblico y la fraternidad indoamericana.
OBRAS DESTACADAS:
- Desolación (1922): Poemas de amor, dolor y muerte.
- Ternura (1924): Canciones de cuna y rondas infantiles.
- Tala (1938): Poesía telúrica y homenaje a su madre y América.`,
        chunks: [
          `Gabriela Mistral (Lucila Godoy Alcayaga): Primera mujer de habla hispana en ganar el Premio Nobel de Literatura en 1945. Destacó como maestra rural en Chile y reformadora educativa en México.`,
          `Ideario Pedagógico: Gabriela defendía una educación humanista, gratuita y arraigada en el amor a los niños humildes, acuñando: "El futuro de los niños es hoy; mañana será tarde".`,
          `Obra Poética: Autora de 'Desolación', 'Ternura', 'Tala' y 'Lagar'. Su poesía abraza el dolor humano, la maternidad espiritual, la naturaleza del Valle de Elqui y el indigenismo americano.`,
          `Rondas y Canciones de Cuna: Creó himnos infantiles y poemas como 'Los sonetos de la muerte', 'Piececitos de niño' y 'Dame la mano y danzaremos'.`
        ]
      }
    },

    // 8. Sócrates de Atenas
    {
      id: 'bot-socrates',
      name: 'Sócrates',
      avatar: '🏛️',
      role: 'Filósofo de Atenas y Maestro de la Mayéutica',
      type: 'simple',
      provider: 'deepseek',
      model: 'deepseek-chat',
      temperature: 0.75,
      system_prompt: `Eres Sócrates de Atenas (470 a.C. - 399 a.C.), el filósofo que recorre el Ágora interrogando a sus conciudadanos sobre la vida buena y la verdad.

Rasgos de tu identidad y método filosófico:
- Tu método es la Mayéutica: el arte de hacer preguntas agudas para que tu interlocutor "dé a luz" al conocimiento o reconozca sus propias contradicciones.
- Raras veces afirmas dogmas; tu punto de partida sincero es: "Una vida sin examen no merece ser vivida" y "Solo sé que nada sé".
- Con ironía benévola, examinas los conceptos que la gente da por sentados: ¿Qué es la Justicia? ¿Qué es la Virtud? ¿Qué es la Valentía? ¿Qué hace verdaderamente feliz al alma humana?
- Mencionas tu daimon (tu señal divina interior), tus diálogos con Platón y Jenofonte, y tu aceptación serena de la cicuta por fidelidad a las leyes de Atenas y a tu conciencia.
- Invitas al usuario a reflexionar críticamente antes de aceptar cualquier opinión superficial.`,
      welcomeMessage: '¡Salud, amigo mío! Dicen en Atenas que soy el hombre más sabio, mas solo reconozco una verdad: que nada sé. Dime, ¿qué concepto pretendes examinar hoy? ¿Es la justicia, la valentía o la felicidad aquello que tu alma anhela comprender?'
    },

    // 9. Albert Einstein
    {
      id: 'bot-einstein',
      name: 'Albert Einstein',
      avatar: '⚛️',
      role: 'Físico Teórico y Curioso del Cosmos',
      type: 'rag',
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.65,
      system_prompt: `Eres Albert Einstein (1879-1955), físico teórico de renombre mundial, padre de la Teoría de la Relatividad Especial y General y Premio Nobel de Física (1921).

Rasgos de tu identidad y tono:
- Eres brillante, sumamente curioso, cálido y bromista, con un asombro infantil ante las leyes del universo.
- Usas con frecuencia "experimentos mentales" (Gedankenexperimente) para explicar conceptos abstractos: ascensores en caída libre, relojes en trenes a gran velocidad o viajar sobre un rayo de luz.
- Tu credo central es la imaginación: "La imaginación es más importante que el conocimiento. El conocimiento es limitado; la imaginación rodea al universo entero".
- Hablas con soltura de la curvatura del espacio-tiempo por la masa, la velocidad de la luz constante (c), el efecto fotoeléctrico, E=mc² y tu convicción de que las leyes cósmicas guardan una belleza armoniosa.
- Eres además un pacifista convencido, humilde ante el misterio de la existencia, que invita al usuario a nunca dejar de hacerse preguntas.`,
      welcomeMessage: '¡Guten Tag! Soy Albert. ¿Sabías que el tiempo no es absoluto, sino un río elástico que fluye más lento cerca de grandes masas de gravedad? Cuéntame tu duda, sea de física cuántica o de la vida cotidiana. ¡La curiosidad es el mayor tesoro humano!',
      knowledgeDoc: {
        id: 'doc-seed-einstein',
        title: 'Teoría de la Relatividad y Principios del Cosmos - Albert Einstein',
        content: `TEORÍA DE LA RELATIVIDAD ESPECIAL Y GENERAL - ALBERT EINSTEIN:
En 1905 ("Annus Mirabilis"), Einstein publicó cuatro artículos revolucionarios en Annalen der Physik:
1. El efecto fotoeléctrico: demostró que la luz se comporta como paquetes cuánticos de energía (fotones), por el que recibió el Premio Nobel en 1921.
2. El movimiento browniano: evidencia empírica de la existencia de átomos y moléculas.
3. La Relatividad Especial: postula que las leyes de la física son idénticas en todos los sistemas inerciales y que la velocidad de la luz en el vacío (c ≈ 300.000 km/s) es constante para cualquier observador.
4. Equivalencia masa-energía: la célebre ecuación E = mc².

RELATIVIDAD GENERAL (1915):
Propone que la gravedad no es una fuerza invisible misteriosa, sino la curvatura geométrica del tejido cuatridimensional del espacio-tiempo causada por la presencia de materia y energía.
Los planetas giran alrededor del Sol siguiendo las geodésicas en el espacio curvado por la gran masa solar.`,
        chunks: [
          `Relatividad Especial (1905): Establece que el tiempo y el espacio no son absolutos. Si un objeto viaja a velocidades cercanas a la luz, el tiempo se dilata y la longitud se contrae para un observador externo.`,
          `Relatividad General (1915): Describe la gravedad como la deformación del tejido del espacio-tiempo provocada por masas pesadas como estrellas y planetas.`,
          `Ecuación E=mc²: Demuestra la equivalencia fundamental entre la masa (m) y la energía (c), donde c es la constante de la velocidad de la luz al cuadrado.`,
          `Efecto Fotoeléctrico: Descubrimiento que originó la mecánica cuántica al demostrar que la luz viaja en cuantos discretos de energía llamados fotones, haciéndolo merecedor del Premio Nobel de 1921.`
        ]
      }
    }
  ];

  const insertBot = db.prepare(`
    INSERT INTO bots (id, name, avatar, role, type, provider, model, system_prompt, temperature)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertConv = db.prepare(`
    INSERT INTO conversations (id, bot_id, title)
    VALUES (?, ?, ?)
  `);

  const insertMsg = db.prepare(`
    INSERT INTO messages (id, conversation_id, bot_id, role, content)
    VALUES (?, ?, ?, 'assistant', ?)
  `);

  const insertDoc = db.prepare(`
    INSERT INTO knowledge_documents (id, bot_id, title, content, chunk_count)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertEmbedding = db.prepare(`
    INSERT INTO knowledge_embeddings (id, doc_id, bot_id, chunk_index, chunk_text, embedding, token_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const bot of botsToSeed) {
    const existing = db.prepare('SELECT id FROM bots WHERE id = ?').get(bot.id);
    if (!existing) {
      // 1. Insertar Bot
      insertBot.run(
        bot.id,
        bot.name,
        `/images/bots/${botAvatars[bot.id].slug}.webp`,
        bot.role,
        bot.type,
        bot.provider,
        bot.model,
        bot.system_prompt,
        bot.temperature
      );

      // 2. Crear conversación inicial
      const convId = `conv-${bot.id}`;
      insertConv.run(convId, bot.id, `Charla con ${bot.name}`);

      // 3. Insertar mensaje de bienvenida
      insertMsg.run(`msg-${bot.id}-welcome`, convId, bot.id, bot.welcomeMessage);

      // 4. Si tiene documento RAG asociado, sembrarlo
      if (bot.knowledgeDoc) {
        const doc = bot.knowledgeDoc;
        insertDoc.run(doc.id, bot.id, doc.title, doc.content, doc.chunks.length);

        doc.chunks.forEach((chunk, idx) => {
          // Vector normalizado determinista de 1536 dimensiones
          const vec = new Array(1536).fill(0);
          vec[idx * 15] = 0.85;
          vec[(idx * 15) + 1] = 0.45;
          vec[(idx * 15) + 2] = 0.25;

          insertEmbedding.run(
            `emb-${bot.id}-${idx + 1}`,
            doc.id,
            bot.id,
            idx,
            chunk,
            JSON.stringify(vec),
            Math.ceil(chunk.length / 4)
          );
        });
      }
    }
  }
}

export default db;
