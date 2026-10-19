/* Vérifie la vue Carte du module Événements avec le vrai Leaflet (jsdom). */
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
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script[^>]*><\/script>/g, '');
const dom = new JSDOM(html, { url: 'https://bamahub.test/', runScripts: 'dangerously', pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};
const errors = [];
window.addEventListener('error', (event) => errors.push(event.error?.message || event.message));

let fails = 0;
const assert = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else {
    fails += 1;
    console.log('  ✗ ' + msg);
  }
};
const wait = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  window.eval(fs.readFileSync(path.join(root, 'assets/vendor/leaflet/leaflet.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'assets/vendor/leaflet/leaflet.markercluster.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'data.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'events-data.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'translations.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'app.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'events-ui.js'), 'utf8'));
  await wait(300);

  console.log('\n— Vue Carte (Leaflet réel) —');
  assert(window.L && window.L.markerClusterGroup, 'Leaflet + markercluster chargés');
  window.location.hash = '#/evenements';
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  await wait(300);
  window.document.querySelector('[data-ev-view="map"]').click();
  await wait(450);

  const map = window.document.getElementById('ev-map');
  assert(map && map.classList.contains('leaflet-container'), 'carte initialisée');
  assert(map.querySelector('.leaflet-tile-pane'), 'couche de tuiles OSM');
  const shown = map.querySelectorAll('.bh-pin, .marker-cluster').length;
  assert(shown > 0, `épingles ou groupes affichés (${shown})`);
  assert(map.querySelectorAll('.leaflet-marker-icon').length > 0, 'marqueurs Leaflet');

  // Bascule liste → carte : l’ancienne carte doit être détruite proprement.
  window.document.querySelector('[data-ev-view="list"]').click();
  await wait(120);
  window.document.querySelector('[data-ev-view="map"]').click();
  await wait(350);
  const map2 = window.document.getElementById('ev-map');
  assert(map2 && map2.classList.contains('leaflet-container'), 'carte recréée après bascule');
  assert(window.document.querySelectorAll('.leaflet-container').length === 1, 'une seule carte dans le DOM');

  // Navigation hors de la page : plus de carte.
  window.location.hash = '#/explorer';
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  await wait(300);
  assert(window.document.querySelectorAll('.leaflet-container').length === 0, 'carte détruite en quittant la page');

  console.log('\nErreurs JS :', errors.length ? errors : 'aucune');
  console.log(fails === 0 ? '\nTOUT EST VERT' : `\n${fails} ÉCHEC(S)`);
  process.exit(fails === 0 && errors.length === 0 ? 0 : 1);
})();
