/**
 * Client Gemini (API REST v1beta), sans SDK.
 *
 * • `generateJson` essaie d’abord avec Google Search grounding + schéma JSON,
 *   puis sans grounding, puis en texte libre : si une combinaison n’est pas
 *   supportée par le modèle configuré, la suivante prend le relais.
 * • Les quotas (429 / RESOURCE_EXHAUSTED) sont traduits en `QuotaError`
 *   pour que les fonctions renvoient un message propre et un Retry-After.
 */

import { config } from './env.mjs';

export class QuotaError extends Error {
  constructor(message, retryAfter = 3600) {
    super(message);
    this.name = 'QuotaError';
    this.status = 429;
    this.code = 'quota';
    this.retryAfter = retryAfter;
  }
}

export class GeminiError extends Error {
  constructor(message, { status = 502, code = 'gemini_error', details = null } = {}) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const geminiConfigured = () => config().gemini.configured;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function extractJson(text = '') {
  const cleaned = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    // Récupère le premier objet/tableau JSON équilibré.
    const startCandidates = [cleaned.indexOf('{'), cleaned.indexOf('[')].filter((index) => index >= 0);
    if (!startCandidates.length) return null;
    const start = Math.min(...startCandidates);
    const open = cleaned[start];
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < cleaned.length; i += 1) {
      const char = cleaned[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === open) depth += 1;
      else if (char === close) {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(cleaned.slice(start, i + 1));
          } catch (parseError) {
            return null;
          }
        }
      }
    }
    return null;
  }
}

async function requestModel({ model, body, timeoutMs }) {
  const { gemini } = config();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(gemini.key)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal }
    );
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      data = null;
    }

    if (!response.ok) {
      const message = data?.error?.message || `Gemini HTTP ${response.status}`;
      if (response.status === 429 || data?.error?.status === 'RESOURCE_EXHAUSTED') {
        const retry = Number(data?.error?.details?.find((detail) => detail.retryDelay)?.retryDelay?.replace('s', '') || 0);
        throw new QuotaError('Quota Gemini atteint.', retry || 3600);
      }
      const error = new GeminiError(message, { status: response.status === 400 ? 400 : 502, details: data });
      error.apiStatus = response.status;
      throw error;
    }

    const candidate = data?.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const content = parts.map((part) => part.text || '').join('');
    return {
      text: content,
      json: extractJson(content),
      grounding: candidate?.groundingMetadata || null,
      model,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new GeminiError('Délai d’attente Gemini dépassé.', { status: 504, code: 'timeout' });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Génère du JSON structuré.
 * @param {object} options
 * @param {Array} options.parts – parts Gemini (texte, inlineData…)
 * @param {object} [options.schema] – responseSchema
 * @param {boolean} [options.grounding] – active Google Search
 * @param {string} [options.system] – consigne système
 */
export async function generateJson({ parts = [], schema = null, grounding = false, system = '', temperature = 0.2, budgetMs = 0 }) {
  const cfg = config().gemini;
  if (!cfg.configured) throw new GeminiError('GEMINI_API_KEY absente.', { status: 503, code: 'not_configured' });

  const models = [cfg.model, ...cfg.fallbackModels].filter(Boolean);
  // Budget global : une fonction planifiée Netlify est coupée à 30 s. On
  // s’arrête proprement avant, plutôt que d’être tué au milieu d’un appel.
  const deadline = budgetMs > 0 ? Date.now() + budgetMs : 0;
  let lastError = null;

  outer: for (const model of models) {
    const attempts = [];
    if (schema) attempts.push({ tools: grounding, schema: true });
    if (schema) attempts.push({ tools: false, schema: true });
    attempts.push({ tools: false, schema: false });
    if (grounding && !schema) attempts.push({ tools: true, schema: false });

    for (const attempt of attempts) {
      let timeoutMs = cfg.timeoutMs;
      if (deadline) {
        const remaining = deadline - Date.now();
        if (remaining < 1800) {
          lastError = new GeminiError('Budget de temps épuisé avant la fin de la génération.', {
            status: 504,
            code: 'timeout',
          });
          break outer;
        }
        timeoutMs = Math.min(timeoutMs, Math.max(1500, remaining - 400));
      }
      const body = {
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature, maxOutputTokens: 8192 },
      };
      if (system) body.systemInstruction = { parts: [{ text: system }] };
      if (attempt.schema && schema) {
        body.generationConfig.responseMimeType = 'application/json';
        body.generationConfig.responseSchema = schema;
      }
      if (attempt.tools) body.tools = [{ google_search: {} }];

      try {
        const result = await requestModel({ model, body, timeoutMs });
        if (result.json !== null && result.json !== undefined) return result;
        lastError = new GeminiError('Réponse non JSON.', { details: result.text?.slice(0, 500) });
      } catch (error) {
        lastError = error;
        if (error instanceof QuotaError) throw error;
        // 400 = combinaison non supportée (outils + schéma) → tentative suivante.
        if (error.apiStatus && error.apiStatus !== 400 && error.apiStatus !== 404) {
          // 403 clé invalide, 5xx… : inutile d’insister sur les modèles suivants.
          if (error.apiStatus === 403) throw error;
        }
      }
      if (!deadline || deadline - Date.now() > 2000) await sleep(150);
    }
  }

  throw lastError || new GeminiError('Aucune réponse exploitable de Gemini.');
}

/** Reformulation du chat (facultative) à partir des seuls événements fournis. */
export async function phraseAnswer({ question, events, lang = 'fr', budgetMs = 6_000 }) {
  const list = events
    .slice(0, 6)
    .map((event, index) => `${index + 1}. ${event.title} — ${event.starts_at} — ${event.venue}, ${event.neighborhood} — ${event.price_fcfa === 0 ? 'gratuit' : `${event.price_fcfa} FCFA`}`)
    .join('\n');
  const result = await generateJson({
    system:
      'Tu es l’assistant de BamaHub, annuaire de Bamako. Réponds uniquement à partir des événements fournis. N’invente aucun lieu, prix ni horaire. Cite les titres. Sois bref (3 phrases maximum), chaleureux et concret. Langue : ' +
      (lang === 'bm' ? 'bambara simple.' : 'français.'),
    parts: [
      {
        text:
          `Question : ${question}\n\nÉvénements disponibles (base BamaHub) :\n${list}\n\n` +
          'Réponds uniquement en JSON strict, sans texte autour : {"answer":"…"}',
      },
    ],
    temperature: 0.3,
    grounding: false,
    budgetMs,
  });
  return String(result.json?.answer || result.text || '').slice(0, 900);
}
