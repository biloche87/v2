/* Vérifie le contrat client ↔ serveur en mode live, avec un fetch simulé. */
const fs = require('fs');
const path = require('path');
let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (error) {
  console.error('jsdom est requis : npm install --no-save jsdom');
  process.exit(2);
}

const root = path.join(__dirname, '..', '..');
const html = '<!doctype html><html><body><main id="main"></main><div id="toast-region"></div></body></html>';
const dom = new JSDOM(html, { url: 'https://bamahub.test/', runScripts: 'dangerously', pretendToBeVisual: true });
const { window } = dom;

const now = Date.now();
const rows = [
  {
    id: 'a1',
    dedupe_key: 'evt_a1',
    title: 'Nuit du Kora',
    description: 'Concert de kora',
    starts_at: new Date(now + 86400000).toISOString(),
    ends_at: new Date(now + 90000000).toISOString(),
    venue: 'Palais de la Culture',
    neighborhood: 'Hamdallaye',
    lat: 12.6421,
    lng: -8.0117,
    price_fcfa: 5000,
    original_price_fcfa: 7500,
    organizer: 'Kora Bamako',
    source_url: 'https://example.org/kora',
    category: 'concert',
    reliability: 92,
    status: 'verified',
    source_kind: 'seed',
    deal: false,
    image_url: 'https://example.org/kora.jpg',
    tags: ['kora'],
    contact: '',
  },
  {
    id: 'a2',
    dedupe_key: 'evt_a2',
    title: 'Marché de nuit',
    description: 'Artisanat et brochettes',
    starts_at: new Date(now + 7200000).toISOString(),
    ends_at: new Date(now + 14400000).toISOString(),
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
  },
];

const calls = [];
window.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), method: options.method || 'GET', body: options.body });
  const [pathname] = String(url).split('?');
  let payload;
  if (pathname.endsWith('/events')) payload = { ok: true, events: rows, generatedAt: new Date(now).toISOString(), mode: 'live' };
  else if (pathname.endsWith('/chat'))
    payload = {
      ok: true,
      answer: 'Samedi : Nuit du Kora au Palais de la Culture.',
      events: [rows[0]],
      intent: { range: 'weekend' },
      remaining: 12,
      degraded: false,
    };
  else if (pathname.endsWith('/import-event'))
    payload = {
      ok: true,
      draft: { ...rows[0], id: '', status: 'pending', sourceKind: 'poster' },
      confidence: 88,
      notice: 'Fiche pré-remplie par l’IA.',
      name: 'affiche.jpg',
    };
  else if (pathname.endsWith('/submit-event'))
    payload = { ok: true, submission: { id: 'sub-remote-1', status: 'pending', createdAt: new Date().toISOString() }, remaining: 4 };
  else if (pathname.endsWith('/report-event')) payload = { ok: true, message: 'Merci', remaining: 9 };
  else if (pathname.endsWith('/admin-events')) payload = { ok: true, status: 'approved', event: { ...rows[0], id: 'a3', status: 'verified' } };
  else payload = { ok: false, error: 'not_found', message: 'nope' };

  const status = payload.ok === false ? 404 : 200;
  return {
    ok: status === 200,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(payload),
  };
};

window.eval(fs.readFileSync(path.join(root, 'events-data.js'), 'utf8'));
const EV = window.BamaHubEvents;

let fails = 0;
const assert = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { fails++; console.log('  ✗ ' + msg); } };

(async () => {
  const state = await EV.init();
  assert(state.mode === 'live', 'mode live adopté');
  assert(state.events === 2, '2 événements distants');
  const kora = EV.get('a1');
  assert(kora && kora.price === 5000, 'prix lu depuis price_fcfa');
  assert(kora.originalPrice === 7500, 'prix barré lu depuis original_price_fcfa');
  assert(kora.sourceKind === 'seed', 'source_kind normalisé');
  assert(kora.image === 'https://example.org/kora.jpg', 'image_url normalisée');
  assert(EV.list({ category: 'concert' }).length === 1, 'filtrage local du cache');
  assert(EV.list({ free: true }).some((event) => event.id === 'a2'), 'gratuit détecté (price_fcfa 0)');
  assert(calls[0].url.includes('/events?limit=60&probe=1'), 'URL de sonde');

  const chat = await EV.chat('Que faire samedi ?', { lang: 'fr' });
  assert(chat.ok && chat.mode === 'live', 'chat live');
  assert(chat.events.length === 1 && chat.events[0].price === 5000, 'événements du chat normalisés');
  assert(chat.remaining === 12, 'quota serveur repris');

  const draft = await EV.importDraft({ text: 'Concert samedi', link: 'https://example.org/kora' }, { lang: 'fr' });
  assert(draft.ok && draft.mode === 'live', 'import live');
  assert(draft.draft.price === 5000 && draft.draft.status === 'pending', 'brouillon exploitable');
  assert(draft.notice.includes('IA'), 'notice du serveur conservée');

  const submission = await EV.submitEvent(
    {
      title: 'Concert du fleuve',
      category: 'concert',
      startsAt: new Date(now + 3 * 86400000).toISOString(),
      venue: 'Palais',
      neighborhood: 'Hamdallaye',
      organizer: 'Collectif',
      price: 2000,
      contact: '+223 76 12 34 56',
    },
    { lang: 'fr' }
  );
  assert(submission.ok && submission.mode === 'live', 'publication live');
  assert(submission.submission.id === 'sub-remote-1', 'identifiant serveur conservé');
  const posted = JSON.parse(calls.find((call) => call.url.endsWith('/submit-event')).body);
  assert(posted.sourceKind === 'organizer' && posted.neighborhood === 'Hamdallaye', 'corps POST conforme');
  assert(posted.contact === '+223 76 12 34 56', 'téléphone accepté');

  const report = await EV.reportEvent('a1', 'wrong-date', '', { lang: 'fr' });
  assert(report.ok, 'signalement live');

  const review = await EV.reviewSubmission('sub-remote-1', 'approve', {}, { token: 'secret' });
  assert(review.ok && review.mode === 'live', 'validation live');
  assert(EV.submissions().every((item) => item.id !== 'ghost'), 'file locale cohérente');

  console.log(fails === 0 ? '\nTOUT EST VERT' : `\n${fails} ÉCHEC(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
