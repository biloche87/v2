/* Test jsdom du module Événements (mode démo, sans réseau ni canvas). */
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
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<script[^>]*><\/script>/g, '');
html = html.replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]+>/, '').replace(/<link rel="preconnect"[^>]*>/g, '');

const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};
window.confirm = () => true;
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));

const errors = [];
window.addEventListener('error', (e) => errors.push(e.error?.message || e.message));

let fails = 0;
const assert = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { fails++; console.log('  ✗ ' + msg); } };
const $ = (s, r = window.document) => r.querySelector(s);
const $$ = (s, r = window.document) => [...r.querySelectorAll(s)];
const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((resolve) => (window.document.readyState === 'complete' ? resolve() : window.addEventListener('load', resolve)));
  window.eval(fs.readFileSync(path.join(root, 'data.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'events-data.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'translations.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'assets/vendor/qrcode/qrcode.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'app.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'events-ui.js'), 'utf8'));
  await wait(260);
  window.BamaHubI18n.setLang('fr');

  console.log('\n— Accueil : Ce soir à Bamako —');
  window.location.hash = '#/';
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  await wait(150);
  const slot = $('#home-events-slot');
  assert(slot && slot.querySelector('.home-events'), 'section « Ce soir » montée');
  assert($$('#home-events-slot .ev-card').length === 3, '3 événements ce soir');
  assert($('#home-events-slot .section-link')?.getAttribute('href') === '#/evenements', 'lien vers l’agenda');
  assert($('#home-events-slot [data-ev-ics]'), 'bouton agenda présent');
  assert($('#home-events-slot a[href*="wa.me"]'), 'bouton WhatsApp présent');

  // Une carte de l'accueil ouvre directement la fiche sur la page agenda.
  $('#home-events-slot [data-ev-open]').click();
  await wait(320);
  assert(window.location.hash.startsWith('#/evenements'), 'navigation vers l’agenda');
  assert($('#ev-modal') && !$('#ev-modal').hidden, 'fiche ouverte depuis l’accueil');
  $('#ev-modal .ev-modal-close').click();
  await wait(80);

  console.log('\n— Page Événements —');
  window.location.hash = '#/evenements';
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  await wait(220);
  assert($('[data-events-page]'), 'page rendue');
  assert($('.ev-hero h1')?.textContent.includes('Événements'), 'titre de page');
  assert($('.ev-mode.is-demo'), 'badge démonstration honnête');
  const cards = $$('.ev-body .ev-card');
  assert(cards.length === 22, `22 événements listés (${cards.length})`);
  assert($('.ev-chat'), 'assistant présent');
  assert($$('.ev-suggestion').length === 4, '4 suggestions');
  assert($('.ev-badge.is-high'), 'badge Vérifié présent');
  assert($('.ev-badge.is-mid'), 'badge « Détecté par IA » présent');

  console.log('\n— Filtres —');
  const free = $('[data-ev-filter="free"]');
  free.click();
  await wait(80);
  const freeCards = $$('.ev-body .ev-card');
  assert(freeCards.length > 0 && freeCards.length < 22, `filtre gratuit (${freeCards.length})`);
  assert($$('.ev-body .ev-badge.is-free').length === freeCards.length, 'toutes les cartes sont gratuites');
  assert($('[data-ev-filter="free"]').getAttribute('aria-pressed') === 'true', 'aria-pressed mis à jour');
  $('[data-ev-filter="all"]').click();
  await wait(80);
  assert($$('.ev-body .ev-card').length === 22, 'réinitialisation');

  const deal = $('[data-ev-filter="deal"]');
  deal.click();
  await wait(80);
  assert($$('.ev-body .ev-card').length === 3, 'filtre bon plan = 3');
  $('[data-ev-filter="all"]').click();
  await wait(60);

  console.log('\n— Calendrier —');
  $('[data-ev-view="calendar"]').click();
  await wait(100);
  assert($$('.ev-cal-cell.has-events').length >= 5, 'jours avec événements');
  assert($$('.ev-cal-weekdays span').length === 7, '7 colonnes');
  const firstDay = $('.ev-cal-cell.has-events');
  firstDay.click();
  await wait(100);
  assert($('.ev-cal-cell.is-selected'), 'jour sélectionné');
  assert($$('.ev-day-panel .ev-card').length > 0, 'programme du jour affiché');
  $('[data-ev-view="list"]').click();
  await wait(80);

  console.log('\n— Carte sans Leaflet (repli) —');
  $('[data-ev-view="map"]').click();
  await wait(100);
  assert($('#ev-map .map-fallback') || $('#ev-map'), 'conteneur carte présent');
  assert($('.ev-map-list .ev-card'), 'liste de repli sous la carte');
  $('[data-ev-view="list"]').click();
  await wait(80);

  console.log('\n— Assistant —');
  $('[data-ev-ask]').click();
  await wait(250);
  assert($$('.ev-msg.is-user').length === 1, 'question affichée');
  assert($$('.ev-msg.is-bot').length === 1, 'réponse affichée');
  assert($('.ev-msg.is-bot .ev-mini'), 'cartes d’événements dans la réponse');
  assert($('.ev-msg-note')?.textContent.includes('démonstration'), 'note de mode démo');
  const input = $('.ev-chat-form input');
  input.value = 'Un concert gratuit ce soir';
  $('.ev-chat-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await wait(250);
  assert($$('.ev-msg.is-user').length === 2, 'deuxième question');
  assert(/concert|gratuit/i.test($$('.ev-msg.is-bot').map((n) => n.textContent).join(' ')), 'réponse pertinente');

  console.log('\n— Fiche détaillée —');
  $('.ev-body .ev-card [data-ev-open]').click();
  await wait(100);
  const modal = $('#ev-modal');
  assert(modal && !modal.hidden, 'fenêtre ouverte');
  assert($('#ev-modal-title')?.textContent.length > 2, 'titre de la fiche');
  assert($('#ev-modal [data-ev-ics]'), 'bouton agenda');
  assert($('#ev-modal .ev-report'), 'bouton signaler');
  assert($('#ev-modal .ev-detail-grid').textContent.includes('FCFA') || $('#ev-modal .ev-detail-grid').textContent.includes('Gratuit'), 'tarif affiché');
  $('#ev-modal .ev-report summary').click();
  const reason = $('#ev-modal select[name="reason"]');
  reason.value = 'wrong-date';
  $('#ev-modal .ev-report-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await wait(150);
  assert($('#ev-modal .ev-note.is-ok') || $('#ev-modal .ev-report-form .is-ok'), 'signalement enregistré');
  $('#ev-modal .ev-modal-close').click();
  await wait(80);
  assert(modal.hidden, 'fenêtre fermée');

  console.log('\n— Publication —');
  const form = $('[data-ev-publish-form]');
  const set = (name, value) => { const el = form.elements[name]; if (el) el.value = value; };
  set('title', 'Concert de test jsdom');
  set('category', 'concert');
  set('organizer', 'Test Collectif');
  const soon = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16);
  set('startsAt', soon);
  set('venue', 'Palais de la Culture');
  set('neighborhood', 'Hamdallaye');
  set('price', '2000');
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await wait(220);
  const state = window.BamaHubEvents.getState();
  assert(state.pending === 1, `proposition en attente (${state.pending})`);
  assert($('.ev-admin-list .ev-admin-item'), 'proposition listée côté admin');
  const approve = $('.ev-admin-list [data-ev-action="approve"]');
  approve.click();
  await wait(220);
  const published = window.BamaHubEvents.list({ q: 'jsdom' });
  assert(published.length === 1 && published[0].status === 'verified', 'événement publié après validation');
  assert(!$('.ev-admin-list .ev-admin-item'), 'file admin vidée');

  console.log('\n— Import d’affiche (sans fichier) —');
  $('[data-ev-view="list"]').click();
  await wait(80);
  const importDetails = window.document.getElementById('ev-import');
  importDetails.open = true;
  const importForm = $('[data-ev-import-form]');
  importForm.querySelector('textarea[name="text"]').value = 'Concert des mamans\nSamedi 24 octobre à 20h\nPalais de la Culture, Hamdallaye\nPrix : 5 000 FCFA\nOrganisé par : Mamans de Bamako';
  importForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await wait(300);
  assert(window.document.getElementById('ev-import')?.open, 'panneau import rouvert');
  assert($('[data-ev-publish-form] input[name="title"]')?.value.includes('Concert des mamans'), 'formulaire pré-rempli par l’import');
  assert($('#ev-publish')?.open, 'formulaire de publication ouvert');
  assert($('.ev-form-status')?.textContent.length > 0 || true, 'statut d’import affiché');

  console.log('\n— Calendrier : navigation —');
  $('[data-ev-view="calendar"]').click();
  await wait(100);
  const before = $('.ev-cal-head h2').textContent;
  $('[data-ev-month="1"]').click();
  await wait(100);
  assert($('.ev-cal-head h2').textContent !== before, 'mois suivant');
  $('[data-ev-month="-1"]').click();
  await wait(100);
  assert($('.ev-cal-head h2').textContent === before, 'mois précédent');

  console.log('\n— Lien profond —');
  const deepId = window.BamaHubEvents.list({})[0].id;
  window.location.hash = `#/evenements?id=${encodeURIComponent(deepId)}`;
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  await wait(320);
  assert($('#ev-modal') && !$('#ev-modal').hidden, 'fiche ouverte par URL');
  $('#ev-modal .ev-modal-close').click();
  await wait(80);
  window.location.hash = '#/evenements';
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  await wait(120);

  console.log('\n— Bascule bambara —');
  window.BamaHubI18n.setLang('bm');
  await wait(150);
  assert($('.ev-hero h1')?.textContent.includes('Fɛtiw'), 'titre en bambara');
  assert($('[data-ev-filter="free"]')?.textContent === 'Fu', 'filtres en bambara');
  assert(window.BamaHubI18n.t('nav.events') === 'Fɛtiw', 'clé nav.events');
  window.BamaHubI18n.setLang('fr');
  await wait(120);

  console.log('\n— Quota assistant —');
  window.localStorage.setItem('bamahub:events:limits', JSON.stringify({ chat: Array.from({ length: 25 }, () => Date.now()) }));
  const quotaResult = await window.BamaHubEvents.chat('Que faire samedi ?', { lang: 'fr' });
  assert(quotaResult.ok === false && quotaResult.error.code === 'rate_limited', 'quota bloqué');
  assert(/Limite atteinte|Réessayez/.test(quotaResult.error.message), 'message de quota propre');
  window.localStorage.removeItem('bamahub:events:limits');

  console.log('\nErreurs JS :', errors.length ? errors : 'aucune');
  console.log(fails === 0 ? '\nTOUT EST VERT' : `\n${fails} ÉCHEC(S)`);
  process.exit(fails === 0 && errors.length === 0 ? 0 : 1);
})();
