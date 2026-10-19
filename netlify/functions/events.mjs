/**
 * GET /api/events — lecture seule de la base.
 *
 * Aucun appel IA : les événements sont produits par la tâche planifiée
 * `refresh-events` puis simplement filtrés ici.
 *
 * Paramètres : id, range (today|tomorrow|tonight|weekend|week|month|all),
 * free=1, deal=1, cat, q, limit.
 */

import { db, supabaseConfigured } from '../lib/supabase.mjs';
import { filterEvents, isPublicEvent, normalizeText } from '../lib/events-core.mjs';
import { fail, handle, json, notConfigured, methodNotAllowed } from '../lib/http.mjs';

const PUBLIC_FIELDS = [
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
  'updated_at',
];

const project = (event) => Object.fromEntries(PUBLIC_FIELDS.filter((key) => event[key] !== undefined).map((key) => [key, event[key]]));

/** Lecture Supabase tolérante aux pannes : renvoie null plutôt que jeter. */
async function readRows(limit) {
  try {
    return await db.listEvents({ from: new Date(Date.now() - 86400000).toISOString(), limit });
  } catch (error) {
    console.error('[events] lecture impossible :', error.message);
    return null;
  }
}

export const handler = (request) =>
  handle(async () => {
    if (request.method !== 'GET') return methodNotAllowed(['GET']);
    if (!supabaseConfigured()) return notConfigured();

    const url = new URL(request.url);
    const params = url.searchParams;
    const id = String(params.get('id') || '').slice(0, 120);
    const limit = Math.min(100, Math.max(1, Number(params.get('limit')) || 60));

    if (id) {
      const rows = (await readRows(500))?.filter(isPublicEvent);
      if (!rows) return fail(502, 'db_unavailable', 'La base des événements est momentanément indisponible.');
      const event = rows.find((row) => row.id === id);
      if (!event) return json({ ok: false, error: 'not_found', message: 'Événement introuvable.' }, 404);
      return json({ ok: true, event: project(event), generatedAt: new Date().toISOString(), mode: 'live' });
    }

    const range = ['today', 'tomorrow', 'tonight', 'weekend', 'week', 'month'].includes(params.get('range'))
      ? params.get('range')
      : '';
    const cat = String(params.get('cat') || '');
    const q = String(params.get('q') || '').slice(0, 120);

    const intent = {
      range: '',
      free: params.get('free') === '1',
      deal: params.get('deal') === '1',
      categories: cat ? [cat] : [],
      q: normalizeText(q),
      bounds: null,
    };

    const rows = (await readRows(300))?.filter(isPublicEvent);
    if (!rows) return fail(502, 'db_unavailable', 'La base des événements est momentanément indisponible.');
    // `filterEvents` applique aussi la purge des événements terminés.
    let events = range || intent.free || intent.deal || intent.categories.length || intent.q
      ? filterEvents(rows, { ...intent, range })
      : filterEvents(rows, { range: '' });

    // Le tri final est chronologique, quel que soit le filtre.
    events = events.slice(0, limit);

    return json(
      {
        ok: true,
        events: events.map(project),
        count: events.length,
        generatedAt: new Date().toISOString(),
        mode: 'live',
        filters: { range: range || 'all', free: intent.free, deal: intent.deal, cat: cat || null, q: q || null },
      },
      200,
      { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' }
    );
  }, request, {});

export default handler;
