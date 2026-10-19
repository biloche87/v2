/**
 * POST /api/submit-event — formulaire « Publier mon événement ».
 *
 * Les propositions ne sont jamais publiées directement : elles entrent dans
 * `event_submissions` avec le statut `pending`, puis passent par l’admin
 * (ou la structuration IA de la tâche planifiée).
 */

import { CATEGORIES, validateSubmission } from '../lib/events-core.mjs';
import { db, supabaseConfigured } from '../lib/supabase.mjs';
import { consume, limitsFor } from '../lib/rate-limit.mjs';
import { clientKey, fail, handle, json, methodNotAllowed, notConfigured } from '../lib/http.mjs';

const clean = (value, max) => String(value || '').trim().slice(0, max);

export const handler = (request) =>
  handle(async () => {
    if (request.method !== 'POST') return methodNotAllowed(['POST']);

    let body = {};
    try {
      body = await request.json();
    } catch (error) {
      return fail(400, 'invalid_json', 'Corps JSON invalide.');
    }

    const errors = validateSubmission(body, new Date());
    if (errors.length) {
      return json({ ok: false, error: { code: 'invalid', message: errors[0].message, errors } }, 400);
    }

    const key = clientKey(request, body);
    const quota = await consume({ key: `submit:${key}`, ...limitsFor('submit') });
    if (!quota.allowed) {
      return json(
        {
          ok: false,
          error: {
            code: 'rate_limited',
            message: `Limite de publications atteinte. Réessayez dans ${Math.ceil(quota.retryAfter / 3600)} h.`,
            retryAfter: quota.retryAfter,
          },
        },
        429,
        { 'Retry-After': String(quota.retryAfter) }
      );
    }

    if (!supabaseConfigured()) return notConfigured();

    const payload = {
      title: clean(body.title, 140),
      category: CATEGORIES.includes(body.category) ? body.category : 'bonplan',
      description: clean(body.description, 1200),
      startsAt: new Date(body.startsAt).toISOString(),
      endsAt: body.endsAt ? new Date(body.endsAt).toISOString() : '',
      venue: clean(body.venue, 160),
      neighborhood: clean(body.neighborhood, 80),
      lat: Number.isFinite(Number(body.lat)) ? Number(body.lat) : null,
      lng: Number.isFinite(Number(body.lng)) ? Number(body.lng) : null,
      price: Math.max(0, Math.round(Number(body.price) || 0)),
      organizer: clean(body.organizer, 120),
      contact: clean(body.contact, 160),
      sourceUrl: clean(body.sourceUrl, 500),
      image: clean(body.image, 500),
      deal: Boolean(body.deal) || body.category === 'bonplan',
    };

    const submission = {
      payload,
      status: 'pending',
      source_kind: ['poster', 'organizer'].includes(body.sourceKind) ? body.sourceKind : 'organizer',
      client_hash: key.slice(0, 120),
      created_at: new Date().toISOString(),
    };

    try {
      const row = await db.insertSubmission(submission);
      return json(
        {
          ok: true,
          submission: { id: row?.id, status: row?.status || 'pending', createdAt: row?.created_at || submission.created_at },
          message: 'Proposition enregistrée. Elle sera vérifiée avant publication.',
          remaining: quota.remaining,
          mode: 'live',
        },
        201
      );
    } catch (error) {
      console.error('[submit-event]', error);
      return fail(502, 'db_error', 'Enregistrement impossible pour le moment. Réessayez plus tard.');
    }
  }, request, {});

export default handler;
