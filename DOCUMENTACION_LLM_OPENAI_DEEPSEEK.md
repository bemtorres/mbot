# 🧠 Guía Técnica Universal: Arquitectura de Prompts, Memoria y LLMs (OpenAI & DeepSeek)

Esta guía explica **de forma directa, agnóstica e independiente de cualquier software específico**, cómo funcionan internamente los Modelos de Lenguaje (LLMs) como **OpenAI** y **DeepSeek**, cómo se gestiona su memoria y cómo interactuar con ellos mediante llamadas directas (cURL, SDK oficial de OpenAI en JavaScript y Python).

---

## 📌 1. El Principio Fundamental: Los LLMs son "Stateless" (Sin Estado)

Un modelo de lenguaje (`gpt-4o`, `gpt-4o-mini`, `deepseek-chat`, `deepseek-reasoner`) **no recuerda nada entre peticiones HTTP**. No sabe quién eres, qué le preguntaste en el mensaje anterior ni qué instrucciones le diste en una sesión previa.

> **Regla de oro:** Cada interacción con la API es una llamada aislada. Si deseas que el modelo recuerde su personalidad, hechos pasados o la conversación previa, **debes enviarle la historia completa en cada petición dentro del arreglo `messages`**.

---

## 🎭 2. La Estructura de Roles: `system`, `user` y `assistant`

La API de Chat Completions organiza la conversación en una lista de objetos, donde cada mensaje tiene un **rol**:

| Rol | Emisor | Propósito |
|---|---|---|
| `system` | Desarrollador / Sistema | Define la identidad, reglas, restricciones, tono, estilo y contexto de fondo del modelo. |
| `user` | Usuario humano | Preguntas, comandos o entradas enviadas al modelo. |
| `assistant` | El modelo LLM | Respuestas generadas previamente por el modelo (utilizadas para simular historial de conversación). |

### Ejemplo Conceptual:
```json
[
  { "role": "system", "content": "Eres un tutor socrático de matemáticas. No des respuestas directas, formula preguntas reflexivas." },
  { "role": "user", "content": "¿Por qué x^0 es igual a 1?" },
  { "role": "assistant", "content": "¿Qué sucede cuando divides una potencia entre sí misma, por ejemplo 2^3 / 2^3?" },
  { "role": "user", "content": "Da 8 / 8, que es 1. Y en leyes de exponentes se restan: 3 - 3 = 0." }
]
```

---

## ⚡ 3. Memoria de Corto Plazo (Historial Conversacional)

Para darle continuidad a una charla, el desarrollador guarda los turnos de conversación en una base de datos o en memoria y concatena los mensajes anteriores en la nueva llamada.

### Estrategia: Ventana Deslizante (*Sliding Window*)
Dado que los modelos tienen un límite de tokens de entrada (*Context Window*) y cobran por token procesado, no se suele enviar todo el historial infinito, sino los últimos $N$ mensajes (por ejemplo, los últimos 10 a 20 turnos).

```
[System Prompt (Fijo)]
  + [Historial Mensajes t-4 a t-1 (Ventana Deslizante)]
  + [Mensaje Actual del Usuario (t)]
  ---------------------------------------------------
  => Enviado a OpenAI / DeepSeek
```

---

## 🧠 4. Memoria de Largo Plazo: RAG (Retrieval-Augmented Generation)

Cuando la información supera el tamaño del prompt (libros, manuales, documentos de miles de páginas), no se puede enviar todo el texto en cada mensaje. Se utiliza **RAG**:

1. **Ingesta / Indexación (Offline):**
   - Se divide el documento en fragmentos pequeños (*chunks*, ej. 300-500 caracteres) con solapamiento (*overlap*, ej. 50 caracteres).
   - Se convierten los fragmentos en vectores numéricos (*embeddings*) con un modelo como `text-embedding-3-small`.
   - Se guardan los vectores en una base de datos vectorial o relacional.

