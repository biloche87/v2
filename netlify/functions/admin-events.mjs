/**
 * /api/admin-events — validation des propositions.
 *
 * GET  : liste les propositions en attente et les signalements.
 * POST : { id, action: 'approve' | 'reject', patch? }.
 *
 * Authentification : en-tête `x-admin-token` comparé à ADMIN_TOKEN.
 * Pour la démonstration statique, le panneau local (mode démo) utilise le
 * jeton `demo-admin` ; en production, remplacez ce garde-fou par Netlify
 * Identity ou Supabase Auth avant d’ouvrir le panneau aux organisateurs.
 */

import { timingSafeEqual } from 'node:crypto';
import { config } from '../lib/env.mjs';
import { submissionToEvent } from '../lib/events-core.mjs';
import { db, supabaseConfigured } from '../lib/supabase.mjs';
import { fail, handle, json, methodNotAllowed, notConfigured } from '../lib/http.mjs';

function authorized(request) {
  const expected = config().adminToken;
  const provided = request.headers.get('x-admin-token') || '';
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch (error) {
    return false;
  }
}

const publicSubmission = (row) => ({
  id: row.id,
  status: row.status,
  sourceKind: row.source_kind,
  createdAt: row.created_at,
  payload: row.payload,
  draft: row.draft || null,
  aiModel: row.ai_model || null,
});

export const handler = (request) =>
  handle(async () => {
    if (!['GET', 'POST'].includes(request.method)) return methodNotAllowed(['GET', 'POST']);
    if (!config().adminToken) {
      return fail(503, 'admin_not_configured', 'ADMIN_TOKEN n’est pas défini : la validation est désactivée.');
    }
    if (!authorized(request)) return fail(401, 'unauthorized', 'Jeton administrateur invalide.');
    if (!supabaseConfigured()) return notConfigured();

    if (request.method === 'GET') {
      const [pending, reports] = await Promise.all([
        db.listSubmissions({ status: 'pending', limit: 50 }),
        db.listReports({ limit: 50 }).catch(() => []),
      ]);
      return json({
        ok: true,
        submissions: pending.map(publicSubmission),
        reports,
        mode: 'live',
      });
    }

    let body = {};
    try {
      body = await request.json();
    } catch (error) {
      return fail(400, 'invalid_json', 'Corps JSON invalide.');
    }

    const id = String(body.id || '').trim();
    const action = body.action === 'approve' ? 'approve' : body.action === 'reject' ? 'reject' : '';
    if (!id || !action) return fail(400, 'invalid_action', 'Identifiant et action requis.');

    const rows = await db.listSubmissions({ status: 'pending', limit: 100 });
    const submission = rows.find((row) => String(row.id) === id);
    if (!submission) return fail(404, 'not_found', 'Proposition introuvable ou déjà traitée.');

    if (action === 'reject') {
      await db.updateSubmission(id, { status: 'rejected', reviewed_at: new Date().toISOString() });
      return json({ ok: true, status: 'rejected' });
    }

    const merged = { ...(submission.payload || {}), ...(submission.draft || {}), ...(body.patch || {}) };
    const event = submissionToEvent(merged, { reliability: Number(body.patch?.reliability) || 90 });
    if (!event) return fail(400, 'invalid_event', 'Impossible de créer l’événement : champs essentiels manquants.');

    event.status = 'verified';
    event.source_kind = submission.source_kind === 'poster' ? 'poster' : 'organizer';
    event.reliability = Math.max(85, Math.min(100, event.reliability || 90));

    const created = await db.upsertEvents([event]);
    await db.updateSubmission(id, {
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      event_id: created?.[0]?.id || null,
    });

    return json({ ok: true, status: 'approved', event: created?.[0] || event });
  }, request, {});

export default handler;
