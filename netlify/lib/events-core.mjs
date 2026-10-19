/**
 * Noyau métier du module Événements — fonctions pures, sans accès réseau.
 *
 * Utilisé par les fonctions Netlify et par les tests Node. Le navigateur
 * possède son propre moteur (events-data.js) : les deux partagent les mêmes
 * règles de dates, de dédoublonnage et de filtres, mais restent indépendants
 * pour que l’application statique continue de fonctionner sans backend.
 */

import { createHash } from 'node:crypto';

export const TIMEZONE = 'Africa/Bamako';
export const DAY_MS = 86400000;

export const CATEGORIES = [
  'concert',
  'festival',
  'expo',
  'theatre',
  'sport',
  'marche',
  'conference',
  'cinema',
  'atelier',
  'soiree',
  'bonplan',
];

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const HOODS = [
  'Hamdallaye',
  'ACI 2000',
  'Badalabougou',
  'Kalaban Coura',
  'Magnambougou',
  'Quartier du fleuve',
  'Sotuba',
  'Djicoroni',
  'Niamakoro',
  'Yirimadio',
  'Sabalibougou',
  'Lafiabougou',
  'Banankabougou',
];

export const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const asDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function bamakoToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

export function startOfBamakoDay(date = new Date()) {
  const { y, m, d } = bamakoToday(date);
  return new Date(Date.UTC(y, m - 1, d));
}

export function endOfBamakoDay(date = new Date()) {
  return new Date(startOfBamakoDay(date).getTime() + DAY_MS - 1);
}

export function bamakoWeekday(date) {
  const short = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, weekday: 'short' }).format(new Date(date));
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(short);
}

export function dateKey(value) {
  const date = asDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatTime(value) {
  const date = asDate(value);
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const h = Number(parts.find((part) => part.type === 'hour')?.value);
  const m = Number(parts.find((part) => part.type === 'minute')?.value);
  return `${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}`;
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function formatDate(value, { weekday = true } = {}) {
  const date = asDate(value);
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).formatToParts(date);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value) - 1;
  return `${weekday ? `${WEEKDAYS[bamakoWeekday(date)]} ` : ''}${day} ${MONTHS[month]}`;
}

export function humanDate(value, now = new Date()) {
  const key = dateKey(value);
  if (!key) return '';
  if (key === dateKey(now)) return 'aujourd’hui';
  if (key === dateKey(new Date(now.getTime() + DAY_MS))) return 'demain';
  return formatDate(value);
}

/* ----------------------------- Normalisation ----------------------------- */

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Seules les URL http(s) sont conservées (pas de `javascript:` en base). */
const safeUrl = (value) => {
  const text = String(value || '').trim();
  return /^https?:\/\//i.test(text) ? text.slice(0, 500) : '';
};

const asPrice = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const number = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(number) ? clamp(Math.round(number), 0, 50_000_000) : 0;
};

const asCoordinate = (value, min, max) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
};