2. **Recuperación y Aumento (En tiempo real de chat):**
   - Cuando el usuario pregunta algo, se vectoriza su pregunta.
   - Se calcula la similitud matemática (Coseno) entre la pregunta y los fragmentos guardados.
   - Se extraen los fragmentos más relevantes y se **inyectan en el mensaje `system`** antes de consultar a OpenAI o DeepSeek.

### Inyección de Contexto en el System Prompt:
```json
{
  "role": "system",
  "content": "Eres un asistente técnico de soporte.\n\n--- INFORMACIÓN DE CONOCIMIENTO RECUPERADA ---\n[Manual Cap. 4]: El código de error E-402 indica sobrecalentamiento del sensor térmico primario.\n--- FIN DEL CONOCIMIENTO ---\n\nResponde a la duda del usuario basándote en la información provista."
}
```

---

## 🌐 5. Compatibilidad Directa: OpenAI y DeepSeek

DeepSeek implementa una API **100% compatible con el estándar de OpenAI Chat Completions**. Esto significa que puedes usar el **mismo cliente y los mismos payloads JSON**, cambiando únicamente dos parámetros:

1. **`baseURL`**:
   - OpenAI: `https://api.openai.com/v1`
   - DeepSeek: `https://api.deepseek.com/v1` (o `https://api.deepseek.com`)
2. **`model`**:
   - OpenAI: `gpt-4o`, `gpt-4o-mini`
   - DeepSeek: `deepseek-chat` (V3), `deepseek-reasoner` (R1)

---

## 💻 6. Ejemplos Prácticos Directos

### A. Peticiones HTTP Directas con `curl`

#### 1. Llamada a OpenAI (`gpt-4o-mini`)
```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "messages": [
      {
        "role": "system",
        "content": "Eres un asistente conciso y analítico."
      },
      {
        "role": "user",
        "content": "Hola, me llamo Carlos."
      },
      {
        "role": "assistant",
        "content": "¡Hola Carlos! Un placer saludarte. ¿En qué te ayudo hoy?"
      },
      {
        "role": "user",
        "content": "¿Recuerdas mi nombre?"
      }
    ]
  }'
```

#### 2. Llamada a DeepSeek (`deepseek-chat`)
```bash
curl https://api.deepseek.com/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -d '{
    "model": "deepseek-chat",
    "temperature": 0.7,
    "messages": [
      {
        "role": "system",
        "content": "Eres un experto en ciberseguridad."
      },
      {
        "role": "user",
        "content": "Explica en dos líneas qué es un ataque Man-in-the-Middle."
      }
    ]
  }'
```

#### 3. Llamada a DeepSeek Reasoner (`deepseek-reasoner` / R1)
> El modelo R1 realiza razonamiento deliberado (*Chain of Thought*) antes de emitir la respuesta final.
```bash
curl https://api.deepseek.com/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -d '{
    "model": "deepseek-reasoner",
    "messages": [
      {
        "role": "user",
        "content": "¿Cuántas 'r' tiene la palabra 'strawberry' y explica paso a paso?"
      }
    ]
  }'
```

---

### B. Ejemplo en JavaScript / Node.js (Usando el SDK oficial `openai`)

El paquete oficial de NPM `openai` se utiliza para interactuar con ambos proveedores:

```javascript
import OpenAI from "openai";

// 1. Cliente para OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 2. Cliente para DeepSeek (mismo SDK, diferente baseURL y apiKey)
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com/v1"
});

// Función universal para conversar con memoria
async function conversar(client, modelo, historial, nuevoMensaje, contextoRAG = null) {
  const systemPrompt = contextoRAG
    ? `Eres un asistente experto.\n\nContexto:\n${contextoRAG}`
    : "Eres un asistente servicial y amigable.";

  const messages = [
    { role: "system", content: systemPrompt },
    ...historial,
    { role: "user", content: nuevoMensaje }
  ];

  const completion = await client.chat.completions.create({
    model: modelo,
    messages: messages,
    temperature: 0.7
  });

  const respuesta = completion.choices[0].message.content;
  
  // Si usas deepseek-reasoner, puedes obtener el razonamiento previo:
  const reasoning = completion.choices[0].message.reasoning_content;
  if (reasoning) {
    console.log("--- Razonamiento interno (CoT) ---:\n", reasoning);
  }

  return respuesta;
}

// Demostración de uso:
async function main() {
  const historial = [
    { role: "user", content: "Vivo en Valparaíso y me gusta el café." },
    { role: "assistant", content: "Valparaíso es una hermosa ciudad portuaria. ¿Qué tipo de café prefieres?" }
  ];

  // Ejecutando en OpenAI
  console.log("=== OpenAI gpt-4o-mini ===");
  const resOpenAI = await conversar(openai, "gpt-4o-mini", historial, "¿En qué ciudad vivo?");
  console.log("Respuesta:", resOpenAI);

  // Ejecutando en DeepSeek
  console.log("\n=== DeepSeek deepseek-chat ===");
  const resDeepSeek = await conversar(deepseek, "deepseek-chat", historial, "¿En qué ciudad vivo?");
  console.log("Respuesta:", resDeepSeek);
}

main().catch(console.error);
```

---

### C. Ejemplo en Python (Usando el SDK oficial `openai`)

```python
import os
from openai import OpenAI

# Cliente OpenAI
client_openai = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY")
)

# Cliente DeepSeek
client_deepseek = OpenAI(
    api_key=os.environ.get("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com"
)

def chat_con_memoria(client, model_name, historial, mensaje_usuario):
    messages = [
        {"role": "system", "content": "Eres un tutor conciso y pedagógico."},
        *historial,
        {"role": "user", "content": mensaje_usuario}
    ]

    response = client.chat.completions.create(
        model=model_name,
        messages=messages,
        temperature=0.7
    )
    
    # Manejo de contenido de razonamiento (en modelos como deepseek-reasoner)
    message = response.choices[0].message
    if hasattr(message, "reasoning_content") and message.reasoning_content:
        print(f"[Pensamiento previo]: {message.reasoning_content}\n")

    return message.content

# Historial previo simulado
historial_conversacion = [
    {"role": "user", "content": "Mi número favorito es el 42."},
    {"role": "assistant", "content": "El 42 es conocido como la respuesta al sentido de la vida, el universo y todo lo demás."}
]

# Prueba con OpenAI
print("OpenAI:")
print(chat_con_memoria(client_openai, "gpt-4o-mini", historial_conversacion, "¿Cuál es mi número favorito?"))

# Prueba con DeepSeek
print("\nDeepSeek:")
print(chat_con_memoria(client_deepseek, "deepseek-chat", historial_conversacion, "¿Cuál es mi número favorito?"))
```

---

## 📊 7. Comparativa de Modelos: OpenAI vs. DeepSeek

| Característica | OpenAI (`gpt-4o-mini` / `gpt-4o`) | DeepSeek (`deepseek-chat` / `deepseek-reasoner`) |
|---|---|---|
| **Base URL** | `https://api.openai.com/v1` | `https://api.deepseek.com/v1` |
| **SDK Soportado** | `openai` (Oficial) | Compatible con el SDK `openai` |
| **Embeddings** | `text-embedding-3-small` / `large` | Enfoque primario en Chat / Reasoning |
| **Modelo Rápido / Económico** | `gpt-4o-mini` | `deepseek-chat` (V3) |
| **Modelo de Razonamiento (CoT)** | `o1-mini` / `o3-mini` | `deepseek-reasoner` (R1) con campo `reasoning_content` |
| **Formato de Payload** | `messages: [{ role, content }]` | `messages: [{ role, content }]` (Idéntico) |
