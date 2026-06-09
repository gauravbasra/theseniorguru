/**
 * SLM Client — multi-provider local/managed inference.
 *
 * Routing priority (configured via env vars):
 *   1. Groq  — if SLM_PROVIDER=groq  (or GROQ_API_KEY is set)  → api.groq.com
 *   2. Ollama — if SLM_PROVIDER=ollama (default local dev)       → localhost:11434
 *   3. Any OpenAI-compatible endpoint — set OLLAMA_BASE_URL + SLM_API_KEY
 *
 * Quick start (Groq — free, no GPU needed):
 *   SLM_PROVIDER=groq
 *   GROQ_API_KEY=your_key_from_console.groq.com
 *   SLM_MODEL=llama-3.1-8b-instant          (optional, this is the default)
 *
 * Quick start (Ollama local):
 *   ollama pull phi3:mini
 *   SLM_PROVIDER=ollama  (or just omit — ollama is the fallback default)
 */

// ---------------------------------------------------------------------------
// Provider detection
// ---------------------------------------------------------------------------

const _SLM_PROVIDER = (process.env.SLM_PROVIDER || (process.env.GROQ_API_KEY ? "groq" : "ollama")).toLowerCase();
const _IS_GROQ = _SLM_PROVIDER === "groq";

// Groq defaults
const GROQ_BASE = "https://api.groq.com/openai";
const GROQ_DEFAULT_MODEL = "llama-3.1-8b-instant";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

// Ollama / generic OpenAI-compatible defaults
const OLLAMA_BASE = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");

// Resolved values used throughout
const SLM_BASE = _IS_GROQ ? GROQ_BASE : OLLAMA_BASE;
const SLM_MODEL = process.env.SLM_MODEL || (_IS_GROQ ? GROQ_DEFAULT_MODEL : "phi3:mini");
const SLM_API_KEY = _IS_GROQ ? GROQ_API_KEY : (process.env.SLM_API_KEY || "");
const SLM_TIMEOUT_MS = Number(process.env.SLM_TIMEOUT_MS || (_IS_GROQ ? 8000 : 12000));
const SLM_MAX_TOKENS = Number(process.env.SLM_MAX_TOKENS || 300);

// ---------------------------------------------------------------------------
// Availability check
// ---------------------------------------------------------------------------

// Simple in-process availability cache: re-probe at most every 30 s.
let _availableCache = null;
let _availableCachedAt = 0;
const AVAIL_CACHE_MS = 30_000;

async function slmAvailable() {
  const now = Date.now();
  if (_availableCache !== null && now - _availableCachedAt < AVAIL_CACHE_MS) {
    return _availableCache;
  }

  // Groq: just check that the API key is present — it's always "available" if keyed.
  if (_IS_GROQ) {
    const available = Boolean(GROQ_API_KEY);
    _availableCache = available;
    _availableCachedAt = now;
    if (!available) console.warn("slm: GROQ_API_KEY not set — SLM tier disabled");
    return available;
  }

  // Ollama: probe the local tags endpoint
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(2000)
    });
    if (!res.ok) { _availableCache = false; _availableCachedAt = now; return false; }
    const data = await res.json();
    const models = data.models || [];
    const prefix = SLM_MODEL.split(":")[0];
    const found = models.some(m => m.name === SLM_MODEL || m.name.startsWith(prefix + ":") || m.name === prefix);
    _availableCache = found;
    _availableCachedAt = now;
    return found;
  } catch {
    _availableCache = false;
    _availableCachedAt = now;
    return false;
  }
}

/** Invalidate the availability cache (e.g. after rotating keys or restarting Ollama). */
function resetSlmAvailabilityCache() {
  _availableCache = null;
  _availableCachedAt = 0;
}

// ---------------------------------------------------------------------------
// Core inference call
// ---------------------------------------------------------------------------