/** FNV-1a 64 bits, dépendance zéro et stable entre exécutions. */
export function stableHash(value = '') {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = (1n << 64n) - 1n;
  for (const char of String(value)) {
    hash ^= BigInt(char.codePointAt(0));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
}

export function dedupeKey(event) {
  return `evt_${stableHash(
    [normalizeText(event.title), dateKey(event.startsAt), normalizeText(event.venue || event.neighborhood || 'bamako')].join('|')
  )}`;
}

/**
 * Valide et normalise un événement produit par Gemini, une affiche ou un
 * organisateur. Retourne `null` si les champs indispensables manquent.
 */
export function normalizeEvent(raw = {}, { now = new Date(), requireFuture = false } = {}) {
  const start = asDate(raw.startsAt || raw.starts_at || raw.start);
  const end = asDate(raw.endsAt || raw.ends_at || raw.end) || (start ? new Date(start.getTime() + 2 * 3600 * 1000) : null);
  if (!start || !end || end <= start) return null;
  if (requireFuture && start.getTime() < now.getTime() - DAY_MS) return null;

  const title = String(raw.title || '').trim().slice(0, 140);
  if (title.length < 3) return null;

  const category = CATEGORIES.includes(raw.category) ? raw.category : 'bonplan';
  // Les lignes Supabase arrivent en snake_case (`price_fcfa`) : sans cette
  // lecture, un ré-upsert remettrait tous les prix à zéro.
  const price = asPrice(raw.price ?? raw.price_fcfa ?? raw.priceFcfa);
  const reliability = clamp(Math.round(Number(raw.reliability ?? raw.score ?? 50) || 0), 0, 100);
  const lat = asCoordinate(raw.lat, -90, 90);
  const lng = asCoordinate(raw.lng, -180, 180);

  const event = {
    id: String(raw.id || '').trim() || undefined,
    title,
    description: String(raw.description || '').trim().slice(0, 1200),
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    venue: String(raw.venue || '').trim().slice(0, 160) || 'Lieu à confirmer',
    neighborhood: String(raw.neighborhood || '').trim().slice(0, 80) || 'Bamako',
    lat,
    lng,
    price_fcfa: price,
    original_price_fcfa: asPrice(raw.originalPrice ?? raw.original_price_fcfa) || null,
    organizer: String(raw.organizer || '').trim().slice(0, 120) || 'Organisateur à confirmer',
    source_url: safeUrl(raw.sourceUrl || raw.source_url),
    category,
    reliability,
    status: raw.status === 'verified' ? 'verified' : raw.status === 'pending' ? 'pending' : 'ai_suggested',
    source_kind: ['ai', 'poster', 'organizer', 'seed'].includes(raw.sourceKind || raw.source_kind)
      ? raw.sourceKind || raw.source_kind
      : 'ai',
    deal: Boolean(raw.deal) || category === 'bonplan',
    image_url: safeUrl(raw.image || raw.image_url),
    tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 8).map((tag) => String(tag).slice(0, 30)) : [],
    contact: String(raw.contact || '').trim().slice(0, 160),
  };
  // On conserve la clé déjà stockée : un ré-upsert doit mettre à jour la
  // même ligne, même si le titre a été légèrement corrigé entre-temps.
  event.dedupe_key = String(raw.dedupe_key || '').trim() || dedupeKey(event);
  return event;
}

/* ------------------------------- Dédoublonnage ---------------------------- */

const tokens = (value) => new Set(normalizeText(value).split(' ').filter((word) => word.length > 2));

/** Similarité de Jaccard entre deux titres (0 → 1). */
export function similarity(a = '', b = '') {
  const setA = tokens(a);
  const setB = tokens(b);
  if (!setA.size || !setB.size) return 0;
  let shared = 0;
  setA.forEach((token) => {
    if (setB.has(token)) shared += 1;
  });
  return shared / (setA.size + setB.size - shared);
}

export function isDuplicate(candidate, existing) {
  if (!candidate || !existing) return false;
  if (candidate.dedupe_key && candidate.dedupe_key === existing.dedupe_key) return true;
  if (candidate.source_url && existing.source_url && candidate.source_url === existing.source_url) return true;
  const sameDay = Math.abs(asDate(candidate.starts_at) - asDate(existing.starts_at)) < 1.5 * DAY_MS;
  if (!sameDay) return false;
  return similarity(candidate.title, existing.title) >= 0.62;
}

/**
 * Fusionne les lots : renvoie uniquement les nouveaux événements, en
 * conservant le meilleur score de fiabilité et l’URL source la plus précise.
 */
export function dedupeBatch(candidates = [], existing = []) {
  const kept = [...existing];
  const fresh = [];
  const duplicates = [];

  for (const raw of candidates) {
    const candidate = raw?.dedupe_key ? raw : normalizeEvent(raw);
    if (!candidate) continue;
    const match = kept.find((item) => isDuplicate(candidate, item));
    if (!match) {
      kept.push(candidate);
      fresh.push(candidate);
      continue;
    }
    duplicates.push({ candidate, match });
    // Le doublon apporte parfois une meilleure source ou un score plus haut.
    if (candidate.reliability > (match.reliability || 0)) match.reliability = candidate.reliability;
    if (!match.source_url && candidate.source_url) match.source_url = candidate.source_url;
    if (!match.image_url && candidate.image_url) match.image_url = candidate.image_url;
    if (candidate.status === 'verified' && match.status !== 'verified') match.status = 'verified';
  }

  return { fresh, duplicates, kept };
}

