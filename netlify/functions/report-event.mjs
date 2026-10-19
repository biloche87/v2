/**
 * POST /api/report-event — signalement d’un événement depuis une carte du
 * chat ou la fiche détaillée. Les signalements sont consultés par l’admin.
 */

import { db, supabaseConfigured } from '../lib/supabase.mjs';
import { reportKey } from '../lib/events-core.mjs';
import { consume, limitsFor } from '../lib/rate-limit.mjs';
import { clientKey, fail, handle, json, methodNotAllowed, notConfigured } from '../lib/http.mjs';

const REASONS = ['wrong-date', 'wrong-place', 'cancelled', 'fake', 'offensive', 'other'];

export const handler = (request) =>
  handle(async () => {
    if (request.method !== 'POST') return methodNotAllowed(['POST']);

    let body = {};
    try {
      body = await request.json();
    } catch (error) {
      return fail(400, 'invalid_json', 'Corps JSON invalide.');
    }

    const eventId = String(body.eventId || '').trim();
    if (!eventId || eventId.length > 120) return fail(400, 'invalid_event', 'Événement invalide.');

    const reason = REASONS.includes(body.reason) ? body.reason : 'other';
    const note = String(body.note || '').trim().slice(0, 500);
    const key = clientKey(request, body);

    const quota = await consume({ key: `report:${key}`, ...limitsFor('report') });
    if (!quota.allowed) {
      return json(
        {
          ok: false,
          error: { code: 'rate_limited', message: 'Trop de signalements. Réessayez plus tard.', retryAfter: quota.retryAfter },
        },
        429,
        { 'Retry-After': String(quota.retryAfter) }
      );
    }

    if (!supabaseConfigured()) return notConfigured();

    try {
      const report = {
        event_id: eventId,
        reason,
        note,
        reporter_hash: reportKey(eventId, key),
        created_at: new Date().toISOString(),
      };
      await db.insertReport(report);
      return json({ ok: true, message: 'Signalement enregistré. Merci de votre vigilance.', remaining: quota.remaining });
    } catch (error) {
      console.error('[report-event]', error);
      return fail(502, 'db_error', 'Signalement impossible pour le moment.');
    }
  }, request, {});

export default handler;
