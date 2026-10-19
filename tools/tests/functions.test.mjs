/* Tests des fonctions Netlify sans réseau ni clés : comportements de repli. */
import assert from 'node:assert/strict';
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

const req = (method, url, { body, headers = {} } = {}) =>
  new Request(`https://bamahub.test${url}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': '203.0.113.9', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const json = async (response) => ({ status: response.status, headers: response.headers, body: await response.json() });

console.log('\n— Santé & configuration —');
const health = await load('health');
let r = await json(await health.handler(req('GET', '/api/health')));
check('health = 200', () => assert.equal(r.status, 200));
check('mode démo', () => assert.equal(r.body.mode, 'demo'));
check('aucun secret exposé', () => {
  const text = JSON.stringify(r.body);
  assert(!/service_role|GEMINI_API_KEY|ADMIN_TOKEN/i.test(text));
});

console.log('\n— Lecture des événements —');
const events = await load('events');
r = await json(await events.handler(req('GET', '/api/events')));
check('sans Supabase → 503', () => assert.equal(r.status, 503));
check('code not_configured', () => assert.equal(r.body.error, 'not_configured'));
check('repli annoncé (mode demo)', () => assert.equal(r.body.mode, 'demo'));
r = await json(await events.handler(req('POST', '/api/events')));
check('POST refusé → 405', () => assert.equal(r.status, 405));
check('en-tête Allow', () => assert.equal(r.headers.get('allow'), 'GET'));

console.log('\n— Assistant —');
const chat = await load('chat');
r = await json(await chat.handler(req('POST', '/api/chat', { body: { question: 'Que faire samedi ?', lang: 'fr' } })));
check('sans Supabase → 503', () => assert.equal(r.status, 503));
check('quota non consommé en erreur de config', () => assert.equal(r.body.ok, false));
r = await json(await chat.handler(req('POST', '/api/chat', { body: { question: '  ' } })));
check('question vide → 400', () => assert.equal(r.status, 400));
const badJson = new Request('https://bamahub.test/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
r = await json(await chat.handler(badJson));
check('JSON invalide → 400', () => assert.equal(r.status, 400));

console.log('\n— Import d’affiche —');
const importEvent = await load('import-event');
r = await json(await importEvent.handler(req('POST', '/api/import-event', { body: { text: 'Concert samedi 20h' } })));
check('sans Gemini → 503 explicite', () => assert.equal(r.status, 503));
check('formulaire manuel suggéré', () => assert.equal(r.body.mode, 'demo'));
r = await json(await importEvent.handler(req('POST', '/api/import-event', { body: {} })));
check('entrée vide → 400', () => assert.equal(r.status, 400));
r = await json(await importEvent.handler(req('POST', '/api/import-event', { body: { imageDataUrl: 'data:text/plain;base64,AAA' } })));
check('image non supportée → 400/415', () => assert([400, 415].includes(r.status)));
r = await json(await importEvent.handler(req('POST', '/api/import-event', { body: { imageDataUrl: `data:image/png;base64,${'A'.repeat(6_400_000)}` } })));
check('image trop lourde → 413', () => assert.equal(r.status, 413));

console.log('\n— Proposition organisateur —');
const submit = await load('submit-event');
r = await json(await submit.handler(req('POST', '/api/submit-event', { body: { title: 'x' } })));
check('fiche incomplète → 400', () => assert.equal(r.status, 400));
check('message lisible', () => assert.match(r.body.error.message, /Titre|Catégorie|Date|Lieu/));
const validSubmission = {
  title: 'Grand concert du fleuve',
  category: 'concert',
  startsAt: new Date(Date.now() + 5 * 86400000).toISOString(),
  venue: 'Palais de la Culture',
  neighborhood: 'Hamdallaye',
  organizer: 'Collectif Fleuve',
  price: 5000,
  contact: '+223 76 12 34 56',
};
r = await json(await submit.handler(req('POST', '/api/submit-event', { body: validSubmission })));
check('contact téléphonique accepté (503 config, pas 400)', () => assert.equal(r.status, 503));

console.log('\n— Signalement —');
const report = await load('report-event');
r = await json(await report.handler(req('POST', '/api/report-event', { body: {} })));
check('sans événement → 400', () => assert.equal(r.status, 400));
r = await json(await report.handler(req('POST', '/api/report-event', { body: { eventId: 'abc', reason: 'wrong-date' } })));
check('sans Supabase → 503', () => assert.equal(r.status, 503));

console.log('\n— Administration —');
const admin = await load('admin-events');
r = await json(await admin.handler(req('GET', '/api/admin-events')));
check('ADMIN_TOKEN absent → 503', () => assert.equal(r.status, 503));
process.env.ADMIN_TOKEN = 'secret-de-test';
r = await json(await admin.handler(req('GET', '/api/admin-events')));
check('jeton absent → 401', () => assert.equal(r.status, 401));
r = await json(await admin.handler(req('GET', '/api/admin-events', { headers: { 'x-admin-token': 'mauvais' } })));
check('jeton erroné → 401', () => assert.equal(r.status, 401));
r = await json(await admin.handler(req('GET', '/api/admin-events', { headers: { 'x-admin-token': 'secret-de-test' } })));
check('jeton valide sans Supabase → 503', () => assert.equal(r.status, 503));

console.log('\n— Tâche planifiée —');
const refresh = await load('refresh-events');
r = await json(await refresh.handler(req('POST', '/api/refresh-events', { body: {} })));
check('déclenchement manuel sans jeton → 401', () => assert.equal(r.status, 401));
r = await json(
  await refresh.handler(req('POST', '/api/refresh-events', { headers: { 'x-admin-token': 'secret-de-test' }, body: {} }))
);
check('jeton valide sans Supabase → 503', () => assert.equal(r.status, 503));

console.log('\n— Plan de rafraîchissement (snake_case) —');
const core = await import(new URL('../../netlify/lib/events-core.mjs', import.meta.url).href);
const now = new Date();
const existing = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    dedupe_key: 'evt_existing',
    title: 'Nuit du Kora',
    description: 'Concert de kora',
    starts_at: new Date(now.getTime() + 86400000).toISOString(),
    ends_at: new Date(now.getTime() + 90000000).toISOString(),
    venue: 'Palais de la Culture',
    neighborhood: 'Hamdallaye',
    lat: 12.6421,
    lng: -8.0117,
    price_fcfa: 5000,
    organizer: 'Kora Bamako',
    source_url: 'https://example.org/kora',
    category: 'concert',
    reliability: 90,
    status: 'verified',
    source_kind: 'seed',
    deal: false,
    tags: [],
  },
];
const candidate = {
  title: 'Nuit du Kora',
  description: 'Concert de kora et voix mandingues',
  startsAt: new Date(now.getTime() + 86400000 + 3600000).toISOString(),
  endsAt: new Date(now.getTime() + 86400000 + 3600000 + 7200000).toISOString(),
  venue: 'Palais de la Culture',
  neighborhood: 'Hamdallaye',
  price: 5000,
  category: 'concert',
  sourceUrl: 'https://example.org/kora-2026',
  reliability: 95,
  status: 'ai_suggested',
  sourceKind: 'ai',
};
const plan = core.buildRefreshPlan([candidate], existing, now);
check('doublon détecté', () => assert.equal(plan.duplicates, 1));
check('prix conservé après normalisation', () => assert(plan.writes.every((row) => row.price_fcfa === 5000)));
check('statut vérifié préservé', () => assert(plan.writes.every((row) => row.status === 'verified')));
check('clé de dédoublonnage présente', () => assert(plan.writes.every((row) => row.dedupe_key)));
check('aucune ligne passée réécrite', () => assert.equal(plan.purged.length, 0));

const past = {
  ...existing[0],
  starts_at: new Date(now.getTime() - 48 * 3600000).toISOString(),
  ends_at: new Date(now.getTime() - 24 * 3600000).toISOString(),
};
const plan2 = core.buildRefreshPlan([], [past], now);
check('événement terminé purgé', () => assert.equal(plan2.purged.length, 1));
check('aucune écriture inutile', () => assert.equal(plan2.writes.length, 0));

console.log(`\n${pass} réussis · ${fail} échec(s)`);
process.exit(fail ? 1 : 0);