/* ------------------------------ Fraîcheur -------------------------------- */

export function isPast(event, now = new Date(), graceHours = 6) {
  const end = asDate(event.ends_at || event.endsAt);
  return Boolean(end) && end.getTime() < now.getTime() - graceHours * 3600 * 1000;
}

/** Prépare l’écriture : à insérer/mettre à jour et à supprimer. */
export function buildRefreshPlan(candidates, existing = [], now = new Date(), { graceHours = 6 } = {}) {
  // Les lignes Supabase reviennent en snake_case : on les normalise pour que
  // le dédoublonnage et les écritures parlent exactement le même langage.
  const normalized = existing.map((row) => normalizeEvent(row, { now: new Date(0) })).filter(Boolean);
  const active = normalized.filter((event) => !isPast(event, now, graceHours));
  const expired = normalized.filter((event) => isPast(event, now, graceHours));

  const { fresh, duplicates } = dedupeBatch(candidates, active);

  // Un doublon peut avoir enrichi la ligne existante (source, fiabilité).
  const enriched = new Map();
  duplicates.forEach(({ match }) => enriched.set(match.dedupe_key, match));

  const writes = [...fresh, ...enriched.values()];
  return { writes, purged: expired, duplicates: duplicates.length, fresh };
}

/* -------------------------------- Intentions ----------------------------- */

const CATEGORY_KEYWORDS = {
  concert: ['concert', 'musique', 'kora', 'jazz'],
  festival: ['festival', 'fete'],
  expo: ['expo', 'exposition', 'musee', 'photo'],
  theatre: ['theatre', 'conte', 'piece', 'spectacle'],
  sport: ['sport', 'course', 'football', 'match', 'running'],
  marche: ['marche', 'brocante', 'artisan'],
  conference: ['conference', 'debat', 'salon'],
  cinema: ['cinema', 'film', 'projection'],
  atelier: ['atelier', 'cours', 'cuisine'],
  soiree: ['soiree', 'danser', 'danse', 'dj', 'club'],
  bonplan: ['bon plan', 'promo', 'reduction', 'pas cher', 'petit budget'],
};

const STOP_WORDS = new Set(
  (
    'que faire quoi ou aller voir sortir sortie ce soir aujourd hui demain week end cette semaine prochaine samedi dimanche lundi mardi mercredi jeudi vendredi gratuit bon plan promo pas cher bamako pour les des du de la le un une et a en avec il y a des evenements evenement events event question stp s il vous plait'
  ).split(' ')
);

export function rangeBounds(range, now = new Date()) {
  const today = startOfBamakoDay(now);
  switch (range) {
    case 'today':
      return { from: today, to: endOfBamakoDay(now) };
    case 'tomorrow':
      return { from: new Date(today.getTime() + DAY_MS), to: new Date(today.getTime() + 2 * DAY_MS - 1) };
    case 'tonight': {
      const today17 = new Date(today.getTime() + 17 * 3600 * 1000);
      return { from: new Date(Math.max(today17.getTime(), now.getTime() - 2 * 3600 * 1000)), to: endOfBamakoDay(now) };
    }
    case 'weekend': {
      const day = bamakoWeekday(now);
      const toSaturday = (6 - day + 7) % 7;
      const saturday = startOfBamakoDay(new Date(now.getTime() + toSaturday * DAY_MS));
      const start = day === 0 ? startOfBamakoDay(new Date(now.getTime() - DAY_MS)) : saturday;
      return { from: start, to: new Date(start.getTime() + 2 * DAY_MS - 1) };
    }
    case 'week':
      return { from: today, to: new Date(today.getTime() + 7 * DAY_MS - 1) };
    case 'month':
      return { from: today, to: new Date(today.getTime() + 31 * DAY_MS - 1) };
    default:
      return { from: today, to: new Date(today.getTime() + 120 * DAY_MS) };
  }
}

