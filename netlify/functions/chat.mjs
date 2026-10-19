/**
 * POST /api/chat — assistant en langage naturel, ancré sur la base.
 *
 * 1. Limite de débit par utilisateur (IP + session).
 * 2. Analyse d’intention locale (dates, gratuité, catégories, quartier).
 * 3. Lecture des événements à venir dans Supabase — jamais d’IA pour lire.
 * 4. Réponse construite depuis les résultats ; reformulation Gemini
 *    facultative (GEMINI_CHAT=1) et toujours dégradable en cas de quota.
 */

import { db, supabaseConfigured } from '../lib/supabase.mjs';
import { answerFromEvents, filterEvents, isPublicEvent, parseIntent } from '../lib/events-core.mjs';
import { config } from '../lib/env.mjs';
import { phraseAnswer } from '../lib/gemini.mjs';
import { consume, limitsFor } from '../lib/rate-limit.mjs';
import { clientKey, fail, handle, json, notConfigured, methodNotAllowed } from '../lib/http.mjs';

const CHAT_FIELDS = [
  'id',
  'title',
  'description',
  'starts_at',
  'ends_at',
  'venue',
  'neighborhood',
  'lat',
  'lng',
  'price_fcfa',
  'original_price_fcfa',
  'organizer',
  'source_url',
  'category',
  'reliability',
  'status',
  'source_kind',
  'deal',
  'image_url',
  'tags',
];

const project = (event) => Object.fromEntries(CHAT_FIELDS.filter((key) => event[key] !== undefined).map((key) => [key, event[key]]));

export const handler = (request) =>
  handle(async () => {
    if (request.method !== 'POST') return methodNotAllowed(['POST']);

    let body = {};
    try {
      body = await request.json();
    } catch (error) {
      return fail(400, 'invalid_json', 'Corps JSON invalide.');
    }

    const question = String(body.question || '').trim().slice(0, 400);
    if (question.length < 2) return fail(400, 'empty', 'Posez une question pour commencer.');
    const lang = body.lang === 'bm' ? 'bm' : 'fr';
    const key = clientKey(request, body);

    const hourLimit = limitsFor('chat-hour');
    const dayLimit = limitsFor('chat-day');
    const [hour, day] = await Promise.all([
      consume({ key: `chat:h:${key}`, ...hourLimit }),
      consume({ key: `chat:d:${key}`, ...dayLimit }),
    ]);
    if (!hour.allowed || !day.allowed) {
      const retryAfter = Math.max(hour.retryAfter, day.retryAfter, 60);
      return json(
        {
          ok: false,
          error: {
            code: 'rate_limited',
            message:
              lang === 'bm'
                ? `I ka ɲininkali hakɛ dafara. I ka kunnafoni ${Math.ceil(retryAfter / 60)} min.`
                : `Limite de questions atteinte (${hourLimit.limit}/heure). Réessayez dans ${Math.ceil(retryAfter / 60)} min.`,
            retryAfter,
          },
          remaining: 0,
        },
        429,
        { 'Retry-After': String(retryAfter) }
      );
    }
    const remaining = Math.min(hour.remaining, day.remaining);

    if (!supabaseConfigured()) return notConfigured();

    const now = new Date();
    const intent = parseIntent(question, now);

    let events = [];
    try {
      const rows = await db.listEvents({ from: new Date(now.getTime() - 86400000).toISOString(), limit: 300 });
      events = filterEvents(rows.filter(isPublicEvent), intent, now);
    } catch (error) {
      console.error('[chat] lecture Supabase impossible :', error.message);
      return fail(502, 'db_unavailable', 'La base des événements est momentanément indisponible.', { remaining });
    }

    const sample = events.slice(0, 6).map(project);
    let answer = answerFromEvents(events, intent, { lang });
    let degraded = false;
    let phrased = false;

    // Reformulation facultative : jamais bloquante, jamais inventée.
    if (config().gemini.chatPhrasing && sample.length) {
      try {
        const text = await phraseAnswer({ question, events: sample, lang });
        if (text && text.length > 20) {
          answer = text;
          phrased = true;
        }
      } catch (error) {
        degraded = true;
        console.warn('[chat] reformulation ignorée :', error.message);
      }
    }

    return json({
      ok: true,
      answer,
      events: sample,
      intent,
      mode: 'live',
      source: 'base',
      phrased,
      degraded,
      remaining,
      generatedAt: new Date().toISOString(),
    });
  }, request, {});

export default handler;