async function callSLM({ system, messages, temperature = 0.4, maxTokens }) {
  const headers = { "Content-Type": "application/json" };
  if (SLM_API_KEY) headers["Authorization"] = `Bearer ${SLM_API_KEY}`;

  // Groq uses the standard OpenAI body shape (no Ollama-specific "options" field)
  const body = _IS_GROQ
    ? {
        model: SLM_MODEL,
        messages: [{ role: "system", content: system }, ...messages],
        temperature,
        max_tokens: maxTokens || SLM_MAX_TOKENS,
        stream: false
      }
    : {
        model: SLM_MODEL,
        messages: [{ role: "system", content: system }, ...messages],
        stream: false,
        options: {
          temperature,
          num_predict: maxTokens || SLM_MAX_TOKENS,
          stop: ["\n\n\n", "###", "<|end|>", "<|im_end|>"]
        }
      };

  const res = await fetch(`${SLM_BASE}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SLM_TIMEOUT_MS)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`SLM request failed ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = (data.choices?.[0]?.message?.content || "").trim();
  return {
    provider: _IS_GROQ ? "groq" : "slm",
    model: SLM_MODEL,
    text,
    promptTokens: data.usage?.prompt_tokens || 0,
    completionTokens: data.usage?.completion_tokens || 0
  };
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

function buildGuruChatPrompt(context = {}) {
  const lines = [
    "You are Guru, a warm AI companion inside TheSeniorGuru.",
    "Respond in 1-3 short, calm sentences. Never diagnose conditions.",
    "For emergencies (chest pain, breathing trouble, fall, severe pain) always say: call 911 or press SOS.",
    "When you cannot help, say so simply and suggest who can.",
  ];
  const { residentName, community, medications = [], people = [], memories = [], calendarEvents = [] } = context;
  if (residentName) lines.push(`You are speaking with ${residentName}${community ? ` who lives at ${community}` : ""}.`);
  const pending = medications.filter(m => m.status !== "taken");
  if (pending.length) lines.push(`Pending medications today: ${pending.map(m => m.name).join(", ")}.`);
  if (people.length) lines.push(`Trusted circle: ${people.slice(0, 4).map(p => p.name).join(", ")}.`);
  if (memories.length) lines.push(`Memory notes: ${memories.slice(0, 3).map(m => m.value || m.title).filter(Boolean).join("; ")}.`);
  if (calendarEvents?.length) lines.push(`Next appointment: ${calendarEvents[0].title} at ${calendarEvents[0].startsAt}.`);
  return lines.join("\n");
}

function buildWellnessPrompt(vitals = {}, context = {}) {
  return [
    "You are a senior wellness advisor. Write 2 warm, plain-English sentences about today's health snapshot.",
    "Highlight what is going well, then give one gentle, actionable suggestion. Do not diagnose.",
    "Health snapshot: " + JSON.stringify(vitals).slice(0, 600),
    context.residentName ? `Person: ${context.residentName}.` : ""
  ].filter(Boolean).join("\n");
}

function buildSafetyPrompt(safetySignal = {}, context = {}) {
  return [
    "You are a senior safety advisor. Write 1-2 clear, calm sentences in response to this safety signal.",
    "For SOS or fall events always include: contact emergency services or press SOS immediately.",
    "Signal: " + JSON.stringify(safetySignal).slice(0, 400),
    context.residentName ? `Resident: ${context.residentName}.` : ""
  ].filter(Boolean).join("\n");
}

function buildWeatherPrompt(weatherData = {}, context = {}) {
  return [
    "You are a senior wellness advisor. Write 1-2 practical sentences about how today's weather or air quality affects a senior.",
    "Mention any precautions (hat, sunscreen, mask, hydration). Do not diagnose.",
    "Weather data: " + JSON.stringify(weatherData).slice(0, 400),
    context.residentName ? `Person: ${context.residentName}.` : ""
  ].filter(Boolean).join("\n");
}

function buildIntentClassifyPrompt() {
  return [
    "Classify the message below into exactly one intent. Reply with JSON only — no explanation.",
    'Format: {"intent":"<intent>","confidence":<0.0-1.0>}',
    "Valid intents: task, medication, ride, companion, services, safety, memory, calendar, music, scan,",
    "  environment, daily_status, family, location, health_summary, complex_reasoning, story, emotional_support",
    "Examples:",
    '  "remind me to take my pill at 8" → {"intent":"medication","confidence":0.95}',
    '  "I need a ride to the doctor" → {"intent":"ride","confidence":0.93}',
    '  "I feel lonely and sad" → {"intent":"emotional_support","confidence":0.88}',
    '  "What is my risk today?" → {"intent":"daily_status","confidence":0.90}',
    '  "Tell me a story" → {"intent":"story","confidence":0.95}',
    '  "pollen is high today" → {"intent":"environment","confidence":0.92}'
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a Guru chat reply using the local SLM.
 */
async function slmChat({ message, context = {}, temperature = 0.45 }) {
  return callSLM({
    system: buildGuruChatPrompt(context),
    messages: [{ role: "user", content: String(message).slice(0, 800) }],
    temperature
  });
}

/**
 * Classify the intent of a user message using the local SLM.
 * Returns { intent, confidence, provider } or null if parsing fails.
 */
async function slmClassifyIntent(message) {
  const result = await callSLM({
    system: buildIntentClassifyPrompt(),
    messages: [{ role: "user", content: String(message).slice(0, 300) }],
    temperature: 0.05,
    maxTokens: 60
  });
  try {
    const match = result.text.match(/\{[^}]+\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (typeof parsed.intent === "string" && typeof parsed.confidence === "number") {
        return { intent: parsed.intent, confidence: parsed.confidence, provider: "slm" };
      }
    }
  } catch {}
  return null;
}

/**
 * Generate a wellness narrative from vitals + context.
 */
async function slmWellnessNarrative({ vitals, context = {} }) {
  return callSLM({
    system: buildWellnessPrompt(vitals, context),
    messages: [{ role: "user", content: "Summarize today's wellness." }],
    temperature: 0.3,
    maxTokens: 120
  });
}

/**
 * Generate a safety recommendation from a safety event/signal.
 */
async function slmSafetyRecommendation({ safetySignal, context = {} }) {
  return callSLM({
    system: buildSafetyPrompt(safetySignal, context),
    messages: [{ role: "user", content: "What should we do?" }],
    temperature: 0.2,
    maxTokens: 80
  });
}

/**
 * Generate weather/environment advice for a senior.
 */
async function slmWeatherAdvice({ weatherData, context = {} }) {
  return callSLM({
    system: buildWeatherPrompt(weatherData, context),
    messages: [{ role: "user", content: "What should I know today?" }],
    temperature: 0.35,
    maxTokens: 100
  });
}

module.exports = {
  slmAvailable,
  resetSlmAvailabilityCache,
  callSLM,
  slmChat,
  slmClassifyIntent,
  slmWellnessNarrative,
  slmSafetyRecommendation,
  slmWeatherAdvice,
  SLM_MODEL,
  SLM_PROVIDER: _SLM_PROVIDER,
  OLLAMA_BASE_URL: OLLAMA_BASE
};
