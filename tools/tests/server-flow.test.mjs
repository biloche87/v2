/**
 * Test d’intégration des fonctions avec un faux PostgREST en mémoire.
 * Aucun accès réseau externe : Supabase est simulé sur 127.0.0.1.
 *
 *   node tools/tests/server-flow.test.mjs
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import { pathToFileURL } from 'node:url';

const root = new URL('../../netlify/functions/', import.meta.url).pathname.replace(/\/$/, '');
const load = (name) => import(pathToFileURL(`${root}/${name}.mjs`).href);

let pass = 0;
let fail = 0;
const check = (name, fn) => {
  try {
    fn();
    pass += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    fail += 1;
    console.log(`  ✗ ${name} — ${error.message}`);
  }
};

const DAY = 86400000;
const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

const state = {
  events: [],
  submissions: [],
  reports: [],
  deletedPast: 0,
  lastUpsert: null,
};

const parseBody = (req) =>
  new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : null);
      } catch (error) {
        resolve(null);
      }
    });
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const parts = url.pathname.split('/').filter(Boolean); // rest, v1, table
  const table = parts[2];
  const body = await parseBody(req);
  const send = (status, payload) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(payload));
  };

  if (table === 'rpc') {
    // RPC absent : le client doit basculer sur le compteur mémoire.
    return send(404, { message: 'rpc not found' });
  }

  if (table === 'events') {
    if (req.method === 'GET') {
      let rows = state.events.slice();
      const status = url.searchParams.get('status');
      if (status?.startsWith('neq.')) rows = rows.filter((row) => row.status !== status.slice(4));
      const ends = url.searchParams.get('ends_at');
      if (ends?.startsWith('gte.')) rows = rows.filter((row) => row.ends_at >= ends.slice(4));
      const starts = url.searchParams.get('starts_at');
      if (starts?.startsWith('gte.')) rows = rows.filter((row) => row.starts_at >= starts.slice(4));
      rows.sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1));
      const limit = Number(url.searchParams.get('limit')) || 100;
      return send(200, rows.slice(0, limit));
    }
    if (req.method === 'POST') {
      state.lastUpsert = body;
      const rows = Array.isArray(body) ? body : [body];
      rows.forEach((row) => {
        const index = state.events.findIndex((item) => item.dedupe_key === row.dedupe_key);
        if (index >= 0) state.events[index] = { ...state.events[index], ...row };
        else state.events.push({ id: row.id || `uuid-${state.events.length + 1}`, ...row });
      });
      return send(201, rows.map((row) => state.events.find((item) => item.dedupe_key === row.dedupe_key)));
    }
    if (req.method === 'DELETE') {
      const ends = url.searchParams.get('ends_at');
      if (ends?.startsWith('lt.')) {
        const before = ends.slice(3);
        const kept = state.events.filter((row) => !(row.ends_at < before));
        state.deletedPast += state.events.length - kept.length;
        state.events = kept;
      }
      return send(204, null);
    }
  }

  if (table === 'event_submissions') {
    if (req.method === 'POST') {
      const row = { id: `sub-${state.submissions.length + 1}`, ...body };
      state.submissions.push(row);
      return send(201, [row]);
    }
    if (req.method === 'GET') {
      const status = url.searchParams.get('status');
      let rows = state.submissions.slice();
      if (status?.startsWith('eq.')) rows = rows.filter((row) => row.status === status.slice(3));
      return send(200, rows.slice(0, Number(url.searchParams.get('limit')) || 50));
    }
    if (req.method === 'PATCH') {
      const id = url.searchParams.get('id')?.replace('eq.', '');
      const row = state.submissions.find((item) => item.id === id);
      if (!row) return send(404, { message: 'not found' });
      Object.assign(row, body);
      return send(200, [row]);
    }
  }

  if (table === 'event_reports') {
    if (req.method === 'POST') {
      const row = { id: `rep-${state.reports.length + 1}`, ...body };
      state.reports.push(row);
      return send(201, [row]);
    }
    if (req.method === 'GET') return send(200, state.reports.slice());
  }

  return send(404, { message: 'unknown table' });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
process.env.ADMIN_TOKEN = 'admin-test';
process.env.CHAT_LIMIT_PER_HOUR = '50';
process.env.CHAT_LIMIT_PER_DAY = '60';
delete process.env.GEMINI_API_KEY;

const seedEvents = [
  {
    id: 'e1',
    dedupe_key: 'evt_e1',
    title: 'Nuit du Kora',
    description: 'Concert de kora',
    starts_at: iso(13 * 3600000),
    ends_at: iso(16 * 3600000),
    venue: 'Palais de la Culture',
    neighborhood: 'Hamdallaye',
    lat: 12.6421,
    lng: -8.0117,
    price_fcfa: 5000,
    organizer: 'Kora Bamako',
    source_url: 'https://example.org/kora',
    category: 'concert',
    reliability: 92,
    status: 'verified',
    source_kind: 'seed',
    deal: false,
    tags: [],
    contact: '',
    image_url: '',
  },
  {
    id: 'e2',
    dedupe_key: 'evt_e2',
    title: 'Marché de nuit',
    description: 'Artisanat',
    starts_at: iso(12 * 3600000),
    ends_at: iso(15 * 3600000),
    venue: 'Place du marché',
    neighborhood: 'Badalabougou',
    lat: null,
    lng: null,
    price_fcfa: 0,
    organizer: 'Collectif',
    source_url: 'https://example.org/marche',
    category: 'marche',
    reliability: 70,
    status: 'ai_suggested',
    source_kind: 'ai',
    deal: false,
    tags: [],
    contact: '',
    image_url: '',
  },
  {
    id: 'e3',
    dedupe_key: 'evt_e3',
    title: 'Proposition privée',
    description: 'Ne doit jamais sortir',
    starts_at: iso(6 * 3600000),
    ends_at: iso(9 * 3600000),
    venue: 'Bureau',
    neighborhood: 'ACI 2000',
    lat: null,
    lng: null,
    price_fcfa: 0,
    organizer: 'Organisateur',
    source_url: '',
    category: 'bonplan',
    reliability: 50,
    status: 'pending',
    source_kind: 'organizer',
    deal: false,
    tags: [],
    contact: '',
    image_url: '',
  },
];
state.events.push(...seedEvents);

// Un événement terminé, à purger par la tâche planifiée.
state.events.push({
  ...seedEvents[0],
  id: 'e4',
  dedupe_key: 'evt_e4',
  title: 'Vieux festival',
  starts_at: iso(-3 * DAY),
  ends_at: iso(-2 * DAY),
  status: 'verified',
});

const req = (method, path, { body, headers = {} } = {}) =>
  new Request(`https://bamahub.test${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': '203.0.113.7', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const read = async (response) => ({ status: response.status, headers: response.headers, body: await response.json() });

try {
  console.log('\n— GET /api/events —');
  const events = await load('events');
  let r = await read(await events.handler(req('GET', '/api/events?limit=10')));
  check('200', () => assert.equal(r.status, 200));
  check('propositions privées exclues', () => assert(!r.body.events.some((e) => e.title === 'Proposition privée')));
  check('événements passés exclus', () => assert(!r.body.events.some((e) => e.title === 'Vieux festival')));
  check('publics conservés', () => assert.equal(r.body.events.length, 2));
  check('champs publics en snake_case', () => assert.equal(r.body.events[0].price_fcfa, 0) || assert(r.body.events[0].starts_at));
  check('cache HTTP', () => assert.match(r.headers.get('cache-control'), /max-age=60/));
  r = await read(await events.handler(req('GET', '/api/events?free=1')));
  check('filtre gratuit', () => assert.equal(r.body.events.length, 1));
  r = await read(await events.handler(req('GET', '/api/events?id=e1')));
  check('fiche par id', () => assert.equal(r.body.event.title, 'Nuit du Kora'));
  r = await read(await events.handler(req('GET', '/api/events?id=nope')));
  check('id inconnu → 404', () => assert.equal(r.status, 404));

  console.log('\n— POST /api/chat —');
  const chat = await load('chat');
  r = await read(await chat.handler(req('POST', '/api/chat', { body: { question: 'Que faire ce soir ?', lang: 'fr', sessionId: 's-1' } })));
  check('200', () => assert.equal(r.status, 200));
  check('réponse ancrée', () => assert.match(r.body.answer, /Nuit du Kora|Marché de nuit/));
  check('cartes fournies', () => assert(r.body.events.length >= 1));
  check('quota restant', () => assert(Number.isInteger(r.body.remaining)));
  check('proposition privée absente', () => assert(!r.body.events.some((e) => e.id === 'e3')));

  console.log('\n— POST /api/submit-event —');
  const submit = await load('submit-event');
  const submissionBody = {
    title: 'Grand concert du fleuve',
    category: 'concert',
    startsAt: iso(5 * DAY),
    venue: 'Palais de la Culture',
    neighborhood: 'Hamdallaye',
    organizer: 'Collectif Fleuve',
    price: 5000,
    contact: '+223 76 12 34 56',
    sessionId: 's-1',
  };
  r = await read(await submit.handler(req('POST', '/api/submit-event', { body: submissionBody })));
  check('201', () => assert.equal(r.status, 201));
  check('statut pending', () => assert.equal(r.body.submission.status, 'pending'));
  check('ligne créée', () => assert.equal(state.submissions.length, 1));
  check('aucune publication immédiate', () => assert(!state.events.some((e) => e.title === 'Grand concert du fleuve')));

  console.log('\n— Administration —');
  const admin = await load('admin-events');
  r = await read(await admin.handler(req('GET', '/api/admin-events', { headers: { 'x-admin-token': 'admin-test' } })));
  check('file lue', () => assert.equal(r.body.submissions.length, 1));
  const submissionId = r.body.submissions[0].id;
  r = await read(
    await admin.handler(
      req('POST', '/api/admin-events', {
        headers: { 'x-admin-token': 'admin-test' },
        body: { id: submissionId, action: 'approve', patch: { reliability: 95 } },
      })
    )
  );
  check('validation OK', () => assert.equal(r.body.status, 'approved'));
  check('événement publié', () => assert(state.events.some((e) => e.title === 'Grand concert du fleuve' && e.status === 'verified')));
  check('proposition marquée approuvée', () => assert.equal(state.submissions[0].status, 'approved'));
  const written = state.events.find((e) => e.title === 'Grand concert du fleuve');
  check('clé de dédoublonnage calculée', () => assert(/^evt_[0-9a-f]+$/.test(written.dedupe_key)));
  check('contact conservé', () => assert.equal(written.contact, '+223 76 12 34 56'));

  console.log('\n— Signalement —');
  const report = await load('report-event');
  r = await read(await report.handler(req('POST', '/api/report-event', { body: { eventId: 'e1', reason: 'wrong-date', note: 'Test' } })));
  check('200', () => assert.equal(r.status, 200));
  check('signalement stocké', () => assert.equal(state.reports.length, 1));
  check('empreinte anonyme', () => assert.match(state.reports[0].reporter_hash, /^[0-9a-f]{32}$/));

  console.log('\n— Tâche planifiée —');
  const before = state.events.length;
  const refresh = await load('refresh-events');
  r = await read(
    await refresh.handler(req('POST', '/api/refresh-events', { body: { next_run: iso(DAY) } }))
  );
  check('invocation planifiée reconnue', () => assert.equal(r.status, 200));
  check('événement terminé purgé', () => assert(state.deletedPast >= 1));
  check('aucune écriture IA sans clé', () => assert.equal(r.body.inserted, 0));
  check('Gemini signalé absent', () => assert(!r.body.gemini));
  check('taille cohérente', () => assert(state.events.length <= before));

  console.log('\n— Quota serveur —');
  process.env.CHAT_LIMIT_PER_HOUR = '2';
  process.env.CHAT_LIMIT_PER_DAY = '2';
  // Le compteur mémoire est déjà chargé : on force un dépassement.
  let last;
  for (let i = 0; i < 4; i += 1) {
    last = await read(await chat.handler(req('POST', '/api/chat', { body: { question: 'Encore ?', sessionId: 'quota-user' }, headers: { 'x-nf-client-connection-ip': '198.51.100.4' } })));
  }
  check('429 après dépassement', () => assert.equal(last.status, 429));
  check('Retry-After présent', () => assert(Number(last.headers.get('retry-after')) > 0));
  check('message lisible', () => assert.match(last.body.error.message, /Limite|Réessayez/));
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log(`\n${pass} réussis · ${fail} échec(s)`);
process.exit(fail ? 1 : 0);