export function parseIntent(question = '', now = new Date()) {
  const text = normalizeText(question);
  const intent = { range: '', free: false, deal: false, categories: [], neighborhood: '', q: '', maxPrice: 0, bounds: null };

  if (/\bce soir\b|tonight/.test(text)) intent.range = 'tonight';
  else if (/\baujourd hui\b|\bce matin\b|\bcet apres midi\b/.test(text)) intent.range = 'today';
  else if (/\bdemain\b/.test(text)) intent.range = 'tomorrow';
  else if (/week end/.test(text)) intent.range = 'weekend';
  else if (/\bcette semaine\b|\bprochaine semaine\b|\bsemaine\b/.test(text)) intent.range = 'week';
  else {
    const index = WEEKDAYS.findIndex((day) => new RegExp(`\\b${day}\\b`).test(text));
    if (index >= 0) {
      const today = bamakoWeekday(now);
      let delta = (index - today + 7) % 7;
      if (delta === 0) delta = 7;
      const day = new Date(startOfBamakoDay(now).getTime() + delta * DAY_MS);
      intent.range = 'day';
      intent.bounds = { from: day, to: new Date(day.getTime() + DAY_MS - 1) };
    }
  }

  if (/\bgratuit\b|\bfree\b|\bsans payer\b/.test(text)) intent.free = true;
  if (/bon plan|promo|reduction|remise|pas cher|petit budget/.test(text)) {
    intent.deal = true;
    intent.categories.push('bonplan');
  }

  Object.entries(CATEGORY_KEYWORDS).forEach(([category, words]) => {
    if (words.some((word) => text.includes(word)) && !intent.categories.includes(category)) intent.categories.push(category);
  });

  HOODS.forEach((hood) => {
    if (text.includes(normalizeText(hood))) intent.neighborhood = hood;
  });

  const maxPrice = text.match(/(?:moins de|max(?:imum)?|sous)\s*(\d[\d\s.]{2,})\s*(?:fcfa|f cfa|francs?)?/);
  if (maxPrice) intent.maxPrice = Number(maxPrice[1].replace(/[\s.]/g, '')) || 0;

  const words = text
    .split(' ')
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word) && !WEEKDAYS.includes(word) && !CATEGORIES.includes(word));
  if (words.length) intent.q = words.slice(0, 4).join(' ');

  return intent;
}

export function matchesIntent(event, intent = {}, now = new Date()) {
  const start = asDate(event.starts_at || event.startsAt);
  if (!start) return false;
  const bounds = intent.bounds || (intent.range ? rangeBounds(intent.range, now) : null);
  if (bounds && (start < bounds.from || start > bounds.to)) return false;
  if (intent.free && Number(event.price_fcfa ?? event.price ?? 0) > 0) return false;
  if (intent.deal && !(event.deal || event.category === 'bonplan')) return false;
  if (intent.categories?.length && !intent.categories.includes(event.category)) return false;
  if (intent.neighborhood && event.neighborhood !== intent.neighborhood) return false;
  if (intent.maxPrice && Number(event.price_fcfa ?? event.price ?? 0) > intent.maxPrice) return false;
  if (intent.q) {
    const needle = normalizeText(intent.q);
    const haystack = normalizeText(
      [event.title, event.description, event.venue, event.neighborhood, event.organizer, event.category, ...(event.tags || [])].join(' ')
    );
    if (!needle.split(' ').every((word) => haystack.includes(word))) return false;
  }
  return true;
}

/**
 * Un événement est public s’il est vérifié ou suggéré par l’IA.
 * Les propositions en attente et les rejets ne sortent jamais du back-office.
 */
export const isPublicEvent = (event = {}) => event.status !== 'pending' && event.status !== 'rejected';

