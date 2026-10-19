#!/usr/bin/env node
/**
 * Génère les pages de partage statiques `partage/<id>.html`.
 *
 * Les robots des réseaux sociaux (WhatsApp, Facebook, X…) n'exécutent pas
 * JavaScript : une page statique par adresse est donc nécessaire pour fournir
 * un aperçu riche (Open Graph) tout en redirigeant le visiteur vers la fiche
 * complète de l'application.
 *
 * Usage :
 *   node tools/build-share-pages.js
 *
 * Le script lit `data.js` (aucune dépendance), écrit les fichiers et affiche
 * un résumé. Relancer après toute modification des adresses.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'partage');
const SITE = 'https://bamahub.ml';

// --- Chargement de data.js (même mécanisme que le navigateur) ----------------
const sandbox = { window: {}, console };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'), sandbox, {
  filename: 'data.js',
});
const { LISTINGS, CATEGORIES } = sandbox.window.BamaHubData;

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const escapeAttr = (value = '') => escapeHtml(value).replace(/'/g, '&#39;');

const categoryOf = (listing) =>
  CATEGORIES.find((category) => category.id === listing.category) || {
    label: 'Adresse',
    photo: 'default',
  };

const whatsappNumber = (listing) => {
  const raw = String(listing.whatsapp || listing.phone || '').replace(/[^\d]/g, '');
  return raw;
};

function pageFor(listing) {
  const category = categoryOf(listing);
  const photo = category.photo || `assets/photos/${listing.category}.webp`;
  const imageAbsolute = `${SITE}/${photo}`;
  const canonical = `${SITE}/partage/${listing.id}.html`;
  const ogTitle = `${listing.name} — ${category.label} à ${listing.neighborhood}`;
  const description = listing.description || `${listing.name}, ${category.label} à ${listing.neighborhood}.`;
  const kicker = `${category.label} · ${listing.neighborhood}`;
  const address = listing.address || listing.neighborhood;
  const number = whatsappNumber(listing);
  const waMessage = encodeURIComponent(`Bonjour, je vous ai trouvé sur BamaHub : ${listing.name}`);
  const target = `../index.html#/adresse/${listing.id}`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(ogTitle)} · BamaHub</title>
  <meta name="description" content="${escapeAttr(description)}" />
  <link rel="canonical" href="${canonical}" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="BamaHub" />
  <meta property="og:locale" content="fr_FR" />
  <meta property="og:title" content="${escapeAttr(ogTitle)}" />
  <meta property="og:description" content="${escapeAttr(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${imageAbsolute}" />
  <meta property="og:image:type" content="image/webp" />
  <meta property="og:image:width" content="960" />
  <meta property="og:image:height" content="640" />
  <meta property="og:image:alt" content="${escapeAttr(listing.name)} · BamaHub" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(ogTitle)}" />
  <meta name="twitter:description" content="${escapeAttr(description)}" />
  <meta name="twitter:image" content="${imageAbsolute}" />

  <meta name="theme-color" content="#2563eb" />
  <link rel="icon" href="../favicon.ico" sizes="16x16 32x32" />
  <style>
    :root { color-scheme: light dark; --brand: #2563eb; --accent: #f97316; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
      font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      background: radial-gradient(700px 420px at 80% 0%, #dbeafe, transparent 70%), #f5f8fd; color: #0f172a; }
    .card { width: min(100%, 460px); background: #fff; border-radius: 22px; overflow: hidden;
      box-shadow: 0 30px 70px -30px rgba(15,23,42,.45); border: 1px solid #e2e8f0; }
    .cover { height: 190px; background: #e2e8f0; }
    .cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .body { padding: 20px 22px 24px; }
    .kicker { display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: .04em;
      text-transform: uppercase; color: var(--accent); }
    h1 { margin: 6px 0 4px; font-size: 24px; letter-spacing: -.03em; line-height: 1.15; }
    .meta { color: #64748b; font-size: 14px; margin: 0 0 12px; }
    p.desc { color: #334155; font-size: 14px; line-height: 1.55; margin: 0 0 18px; }
    .brand { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 13px; color: var(--brand); margin-bottom: 4px; }
    .brand span { width: 9px; height: 9px; border-radius: 50%; background: var(--brand); }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 12px 16px;
      border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 14px; }
    .primary { background: var(--brand); color: #fff; }
    .ghost { border: 1px solid #cbd5e1; color: #0f172a; }
    .note { margin-top: 14px; font-size: 12px; color: #94a3b8; }
    @media (prefers-color-scheme: dark) {
      body { background: radial-gradient(700px 420px at 80% 0%, #172c52, transparent 70%), #070d18; color: #e8eefb; }
      .card { background: #101a2c; border-color: #1e2b44; }
      h1 { color: #e8eefb; }
      p.desc { color: #cbd5e1; }
      .ghost { border-color: #2e4160; color: #e8eefb; }
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="cover"><img src="../${photo}" alt="${escapeAttr(listing.name)}" /></div>
    <div class="body">
      <div class="brand"><span></span>BamaHub · Bamako</div>
      <span class="kicker">${escapeHtml(kicker)}</span>
      <h1>${escapeHtml(listing.name)}</h1>
      <p class="meta">${escapeHtml(address)}</p>
      <p class="desc">${escapeHtml(description)}</p>
      <div class="actions">
        <a class="btn primary" href="${target}">Ouvrir la fiche complète</a>
        ${number ? `<a class="btn ghost" href="https://wa.me/${number}?text=${waMessage}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
      </div>
      <p class="note">Aperçu partagé par BamaHub — annuaire local de Bamako. Les commerces et avis de cette démonstration sont fictifs.</p>
    </div>
  </main>
  <script>
    // Le lien direct est visible même sans JavaScript ; on ouvre la fiche
    // complète automatiquement après un court instant.
    setTimeout(function () { location.replace('${target}'); }, 1400);
  </script>
</body>
</html>
`;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const written = [];
for (const listing of LISTINGS) {
  const file = path.join(OUT_DIR, `${listing.id}.html`);
  fs.writeFileSync(file, pageFor(listing), 'utf8');
  written.push(`${listing.id}.html`);
}

// Supprime les pages orphelines (adresse retirée de data.js).
const known = new Set(written);
for (const file of fs.readdirSync(OUT_DIR)) {
  if (file.endsWith('.html') && !known.has(file)) {
    fs.unlinkSync(path.join(OUT_DIR, file));
    console.log(`supprimé (adresse absente) : partage/${file}`);
  }
}

console.log(`${written.length} pages générées dans partage/`);