export function filterEvents(events = [], intent = {}, now = new Date()) {
  return events
    .filter((event) => !isPast(event, now) && matchesIntent(event, intent, now))
    .sort((a, b) => new Date(a.starts_at || a.startsAt) - new Date(b.starts_at || b.startsAt));
}

export function intentLabel(intent) {
  if (intent.bounds && intent.range === 'day') return formatDate(intent.bounds.from);
  const labels = {
    tonight: 'ce soir',
    today: 'aujourd’hui',
    tomorrow: 'demain',
    weekend: 'ce week-end',
    week: 'cette semaine',
    month: 'ce mois-ci',
  };
  return labels[intent.range] || 'bientôt';
}

export function answerFromEvents(events, intent, { lang = 'fr', max = 6 } = {}) {
  const sample = events.slice(0, max);
  const when = intentLabel(intent);
  if (!sample.length) {
    return lang === 'bm'
      ? `N ma fɛn sɔrɔ ${when}. I bɛ se ka ɲini « fɛtiw », « fu » walima « dɔgɔkun » la.`
      : `Je n’ai rien trouvé ${when}. Essayez une autre date, « gratuit », « concert » ou « ce week-end ».`;
  }
  const names = sample.map((event) => `${event.title} (${humanDate(event.starts_at || event.startsAt)})`).join(' ; ');
  if (lang === 'bm') {
    return `A bɛ yen ${sample.length} ko ${when} Bamako : ${names}. Karti kan digi walasa ka kunnafoniw sɔrɔ.`;
  }
  let text = `J’ai ${sample.length} idée${sample.length > 1 ? 's' : ''} ${when} à Bamako : ${names}.`;
  if (intent.free) text += ' Toutes les propositions sont gratuites.';
  if (intent.deal) text += ' Les bons plans portent un badge dédié.';
  text += ' Vérifiez la source avant de vous déplacer.';
  return text;
}

/* ------------------------------ Formulaire ------------------------------- */

export function validateSubmission(payload = {}, now = new Date()) {
  const errors = [];
  if (String(payload.title || '').trim().length < 3) errors.push({ field: 'title', message: 'Titre trop court.' });
  if (!CATEGORIES.includes(payload.category)) errors.push({ field: 'category', message: 'Catégorie invalide.' });
  const start = asDate(payload.startsAt);
  if (!start) errors.push({ field: 'startsAt', message: 'Date invalide.' });
  else if (start.getTime() < now.getTime() - DAY_MS) errors.push({ field: 'startsAt', message: 'Date déjà passée.' });
  if (!String(payload.venue || '').trim()) errors.push({ field: 'venue', message: 'Lieu manquant.' });
  if (!String(payload.neighborhood || '').trim()) errors.push({ field: 'neighborhood', message: 'Quartier manquant.' });
  if (!String(payload.organizer || '').trim()) errors.push({ field: 'organizer', message: 'Organisateur manquant.' });
  const contact = String(payload.contact || '').trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact);
  const phoneOk = /^\+?[\d\s().-]{6,20}$/.test(contact);
  if (contact && !emailOk && !phoneOk) {
    errors.push({ field: 'contact', message: 'Contact invalide : e-mail ou numéro de téléphone attendu.' });
  }
  const price = Number(payload.price);
  if (!Number.isFinite(price) || price < 0) errors.push({ field: 'price', message: 'Prix invalide.' });
  return errors;
}

export function submissionToEvent(payload = {}, { reliability = 88 } = {}) {
  const start = asDate(payload.startsAt) || new Date();
  const end = asDate(payload.endsAt) || new Date(start.getTime() + 2 * 3600 * 1000);
  return normalizeEvent(
    {
      ...payload,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      status: 'verified',
      sourceKind: payload.sourceKind || 'organizer',
      reliability,
      deal: payload.deal || payload.category === 'bonplan',
    },
    { now: new Date(0) }
  );
}

/** Empreinte d’un signalement, pour éviter les doublons côté base. */
export function reportKey(eventId, clientId) {
  return createHash('sha256').update(`${eventId}:${clientId}`).digest('hex').slice(0, 32);
}

export { CATEGORY_KEYWORDS, HOODS };
