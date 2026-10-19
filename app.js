/**
 * ============================================================================
 *  BamaHub — Application
 *  Annuaire local de Bamako
 * ============================================================================
 *
 *  Organisation du fichier
 *  -----------------------
 *   1. Utilitaires (échappement, formats, stockage)
 *   2. État de l'application (données, favoris, filtres)
 *   3. Génération des composants (icônes, cartes, grilles)
 *   4. Pages (accueil, explorateur, fiche, formulaire, favoris, 404)
 *   5. Routage, thème, navigation et événements globaux
 *
 *  Aucun framework : le rendu est fait avec des template literals et les
 *  interactions passent par une délégation d'événements.
 * ============================================================================
 */

(() => {
  'use strict';

  /* ==========================================================================
     1. Utilitaires
     ========================================================================== */

  const DATA = window.BamaHubData;
  if (!DATA) {
    console.error('BamaHub : data.js doit être chargé avant app.js.');
    return;
  }

  const { CATEGORIES, NEIGHBORHOODS, LISTINGS, REVIEWS = {}, PROMOS = {}, DAILY_OFFERS = {} } = DATA;

  const STORAGE = {
    favorites: 'bamahub:favorites',
    custom: 'bamahub:listings',
    theme: 'bamahub:theme',
    lastExplorer: 'bamahub:last-explorer',
    accounts: 'bamahub:accounts',
    session: 'bamahub:session',
    // Nouvelles fonctionnalités (v2)
    reviews: 'bamahub:reviews',
    reports: 'bamahub:reports',
    offers: 'bamahub:daily-offers',
    promos: 'bamahub:promos',
    history: 'bamahub:history',
    compare: 'bamahub:compare',
    dataSaver: 'bamahub:datasaver',
    images: 'bamahub:images',
  };

  const DEMO_ACCOUNT = {
    name: 'Awa Traoré',
    email: 'demo@bamahub.ml',
    password: 'bamako2026',
  };

  const SORT_OPTIONS = [
    { id: 'pertinence', label: 'Pertinence' },
    { id: 'distance', label: 'Distance' },
    { id: 'note', label: 'Mieux notés' },
    { id: 'recent', label: 'Plus récents' },
    { id: 'prix-asc', label: 'Prix croissant' },
    { id: 'prix-desc', label: 'Prix décroissant' },
    { id: 'confiance', label: 'Indice de confiance' },
  ];

  /** Libellé de tri dans la langue active (repli sur le libellé français). */
  const sortLabel = (option) => {
    const value = t(`sort.${option.id}`);
    return value === `sort.${option.id}` ? option.label : value;
  };

  /** Libellé de filtre rapide dans la langue active. */
  const quickLabel = (filter) => {
    const key = `quick.${filter.id}`;
    const value = t(key);
    return value === key ? filter.label : value;
  };

  /** Centre de Bamako utilisé par la carte et le formulaire. */
  const BAMAKO_CENTER = [12.6392, -8.0029];
  const MAP_DEFAULT_ZOOM = 13;

  /** Rayons proposés par le mode « Autour de moi ». */
  const RADIUS_OPTIONS = [
    { value: 500, label: '500 m' },
    { value: 1000, label: '1 km' },
    { value: 5000, label: '5 km' },
  ];
  const DEFAULT_RADIUS = 5000;

  /** Fonds de carte OpenStreetMap (aucune clé API, attribution obligatoire). */
  const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const OSM_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

  /** Filtres rapides génériques, branchés sur les champs booléens du config. */
  const QUICK_FILTERS = [
    { id: 'open', label: 'Ouvert maintenant', test: (listing) => isOpenNow(listing) },
    { id: 'duty', label: 'De garde', test: (l) => l.fields?.onDuty === true },
    { id: 'reservation', label: 'Réservation', test: (l) => l.fields?.reservation === true },
    { id: 'delivery', label: 'Livraison', test: (l) => l.fields?.delivery === true },
    {
      id: 'urgent',
      label: 'Urgences 24/7',
      test: (l) => l.fields?.urgent === true || l.fields?.towing === true,
    },
    { id: 'enrollment', label: 'Inscriptions ouvertes', test: (l) => l.fields?.enrollmentOpen === true },
    { id: 'home', label: 'À domicile', test: (l) => l.fields?.homeService === true },
    { id: 'promo', label: 'En promotion', test: (listing) => Boolean(promoFor(listing.id)) },
  ];

  const FALLBACK_CATEGORY = {
    id: 'autres',
    label: 'Autres',
    singular: 'Adresse',
    color: '#64748b',
    tagline: 'Autres bonnes adresses de Bamako',
    icon: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 2.5"/>',
    subcategories: [],
    fields: [],
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  /** Échappe une valeur pour un sélecteur d'attribut (avec repli sans CSS.escape). */
  const escapeSelector = (value = '') =>
    window.CSS?.escape ? window.CSS.escape(value) : String(value).replace(/["\\]/g, '\\$&');

  /** Échappe une chaîne pour l'insérer dans du HTML (texte ou attribut). */
  const escapeHtml = (value = '') =>
    String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));

  /** Normalise une chaîne pour une recherche insensible aux accents/casse. */
  const normalize = (value = '') =>
    String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const numberFormatter = new Intl.NumberFormat('fr-FR');
  const formatNumber = (value) => numberFormatter.format(Number(value) || 0);
  const formatMoney = (value) => `${formatNumber(value)} FCFA`;
  const formatRating = (value) => Number(value).toFixed(1).replace('.', ',');

  const todayISO = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  };

  const isNew = (dateString, days = 21) => {
    if (!dateString) return false;
    const date = new Date(`${dateString}T12:00:00`);
    const diff = (Date.now() - date.getTime()) / 86400000;
    return diff >= 0 && diff <= days;
  };

  const slugify = (value = '') =>
    normalize(value)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'adresse';

  /* ==========================================================================
     2bis. Services transverses
     --------------------------------------------------------------------------
     Langue, horaires d'ouverture, indice de confiance, avis, préférences
     d'affichage, offres et promotions. Ces fonctions sont volontairement
     sans état global en dehors de `state`, ce qui les rend faciles à tester.
     ========================================================================== */

  /** Raccourci de traduction (le dictionnaire vit dans translations.js). */
  const t = (key, vars) => (window.BamaHubI18n ? window.BamaHubI18n.t(key, vars) : key);
  const getLang = () => (window.BamaHubI18n ? window.BamaHubI18n.getLang() : 'fr');

  /** Libellé de catégorie dans la langue active. */
  const catLabel = (cat) =>
    getLang() === 'bm' && cat?.labelBm ? cat.labelBm : cat?.label || '';

  /** Libellé d'un champ de formulaire dans la langue active. */
  const fieldLabel = (field) =>
    getLang() === 'bm' && field?.labelBm ? field.labelBm : field?.label || '';

  /** Valeurs « oui / non » d'un champ booléen dans la langue active. */
  const fieldValueLabels = (field) => {
    const labels =
      getLang() === 'bm' && field?.valueLabelsBm
        ? field.valueLabelsBm
        : field?.valueLabels || { true: 'Oui', false: 'Non' };
    return labels;
  };

  /* ----------------------------- Horaires -------------------------------- */

  const DAY_INDEX = { dim: 0, lun: 1, mar: 2, mer: 3, jeu: 4, ven: 5, sam: 6 };
  const ALL_DAYS = [1, 2, 3, 4, 5, 6, 0];
  const HOURS_CACHE = new Map();

  /** « 8h », « 8h30 », « 00h » — utilisé dans les statuts d'ouverture. */
  function formatClock(minutes) {
    const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    if (total === 0) return '00h';
    return `${hours}h${mins ? String(mins).padStart(2, '0') : ''}`;
  }

  /** Analyse « 8h – 22h », « 7h30 – 17h », « 22h – 7h » (nuit). */
  function parseTimeRange(text) {
    const match = /(\d{1,2})\s*(?:h|:)\s*(\d{2})?\s*(?:-|à|a)\s*(\d{1,2})\s*(?:h|:)\s*(\d{2})?/.exec(text);
    if (!match) return null;
    const startHours = Number(match[1]);
    const startMins = match[2] ? Number(match[2]) : 0;
    const endHours = Number(match[3]);
    const endMins = match[4] ? Number(match[4]) : 0;
    if (startHours > 24 || endHours > 24 || startMins > 59 || endMins > 59) return null;
    const start = startHours * 60 + startMins;
    let end = endHours === 24 ? 1440 + endMins : endHours * 60 + endMins;
    // Une plage qui se termine avant de commencer passe minuit.
    if (end <= start) end += 1440;
    return { start, end };
  }

  /**
   * Repère la portion « jours » d'un segment d'horaires.
   * « Lun - Sam » → 6 jours ; « Sam 9h - 13h » → samedi + reste « 9h - 13h ».
   */
  function parseDaySpec(part) {
    if (/(tous les jours|7\s*j\s*\/\s*7|7\s*\/\s*7)/i.test(part)) {
      const rest = part.replace(/(tous les jours|7\s*j\s*\/\s*7|7\s*\/\s*7)/gi, '').replace(/^[\s·,]+/, '').trim();
      return { days: ALL_DAYS.slice(), rest };
    }
    const dayRe = /\b(lun(?:di)?|mar(?:di)?|mer(?:credi)?|jeu(?:di)?|ven(?:dredi)?|sam(?:edi)?|dim(?:anche)?)\b/gi;
    const found = [];
    let match;
    while ((match = dayRe.exec(part))) {
      const day = DAY_INDEX[match[1].toLowerCase().slice(0, 3)];
      if (day === undefined) continue;
      found.push({ day, start: match.index, end: match.index + match[0].length });
    }
    if (!found.length) return null;

    const days = new Set();
    if (found.length >= 2 && /^\s*[-–—]\s*$/.test(part.slice(found[0].end, found[1].start))) {
      let day = found[0].day;
      for (let i = 0; i < 7; i += 1) {
        days.add(day);
        if (day === found[1].day) break;
        day = (day + 1) % 7;
      }
    } else {
      days.add(found[0].day);
      for (let i = 1; i < found.length; i += 1) {
        if (/^\s*[,/]\s*$/.test(part.slice(found[i - 1].end, found[i].start))) days.add(found[i].day);
      }
    }

    const rest = part.slice(found[found.length - 1].end).trim().replace(/^[,·]\s*/, '');
    return { days: [...days], rest };
  }

  /**
   * Transforme une chaîne d'horaires libre en plages par jour.
   * Format de retour : { always, known, days: [[{start,end}], …] } (0 = dimanche).
   */
  function parseHours(raw) {
    const key = String(raw || '');
    if (HOURS_CACHE.has(key)) return HOURS_CACHE.get(key);

    const days = Array.from({ length: 7 }, () => []);
    const result = { always: false, known: false, days };
    if (!raw || typeof raw !== 'string') {
      HOURS_CACHE.set(key, result);
      return result;
    }

    const text = raw
      .replace(/[–—−]/g, '-')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Réception / urgences 24h/24 : l'adresse est joignable à toute heure.
    if (/(réception|urgences?|accueil)[^·]*24\s*h?\s*\/\s*24/i.test(text)) {
      result.always = true;
      result.known = true;
      HOURS_CACHE.set(key, result);
      return result;
    }

    const parts = text.split('·').map((part) => part.trim()).filter(Boolean);
    if (parts.some((part) => /^24\s*h?\s*\/\s*24\s*h?$/i.test(part))) {
      result.always = true;
      result.known = true;
      HOURS_CACHE.set(key, result);
      return result;
    }

    let currentDays = ALL_DAYS.slice();
    let known = false;
    for (const part of parts) {
      const spec = parseDaySpec(part);
      if (spec) currentDays = spec.days;
      const range = parseTimeRange(spec ? spec.rest : part);
      if (!range) continue;
      currentDays.forEach((day) => {
        if (spec) {
          // Un jour explicitement nommé remplace les plages héritées.
          days[day] = [{ start: range.start, end: range.end }];
        } else {
          days[day] = [...days[day], { start: range.start, end: range.end }];
        }
      });
      known = true;
    }

    result.known = known;
    HOURS_CACHE.set(key, result);
    return result;
  }

  const dayName = (index) => {
    if (getLang() === 'bm') {
      return ['kari', 'ntɛnɛn', 'tarata', 'araba', 'alamisa', 'juma', 'sibiri'][index];
    }
    return ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][index];
  };

  /**
   * Statut d'ouverture à l'instant `now`.
   * → { status: 'open' | 'soon' | 'closed' | 'unknown', label, detail }
   */
  function getOpenState(listing, now = new Date()) {
    const parsed = parseHours(listing?.hours);
    if (parsed.always) {
      return { status: 'open', label: t('status.open'), detail: t('status.open24'), always: true };
    }
    if (!parsed.known) {
      return { status: 'unknown', label: '', detail: t('status.unknown') };
    }

    const dow = now.getDay();
    const minutes = now.getHours() * 60 + now.getMinutes();

    // Plages du jour + débordement de la veille (garde de nuit).
    const candidates = [...parsed.days[dow]];
    parsed.days[(dow + 6) % 7].forEach((range) => {
      if (range.end > 1440) candidates.push({ start: range.start - 1440, end: range.end - 1440 });
    });

    for (const range of candidates) {
      if (minutes >= range.start && minutes < range.end) {
        const remaining = range.end - minutes;
        if (remaining <= 60) {
          return {
            status: 'soon',
            label: t('status.closingSoon'),
            detail: t('status.closesAt', { time: formatClock(range.end) }),
            remaining,
          };
        }
        return {
          status: 'open',
          label: t('status.open'),
          detail: t('status.closesAt', { time: formatClock(range.end) }),
        };
      }
    }

    // Prochaine ouverture, sur une semaine glissante.
    for (let offset = 0; offset < 8; offset += 1) {
      const day = (dow + offset) % 7;
      const ranges = [...parsed.days[day]].sort((a, b) => a.start - b.start);
      for (const range of ranges) {
        const start = range.start + offset * 1440;
        if (start <= minutes) continue;
        const detail =
          offset === 0
            ? t('status.opensAt', { time: formatClock(range.start) })
            : offset === 1
              ? t('status.opensTomorrow', { time: formatClock(range.start) })
              : t('status.opensDay', { day: dayName(day), time: formatClock(range.start) });
        return { status: 'closed', label: t('status.closed'), detail };
      }
    }

    return { status: 'closed', label: t('status.closed'), detail: t('status.closedToday') };
  }

  /** Vrai si l'adresse est ouverte (ou sur le point de fermer). */
  function isOpenNow(listing) {
    return ['open', 'soon'].includes(getOpenState(listing).status);
  }

  /* ------------------------- Préférences d'affichage ---------------------- */

  function dataSaverActive() {
    if (state.dataSaver === 'on') return true;
    if (state.dataSaver === 'off') return false;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return Boolean(connection?.saveData) || /(^|-)2g$/.test(connection?.effectiveType || '');
  }

  function imagesEnabled() {
    return state.images !== 'none';
  }

  /** Source de la photo de couverture (catégorie ou photo ajoutée par le commerçant). */
  function listingPhoto(listing) {
    if (!imagesEnabled()) return '';
    if (listing?.photo) return listing.photo;
    const cat = getCategory(listing?.category);
    if (!cat?.photo) return '';
    return dataSaverActive() ? cat.photoSmall || cat.photo : cat.photo;
  }

  /** Balise <img> paresseuse, avec repli visuel assuré par le conteneur. */
  function lazyImage(src, { alt = '', className = '', width, height } = {}) {
    if (!src) return '';
    return `<img class="${className}" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"
      ${width ? `width="${width}" height="${height || Math.round((width * 2) / 3)}"` : ''}
      loading="lazy" decoding="async" />`;
  }

  /* ---------------------------- Avis & note ------------------------------- */

  /** Avis de démonstration + avis publiés depuis l'application. */
  function reviewsFor(listingId) {
    const seeded = Array.isArray(REVIEWS[listingId]) ? REVIEWS[listingId] : [];
    const custom = Array.isArray(state.reviews[listingId]) ? state.reviews[listingId] : [];
    const reported = new Set(state.reports.map((report) => report.reviewId));
    return [...custom.map((review) => ({ ...review, mine: true })), ...seeded].map((review) => ({
      ...review,
      reported: reported.has(review.id),
    }));
  }

  /** Note agrégée : note de base (annuaire) + avis publiés depuis l'app. */
  function aggregateRating(listing) {
    const baseCount = Number(listing?.reviews) || 0;
    const baseAvg = Number(listing?.rating) || 0;
    const custom = Array.isArray(state.reviews[listing?.id]) ? state.reviews[listing.id] : [];
    if (!custom.length) return { avg: baseAvg, count: baseCount };
    const total = baseAvg * baseCount + custom.reduce((sum, review) => sum + Number(review.rating || 0), 0);
    const count = baseCount + custom.length;
    return { avg: count ? total / count : 0, count };
  }

  /* --------------------------- Indice de confiance ------------------------ */

  /**
   * Indice 0–100, expliqué à l'utilisateur :
   *   • profil complété (45 pts)  → coordonnées, repère, horaires, description…
   *   • qualité des avis (35 pts) → note moyenne + volume d'avis
   *   • ancienneté (20 pts)       → jusqu'à 24 mois de présence
   * Aucun partenariat payant n'entre dans le calcul.
   */
  function getTrustScore(listing) {
    const cat = getCategory(listing.category);
    const fieldCount = Object.values(listing.fields || {}).filter(
      (value) => value !== '' && value !== null && value !== undefined && value !== false
    ).length;

    const checks = [
      Boolean(listing.phone),
      Boolean(listing.whatsapp),
      Boolean(listing.address && listing.address.length >= 8),
      Boolean(listing.landmark),
      Boolean(listing.hours),
      String(listing.description || '').length >= 120,
      Array.isArray(listing.coords) && listing.coords.length === 2,
      Boolean(cat.photo || listing.photo),
      (listing.subcategories || []).length > 0,
      fieldCount >= 2,
    ];
    const profile = Math.round((checks.filter(Boolean).length / checks.length) * 45);

    const { avg, count } = aggregateRating(listing);
    const reviewPoints = Math.min(
      35,
      Math.round((avg / 5) * 20 + (Math.log10(count + 1) / Math.log10(250)) * 15)
    );

    const created = new Date(listing.createdAt || Date.now()).getTime();
    const months = Math.max(0, (Date.now() - created) / (1000 * 60 * 60 * 24 * 30.44));
    const seniority = Math.round(Math.min(1, months / 24) * 20);

    return {
      score: Math.max(0, Math.min(100, profile + reviewPoints + seniority)),
      profile,
      reviews: reviewPoints,
      seniority,
      checks,
    };
  }

  function trustTier(score) {
    if (score >= 75) return 'high';
    if (score >= 55) return 'mid';
    return 'low';
  }

  /* ---------------------------- Promotions -------------------------------- */

  function promoFor(listingId) {
    const custom = state.promos[listingId];
    if (custom && (!custom.expires || new Date(`${custom.expires}T23:59:59`) >= new Date())) return custom;
    const seeded = PROMOS[listingId];
    if (seeded && (!seeded.expires || new Date(`${seeded.expires}T23:59:59`) >= new Date())) return seeded;
    return null;
  }

  function promoPercent(promo) {
    if (!promo) return '';
    const match = /(-?\d+)\s*%/.exec(`${promo.title} ${promo.detail || ''}`);
    return match ? String(Math.abs(Number(match[1]))) : '';
  }

  /* -------------------------- Offres du jour ------------------------------ */

  function getDailyOffers() {
    const entries = [];
    Object.entries(DAILY_OFFERS).forEach(([listingId, offer]) => {
      const listing = getListing(listingId);
      const overridden = state.offers[listingId]?.date === todayISO();
      if (listing && !overridden) entries.push({ ...offer, listingId, listing, seeded: true });
    });
    Object.entries(state.offers).forEach(([listingId, offer]) => {
      const listing = getListing(listingId);
      if (!listing || !offer || offer.date !== todayISO()) return;
      entries.push({ ...offer, listingId, listing });
    });
    return entries;
  }

  function dailyOfferFor(listingId) {
    const offer = state.offers[listingId];
    return offer && offer.date === todayISO() ? offer : null;
  }

  /* ------------------------------ Historique ------------------------------ */

  function recordHistory(entry) {
    const item = { ...entry, at: Date.now() };
    const filtered = state.history.filter((old) => {
      if (entry.type === 'search') return !(old.type === 'search' && old.q === entry.q);
      if (entry.type === 'view') return !(old.type === 'view' && old.id === entry.id);
      return true;
    });
    state.history = [item, ...filtered].slice(0, 40);
    writeStorage(STORAGE.history, state.history);
  }

  /**
   * Suggestions : catégories issues des fiches consultées (poids 3), des
   * recherches reconnues (poids 2) et des comparaisons (poids 1).
   */
  function getSuggestions(limit = 4) {
    const weights = new Map();
    state.history.forEach((entry) => {
      if (entry.type === 'view' || entry.type === 'compare') {
        const listing = getListing(entry.id);
        if (listing) weights.set(listing.category, (weights.get(listing.category) || 0) + (entry.type === 'view' ? 3 : 1));
      }
      if (entry.type === 'search' && entry.q) {
        const needle = normalize(entry.q);
        state.listings.forEach((listing) => {
          if (normalize(listing.name).includes(needle) || normalize(listing.description).includes(needle)) {
            weights.set(listing.category, (weights.get(listing.category) || 0) + 2);
          }
        });
      }
    });

    const viewed = new Set(state.history.filter((entry) => entry.type === 'view').map((entry) => entry.id));
    const ranked = state.listings
      .filter((listing) => !viewed.has(listing.id) && weights.has(listing.category))
      .map((listing) => ({
        listing,
        weight: weights.get(listing.category),
        trust: getTrustScore(listing).score,
      }))
      .sort((a, b) => b.weight - a.weight || b.trust - a.trust || (b.listing.rating || 0) - (a.listing.rating || 0));

    return ranked.slice(0, limit).map((entry) => entry.listing);
  }

  /** Recherches récentes (pour les puces sous la barre de recherche). */
  function recentSearches(limit = 3) {
    return state.history
      .filter((entry) => entry.type === 'search' && entry.q)
      .slice(0, limit);
  }

  /* -------------------------------- Partage ------------------------------- */

  /** Base absolue du site (fonctionne en http(s) ; vide en file://). */
  function siteBase() {
    if (location.origin === 'null' || !/^https?:$/.test(location.protocol)) return '';
    return `${location.origin}${location.pathname.replace(/[^/]*$/, '')}`;
  }

  /** Page statique de partage (Open Graph lisible par WhatsApp). */
  function sharePageUrl(listing) {
    return `${siteBase()}partage/${slugify(listing.id)}.html`;
  }

  function listingUrl(listing) {
    return `${siteBase()}#/adresse/${listing.id}`;
  }

  function whatsappMessage(listing) {
    const name = listing.name;
    if (listing.category === 'restaurants') {
      return `Bonjour, je vous ai trouvé sur BamaHub. Je souhaite commander chez ${name}.`;
    }
    if (listing.category === 'hotels') {
      return `Bonjour, je vous ai trouvé sur BamaHub. Je souhaite réserver à ${name}.`;
    }
    if (listing.category === 'pharmacies') {
      return `Bonjour, je vous ai trouvé sur BamaHub. Avez-vous les médicaments suivants en stock ?`;
    }
    return `Bonjour, je vous ai trouvé sur BamaHub et je souhaite avoir des informations sur ${name}.`;
  }

  /** Lien WhatsApp direct avec message pré-rempli. */
  function whatsappContactUrl(listing) {
    // À défaut de numéro WhatsApp dédié, on réutilise le téléphone : chaque
    // fiche propose ainsi un contact WhatsApp avec un message pré-rempli.
    const number = String(listing.whatsapp || listing.phone || '').replace(/\D/g, '');
    if (!number) return '';
    return `https://wa.me/${number}?text=${encodeURIComponent(whatsappMessage(listing))}`;
  }

  /* --------------------------------- QR ----------------------------------- */

  function qrSvg(text, { cellSize = 4, margin = 2, label = '' } = {}) {
    if (!text || typeof window.qrcode !== 'function') return '';
    try {
      const qr = window.qrcode(0, 'M');
      // Mode octet : indispensable pour les caractères bambara (ɛ, ɔ, ɲ).
      qr.addData(String(text), 'Byte');
      qr.make();
      return qr.createSvgTag({
        cellSize,
        margin,
        scalable: true,
        alt: label || 'QR code',
        title: label || 'QR code',
      });
    } catch (error) {
      console.warn('BamaHub : génération du QR impossible.', error);
      return '';
    }
  }

  /** Lecture défensive du localStorage. */
  function readStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn(`BamaHub : lecture impossible de « ${key} ».`, error);
      return fallback;
    }
  }

  /** Écriture défensive (navigation privée, quota dépassé…). */
  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(`BamaHub : écriture impossible de « ${key} ».`, error);
      return false;
    }
  }

  /* ==========================================================================
     2. État de l'application
     ========================================================================== */

  const state = {
    listings: [],
    favorites: new Set(),
    filters: {},
    filtersOpen: false,
    addDraft: null,
    route: null,
    previousPath: null,
    lastExplorerHash: '#/explorer',
    initialized: false,
    accounts: [],
    session: null,
    authMode: 'login',
    // Carte & géolocalisation
    userLocation: null,
    nearMe: false,
    radius: DEFAULT_RADIUS,
    geoStatus: 'idle', // idle | locating | ready | denied | unavailable
    explorerMap: null,
    clusterLayer: null,
    userLayer: null,
    detailMap: null,
    formMap: null,
    formMarker: null,
    mapSignature: '',
    mapFitTimer: null,
    mapOfflineNoticeShown: false,
    authReturnRoute: '#/',
    authOpen: false,
    lastFocusedElement: null,
    // v2 : avis, promos, offres, comparaison, historique, préférences
    reviews: {},
    reports: [],
    promos: {},
    offers: {},
    history: [],
    compare: new Set(),
    dataSaver: 'auto',
    images: 'normal',
    voiceRecognition: null,
    voiceActive: false,
    reviewPhotoDraft: null,
    helpfulGiven: new Set(),
    searchHistoryTimer: null,
    settingsOpen: false,
  };

  /** Charge les adresses ajoutées localement + les favoris. */
  function loadState() {
    const savedCustom = readStorage(STORAGE.custom, []);
    const validCustom = Array.isArray(savedCustom)
      ? savedCustom.filter(
          (listing) =>
            listing &&
            typeof listing.id === 'string' &&
            typeof listing.name === 'string' &&
            CATEGORIES.some((cat) => cat.id === listing.category)
        )
      : [];

    state.listings = [
      ...validCustom.map((listing) => ({ ...listing, isCustom: true })),
      ...LISTINGS,
    ];

    const savedFavorites = readStorage(STORAGE.favorites, []);
    state.favorites = new Set(
      Array.isArray(savedFavorites)
        ? savedFavorites.filter((id) => state.listings.some((listing) => listing.id === id))
        : []
    );

    state.lastExplorerHash = readStorage(STORAGE.lastExplorer, '#/explorer') || '#/explorer';

    // Comptes locaux (démonstration) et session en cours.
    const accounts = readStorage(STORAGE.accounts, []);
    state.accounts = Array.isArray(accounts)
      ? accounts.filter((account) => account && account.email && account.name)
      : [];

    const session = readStorage(STORAGE.session, null);
    state.session = session?.email
      ? state.accounts.find((account) => account.email === session.email) || null
      : null;

    // Préférences et contenus de la v2 (tous optionnels).
    const reviews = readStorage(STORAGE.reviews, {});
    state.reviews = reviews && typeof reviews === 'object' && !Array.isArray(reviews) ? reviews : {};
    const reports = readStorage(STORAGE.reports, []);
    state.reports = Array.isArray(reports) ? reports.filter((report) => report && report.reviewId) : [];
    const promos = readStorage(STORAGE.promos, {});
    state.promos = promos && typeof promos === 'object' && !Array.isArray(promos) ? promos : {};
    const offers = readStorage(STORAGE.offers, {});
    state.offers = offers && typeof offers === 'object' && !Array.isArray(offers) ? offers : {};
    const history = readStorage(STORAGE.history, []);
    state.history = Array.isArray(history) ? history.filter((entry) => entry && entry.type) : [];
    const compare = readStorage(STORAGE.compare, []);
    state.compare = new Set(
      Array.isArray(compare) ? compare.filter((id) => state.listings.some((listing) => listing.id === id)).slice(0, 3) : []
    );
    const dataSaver = readStorage(STORAGE.dataSaver, 'auto');
    state.dataSaver = ['auto', 'on', 'off'].includes(dataSaver) ? dataSaver : 'auto';
    const images = readStorage(STORAGE.images, 'normal');
    state.images = ['normal', 'none'].includes(images) ? images : 'normal';
  }

  const getCategory = (id) => CATEGORIES.find((cat) => cat.id === id) || FALLBACK_CATEGORY;
  const getListing = (id) => state.listings.find((listing) => listing.id === id);

  const getPriceField = (cat) => cat.fields.find((field) => field.price);

  /** Valeur numérique de prix d'une adresse (ou null). */
  function getPriceValue(listing) {
    const field = getPriceField(getCategory(listing.category));
    if (!field) return null;
    const value = listing.fields?.[field.key];
    if (value === undefined || value === null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function getPriceInfo(listing) {
    const field = getPriceField(getCategory(listing.category));
    const value = getPriceValue(listing);
    if (!field || value === null) return null;
    return {
      field,
      value,
      prefix: field.prefix || '',
      suffix: field.suffix || '',
      money: field.money !== false,
    };
  }

  /** Enregistre uniquement les adresses créées par l'utilisateur. */
  function persistCustomListings() {
    writeStorage(
      STORAGE.custom,
      state.listings.filter((listing) => listing.isCustom)
    );
  }

  function persistFavorites() {
    writeStorage(STORAGE.favorites, [...state.favorites]);
  }

  function persistReviews() {
    return writeStorage(STORAGE.reviews, state.reviews);
  }

  function persistReports() {
    return writeStorage(STORAGE.reports, state.reports);
  }

  function persistCompare() {
    return writeStorage(STORAGE.compare, [...state.compare]);
  }

  function persistPromos() {
    return writeStorage(STORAGE.promos, state.promos);
  }

  function persistOffers() {
    return writeStorage(STORAGE.offers, state.offers);
  }

  /* ==========================================================================
     Icônes (SVG inline, aucune dépendance externe)
     ========================================================================== */

  const icon = (paths, options = '') =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${options}>${paths}</svg>`;

  const ICONS = {
    search: icon('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    searchX: icon('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="m8.5 8.5 5 5m0-5-5 5"/>'),
    mapPin: icon('<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/>'),
    clock: icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    star: icon('<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"/>', 'fill="currentColor" stroke="none"'),
    heart: icon('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'),
    arrowRight: icon('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'),
    arrowLeft: icon('<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>'),
    chevronRight: icon('<path d="m9 18 6-6-6-6"/>'),
    chevronDown: icon('<path d="m6 9 6 6 6-6"/>'),
    x: icon('<path d="M18 6 6 18M6 6l12 12"/>'),
    plus: icon('<path d="M12 5v14M5 12h14"/>'),
    phone: icon('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/>'),
    whatsapp: icon('<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/>'),
    share: icon('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>'),
    navigation: icon('<path d="m3 11 19-9-9 19-2-8-8-2Z"/>'),
    sliders: icon('<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4"/>'),
    checkCircle: icon('<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.4 2.4L16 9.5"/>'),
    xCircle: icon('<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>'),
    info: icon('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
    sparkles: icon('<path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>'),
    refresh: icon('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
    trash: icon('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/>'),
    marker: icon('<path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>'),
    list: icon('<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>'),
    map: icon('<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/>'),
    target: icon('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
    radius: icon('<circle cx="12" cy="12" r="8.5" stroke-dasharray="3 3"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/>'),
    crosshair: icon('<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'),
    route: icon('<circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="5" r="2.2"/><path d="M8.2 19h4.3a4 4 0 0 0 4-4V8.2"/>'),
    eye: icon('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.6"/>'),
    shield: icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>'),
    shieldAlert: icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="M12 8v4M12 16h.01"/>'),
    mic: icon('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8"/>'),
    qr: icon('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M20 20v.01M20 17h.01M17 20h.01"/>'),
    compare: icon('<path d="M4 4h6v16H4zM14 4h6v16h-6z"/><path d="M7 9h0M17 15h0"/>'),
    tag: icon('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
    camera: icon('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.2"/>'),
    printer: icon('<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/>'),
    settings: icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z"/>'),
    globe: icon('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>'),
    check: icon('<path d="m5 12 4 4L19 6"/>'),
    alert: icon('<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5M12 18h.01"/>'),
    imageOff: icon('<path d="m3 3 18 18"/><path d="M21 15V6a2 2 0 0 0-2-2H8M3 6v12a2 2 0 0 0 2 2h12"/><path d="m8 12 2 2 3-3"/>'),
    users: icon('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/>'),
    phoneCall: icon('<path d="M15.5 14.5 19 18a2 2 0 0 1-1.5 3.4A16 16 0 0 1 2.6 6.5 2 2 0 0 1 6 5l3.5 3.5-2 2a12.5 12.5 0 0 0 6 6l2-2Z"/>'),
    sparkle: icon('<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/>'),
  };

  /** Badge d'état d'ouverture, recalculé chaque minute par refreshOpenBadges(). */
  function openBadge(listing, { withDetail = false } = {}) {
    const status = getOpenState(listing);
    if (status.status === 'unknown') return '';
    return `<span class="open-badge is-${status.status}" data-open-badge="${escapeHtml(listing.id)}"${withDetail ? ' data-open-detail="true"' : ''} title="${escapeHtml(status.detail)}">
      <span class="dot" aria-hidden="true"></span>${escapeHtml(status.label)}
      ${withDetail ? `<span class="open-detail">· ${escapeHtml(status.detail)}</span>` : ''}
    </span>`;
  }

  /** Pastille d'indice de confiance. */
  function trustBadge(listing, { label = false } = {}) {
    const { score } = getTrustScore(listing);
    return `<span class="trust-badge is-${trustTier(score)}" title="${escapeHtml(t('card.trust', { score }))}">
      ${ICONS.shield}<strong>${score}</strong>${label ? `<span class="trust-label">${escapeHtml(t('detail.trust.title'))}</span>` : ''}
    </span>`;
  }

  const categoryIcon = (cat) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${cat.icon}</svg>`;

  /* ==========================================================================
     3. Composants
     ========================================================================== */

  /** Prix formaté pour une carte ou une fiche. */
  function priceMarkup(listing, { detailed = false } = {}) {
    const info = getPriceInfo(listing);
    if (!info) {
      return detailed
        ? `<span class="no-price">${escapeHtml(t('card.noPriceLong'))}</span>`
        : `<span class="no-price">${escapeHtml(t('card.noPrice'))}</span>`;
    }

    const prefix = info.prefix ? `<span class="price-prefix">${escapeHtml(info.prefix)}</span>` : '';
    const suffix = [info.money ? 'FCFA' : '', info.suffix].filter(Boolean).join(' ');
    const suffixMarkup = suffix ? `<span class="price-suffix">${escapeHtml(suffix)}</span>` : '';

    if (detailed) {
      return `${prefix}<span class="price-amount">${formatNumber(info.value)}${info.money ? ' <span class="currency">FCFA</span>' : ''}</span>${suffix ? `<span class="price-suffix">${escapeHtml(info.suffix)}</span>` : ''}`;
    }

    return `<span class="prefix">${escapeHtml(info.prefix)}</span><strong>${formatNumber(info.value)}</strong>${suffixMarkup ? `<span class="suffix">${escapeHtml(suffix)}</span>` : ''}`;
  }

  function ratingMarkup(listing) {
    const { avg, count } = aggregateRating(listing);
    if (!avg || !count) {
      return `<span class="pill pill-outline">${escapeHtml(t('card.new'))}</span>`;
    }
    return `<span class="card-rating" title="${escapeHtml(t('card.ratingTitle', { rating: formatRating(avg) }))}">${ICONS.star}<strong>${formatRating(avg)}</strong><span>${escapeHtml(t('card.reviews', { n: formatNumber(count) }))}</span></span>`;
  }

  function statusBadges(listing) {
    const cat = getCategory(listing.category);
    return cat.fields
      .filter((field) => field.type === 'boolean' && field.badge && listing.fields?.[field.key] === true)
      .map((field) => field.badge);
  }

  /** Bouton cœur des cartes : bascule l'état favori sans quitter la page. */
  function favoriteButton(listing) {
    const active = state.favorites.has(listing.id);
    const label = active ? t('detail.unfavorite') : t('detail.favorite');
    return `<button type="button" class="fav-btn${active ? ' is-active' : ''}"
      data-favorite="${escapeHtml(listing.id)}"
      aria-pressed="${active}"
      aria-label="${label} — ${escapeHtml(listing.name)}"
      title="${label}">
      ${ICONS.heart}
    </button>`;
  }

  /**
   * Carte d'adresse.
   * Le lien « étiré » (::after) rend toute la carte cliquable, tandis que le
   * bouton favori reste au-dessus grâce à son z-index.
   */
  function listingCard(listing, index = 0, { preview = false } = {}) {
    const cat = getCategory(listing.category);
    const badges = statusBadges(listing);
    const status = getOpenState(listing);
    const promo = promoFor(listing.id);
    const percent = promoPercent(promo);
    const photo = listingPhoto(listing);
    const compared = state.compare.has(listing.id);

    const mediaLabels = [];
    if (status.status !== 'unknown') {
      mediaLabels.push(
        `<span class="open-badge is-${status.status}" data-open-badge="${escapeHtml(listing.id)}" title="${escapeHtml(status.detail)}"><span class="dot" aria-hidden="true"></span>${escapeHtml(status.label)}</span>`
      );
    }
    if (promo) {
      mediaLabels.push(`<span class="promo-badge" title="${escapeHtml(promo.title)}">${ICONS.tag}${percent ? `−${escapeHtml(percent)} %` : escapeHtml(t('quick.promo'))}</span>`);
    }
    if (!mediaLabels.length) {
      mediaLabels.push(`<span class="media-badge">${escapeHtml(badges[0] || catLabel(cat))}</span>`);
    }

    const subcategory = listing.subcategories?.[0] || catLabel(cat);
    const title = preview
      ? `<span>${escapeHtml(listing.name)}</span>`
      : `<a href="#/adresse/${escapeHtml(listing.id)}">${escapeHtml(listing.name)}</a>`;

    return `<article class="listing-card${promo ? ' has-promo' : ''}" style="--cat:${escapeHtml(cat.color)};--i:${Math.min(index, 8)}" data-listing-id="${escapeHtml(listing.id)}"${preview ? ' data-preview="true"' : ''}>
      <div class="card-media${photo ? ' has-photo' : ''}">
        ${lazyImage(photo, { alt: '', className: 'card-photo', width: 640 })}
        <div class="media-icon">${categoryIcon(cat)}</div>
        ${preview ? '' : favoriteButton(listing)}
        <div class="media-labels">${mediaLabels.join('')}</div>
      </div>
      <div class="card-body">
        <p class="card-kicker">${escapeHtml(subcategory)} <span class="sep">·</span> ${escapeHtml(catLabel(cat))}</p>
        <h3 class="card-title">${title}</h3>
        <div class="card-badges">
          ${ratingMarkup(listing)}
          ${trustBadge(listing)}
        </div>
        ${distanceLabel(listing) ? `<p class="card-distance">${ICONS.crosshair} ${escapeHtml(t('card.distance', { distance: distanceLabel(listing) }))}</p>` : ''}
        <div class="card-meta">
          <span>${ICONS.mapPin} ${escapeHtml(listing.neighborhood || 'Bamako')}</span>
          <span class="card-hours">${ICONS.clock} ${escapeHtml(listing.hours || t('card.hoursUnknown'))}</span>
        </div>
        <p class="card-desc">${escapeHtml(listing.description || t('card.noDescription'))}</p>
        <div class="card-footer">
          <div class="card-price">${priceMarkup(listing)}</div>
          <div class="card-tools">
            <button type="button" class="compare-btn${compared ? ' is-active' : ''}" data-compare="${escapeHtml(listing.id)}"
              aria-pressed="${compared}" aria-label="${escapeHtml(t('explore.compare'))} — ${escapeHtml(listing.name)}"
              title="${escapeHtml(t('explore.compare'))}">
              ${compared ? ICONS.check : ICONS.compare}<span>${escapeHtml(compared ? t('detail.compare') : t('explore.compare'))}</span>
            </button>
            <span class="card-cta">${escapeHtml(preview ? t('card.preview') : t('card.view'))} ${ICONS.arrowRight}</span>
          </div>
        </div>
      </div>
    </article>`;
  }

  function listingGrid(listings, options = {}) {
    return `<div class="listing-grid stagger">${listings
      .map((listing, index) => listingCard(listing, index, options))
      .join('')}</div>`;
  }

  function emptyState({ title, text, action = '', iconMarkup = ICONS.search, small = false }) {
    return `<div class="empty-state${small ? ' is-small' : ''}">
      <div class="empty-illustration">${iconMarkup}</div>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(text)}</p>
      ${action}
    </div>`;
  }

  function breadcrumbs(items) {
    return `<nav class="breadcrumbs" aria-label="Fil d’Ariane">${items
      .map((item, index) => {
        const isLast = index === items.length - 1;
        const content = isLast
          ? `<span aria-current="page">${escapeHtml(item.label)}</span>`
          : `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`;
        return `${content}${isLast ? '' : ICONS.chevronRight}`;
      })
      .join('')}</nav>`;
  }

  /* ==========================================================================
     4. Pages
     ========================================================================== */

  /* ----------------------------- Accueil ---------------------------------- */
  function renderHome() {
    const total = state.listings.length;
    const latest = [...state.listings]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 3);
    const latestIds = new Set(latest.map((listing) => listing.id));
    const popular = [...state.listings]
      .sort((a, b) => (b.reviews || 0) - (a.reviews || 0) || (b.rating || 0) - (a.rating || 0))
      // On évite d'afficher deux fois la même adresse sur l'accueil.
      .filter((listing) => !latestIds.has(listing.id))
      .slice(0, 3);
    const duty = state.listings.filter((listing) => listing.fields?.onDuty === true);
    const offers = getDailyOffers().slice(0, 4);
    const suggestions = getSuggestions(4);
    const recents = recentSearches(2);
    const hasHistory = recents.length > 0 || suggestions.length > 0;

    const categoryCards = CATEGORIES.map((cat) => {
      const count = state.listings.filter((listing) => listing.category === cat.id).length;
      return `<a class="category-card" style="--cat:${escapeHtml(cat.color)}" href="#/explorer?cat=${escapeHtml(cat.id)}">
        <div class="cat-top">
          <span class="cat-icon">${categoryIcon(cat)}</span>
          <span class="cat-arrow">${ICONS.arrowRight}</span>
        </div>
        <div class="cat-info">
          <h3>${escapeHtml(catLabel(cat))}</h3>
          <p>${count} ${escapeHtml(count > 1 ? t('common.addresses') : t('common.address'))}</p>
        </div>
      </a>`;
    }).join('');

    const dutyMarkup = duty.length
      ? `<section class="section" aria-labelledby="duty-title">
          <div class="section-head">
            <div>
              <span class="eyebrow">${ICONS.shieldAlert} ${escapeHtml(t('home.duty.eyebrow'))}</span>
              <h2 id="duty-title">${escapeHtml(t('home.duty.title'))}</h2>
              <p>${escapeHtml(t('home.duty.sub'))}</p>
            </div>
            <a class="section-link" href="#/explorer?quick=duty">${escapeHtml(t('home.all'))} ${ICONS.arrowRight}</a>
          </div>
          <div class="home-duty-strip">
            ${duty
              .map((listing) => {
                const status = getOpenState(listing);
                const rawPhone = (listing.phone || '').replace(/[^\d+]/g, '');
                return `<a class="home-duty-card" href="#/adresse/${escapeHtml(listing.id)}">
                  <span class="pill-icon">${ICONS.shield}</span>
                  <span>
                    <strong>${escapeHtml(listing.name)}</strong>
                    <span>${escapeHtml(listing.neighborhood)} · ${escapeHtml(status.detail)}</span>
                  </span>
                  ${rawPhone ? `<span class="duty-call" aria-hidden="true">${ICONS.phone}</span>` : ''}
                </a>`;
              })
              .join('')}
          </div>
        </section>`
      : '';

    const offersMarkup = offers.length
      ? `<section class="section" aria-labelledby="offers-title">
          <div class="section-head">
            <div>
              <span class="eyebrow">${ICONS.sparkle} ${escapeHtml(t('home.offers.eyebrow'))}</span>
              <h2 id="offers-title">${escapeHtml(t('home.offers.title'))}</h2>
              <p>${escapeHtml(t('home.offers.sub'))}</p>
            </div>
          </div>
          <div class="offers-strip">
            ${offers
              .map(({ listing, title, price, description, photo: offerPhoto }) => {
                const cat = getCategory(listing.category);
                const photo = imagesEnabled() ? offerPhoto || (dataSaverActive() ? cat.photoSmall : cat.photo) : '';
                return `<a class="offer-card" href="#/adresse/${escapeHtml(listing.id)}">
                  ${photo ? `<img class="offer-thumb" src="${escapeHtml(photo)}" alt="" width="82" height="82" loading="lazy" decoding="async" />` : ''}
                  <span class="offer-body">
                    <span class="offer-eyebrow">${ICONS.sparkle}${escapeHtml(t('common.today'))}</span>
                    <strong>${escapeHtml(title)}</strong>
                    <span class="offer-price">${escapeHtml(t('home.offers.from'))} <b>${formatMoney(price)}</b></span>
                    <span class="offer-shop">${escapeHtml(listing.name)} · ${escapeHtml(listing.neighborhood || 'Bamako')}</span>
                  </span>
                </a>`;
              })
              .join('')}
          </div>
        </section>`
      : '';

    const suggestionMarkup = hasHistory
      ? `<div class="suggestion-chips" aria-label="${escapeHtml(t('home.forYou.title'))}">
          <span class="label">${escapeHtml(t('home.forYou.title'))}</span>
          ${recents
            .map(
              (entry) =>
                `<a class="suggestion-chip" href="#/explorer?q=${encodeURIComponent(entry.q)}">${ICONS.search}${escapeHtml(entry.q)}</a>`
            )
            .join('')}
          ${suggestions
            .slice(0, 3)
            .map(
              (listing) =>
                `<a class="suggestion-chip" href="#/adresse/${escapeHtml(listing.id)}">${ICONS.sparkle}${escapeHtml(listing.name)}</a>`
            )
            .join('')}
        </div>`
      : '';

    const forYouMarkup =
      suggestions.length > 0
        ? `<section class="section" aria-labelledby="foryou-title">
            <div class="section-head">
              <div>
                <span class="eyebrow">${ICONS.sparkle} ${escapeHtml(t('home.forYou.sub'))}</span>
                <h2 id="foryou-title">${escapeHtml(t('home.forYou.title'))}</h2>
              </div>
              <button type="button" class="section-link" data-clear-history>${ICONS.refresh} ${escapeHtml(t('home.forYou.clear'))}</button>
            </div>
            <div class="suggestion-chips">
              ${suggestions
                .map(
                  (listing) => `<a class="suggestion-chip" href="#/adresse/${escapeHtml(listing.id)}">
                    ${ICONS.sparkle}<strong>${escapeHtml(listing.name)}</strong> · ${escapeHtml(catLabel(getCategory(listing.category)))} · ${escapeHtml(listing.neighborhood || 'Bamako')}
                  </a>`
                )
                .join('')}
            </div>
          </section>`
        : '';

    document.title = 'BamaHub — L’annuaire de Bamako';

    $('#main').innerHTML = `
      <section class="hero">
        <div class="container hero-content">
          <span class="hero-eyebrow"><span class="dot"></span> ${escapeHtml(t('home.eyebrow'))}</span>
          <h1>${t('home.title')}</h1>
          <p class="hero-sub">${escapeHtml(t('home.sub'))}</p>

          <form class="search-form" data-search-form role="search">
            <div class="search-field">
              ${ICONS.search}
              <label class="sr-only" for="home-search">${escapeHtml(t('home.search.label'))}</label>
              <input id="home-search" type="search" name="q" placeholder="${escapeHtml(t('home.search.placeholder'))}" autocomplete="off" />
              <button type="button" class="mic-btn" data-voice="home" aria-label="${escapeHtml(t('explore.voice'))}" title="${escapeHtml(t('explore.voice'))}">${ICONS.mic}</button>
            </div>
            <button class="btn btn-primary search-submit" type="submit" aria-label="${escapeHtml(t('home.search.action'))}">
              <span class="search-submit-icon">${ICONS.search}</span>
              <span class="search-submit-label">${escapeHtml(t('home.search.action'))}</span>
            </button>
          </form>

          <div class="search-hints">
            <span>${escapeHtml(t('home.try'))}</span>
            <a class="hint-chip" href="#/explorer?quick=duty">${escapeHtml(t('quick.duty'))}</a>
            <a class="hint-chip" href="#/explorer?cat=restaurants">Riz au gras</a>
            <a class="hint-chip" href="#/explorer?q=poisson">Poisson braisé</a>
            <a class="hint-chip" href="#/explorer?cat=hotels">Hôtel ACI 2000</a>
          </div>

          ${suggestionMarkup}

          <div class="hero-stats">
            <div class="hero-stat"><strong>${total}</strong><span>${escapeHtml(t('home.stats.addresses'))}</span></div>
            <div class="hero-stat"><strong>${CATEGORIES.length}</strong><span>${escapeHtml(t('home.stats.categories'))}</span></div>
            <div class="hero-stat"><strong>${NEIGHBORHOODS.length}</strong><span>${escapeHtml(t('home.stats.hoods'))}</span></div>
            <div class="hero-stat"><strong>100 %</strong><span>${escapeHtml(t('home.stats.local'))}</span></div>
          </div>
        </div>
      </section>

      <div class="container">
        ${dutyMarkup}
        ${offersMarkup}

        <section class="section" aria-labelledby="categories-title">
          <div class="section-head">
            <div>
              <span class="eyebrow">${escapeHtml(t('home.explore.eyebrow'))}</span>
              <h2 id="categories-title">${escapeHtml(t('home.explore.title'))}</h2>
              <p>${escapeHtml(t('home.explore.sub'))}</p>
            </div>
          </div>
          <div class="category-grid stagger">${categoryCards}</div>
        </section>

        <section class="section" aria-labelledby="latest-title">
          <div class="section-head">
            <div>
              <span class="eyebrow">${escapeHtml(t('home.latest.eyebrow'))}</span>
              <h2 id="latest-title">${escapeHtml(t('home.latest.title'))}</h2>
              <p>${escapeHtml(t('home.latest.sub'))}</p>
            </div>
            <a class="section-link" href="#/explorer?sort=recent">${escapeHtml(t('home.all'))} ${ICONS.arrowRight}</a>
          </div>
          ${listingGrid(latest)}
        </section>

        <section class="section" aria-labelledby="popular-title">
          <div class="section-head">
            <div>
              <span class="eyebrow">${escapeHtml(t('home.popular.eyebrow'))}</span>
              <h2 id="popular-title">${escapeHtml(t('home.popular.title'))}</h2>
              <p>${escapeHtml(t('home.popular.sub'))}</p>
            </div>
            <a class="section-link" href="#/explorer?sort=note">${escapeHtml(t('home.all'))} ${ICONS.arrowRight}</a>
          </div>
          ${listingGrid(popular)}
        </section>

        ${forYouMarkup}

        <section class="section" aria-labelledby="hoods-title">
          <div class="section-head">
            <div>
              <span class="eyebrow">${escapeHtml(t('home.hoods.eyebrow'))}</span>
              <h2 id="hoods-title">${escapeHtml(t('home.hoods.title'))}</h2>
            </div>
          </div>
          <div class="hood-list">
            ${NEIGHBORHOODS.map(
              (hood) => `<a class="hood-chip" href="#/explorer?hood=${encodeURIComponent(hood)}">${ICONS.mapPin}${escapeHtml(hood)}</a>`
            ).join('')}
          </div>
        </section>

        <div class="cta-band">
          <div>
            <h2>${escapeHtml(t('home.cta.title'))}</h2>
            <p>${escapeHtml(t('home.cta.text'))}</p>
          </div>
          <a class="btn btn-white btn-lg" href="#/ajouter">${ICONS.plus} ${escapeHtml(t('home.cta.action'))}</a>
        </div>
      </div>`;
  }

  /* --------------------------- Explorateur -------------------------------- */
  function defaultFilters() {
    return { q: '', cat: '', sub: '', hood: '', quick: '', sort: 'pertinence', view: 'list' };
  }

  function filtersFromParams(params) {
    const filters = defaultFilters();
    const q = params.get('q');
    const cat = params.get('cat');
    const sub = params.get('sub');
    const hood = params.get('hood');
    const quick = params.get('quick');
    const sort = params.get('sort');
    const view = params.get('vue');

    if (q) filters.q = q;
    if (cat && CATEGORIES.some((item) => item.id === cat)) filters.cat = cat;
    if (sub) {
      const knownSubcategories = new Set(CATEGORIES.flatMap((item) => item.subcategories));
      if (knownSubcategories.has(sub)) filters.sub = sub;
    }
    if (hood && NEIGHBORHOODS.includes(hood)) filters.hood = hood;
    if (quick && QUICK_FILTERS.some((item) => item.id === quick)) filters.quick = quick;
    if (sort && SORT_OPTIONS.some((item) => item.id === sort)) filters.sort = sort;
    if (view === 'carte') filters.view = 'map';
    return filters;
  }

  function explorerHash(filters = state.filters) {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.cat) params.set('cat', filters.cat);
    if (filters.sub) params.set('sub', filters.sub);
    if (filters.hood) params.set('hood', filters.hood);
    if (filters.quick) params.set('quick', filters.quick);
    if (filters.sort && filters.sort !== 'pertinence') params.set('sort', filters.sort);
    if (filters.view === 'map') params.set('vue', 'carte');
    const query = params.toString();
    return `#/explorer${query ? `?${query}` : ''}`;
  }

  function syncExplorerUrl() {
    const hash = explorerHash();
    state.lastExplorerHash = hash;
    writeStorage(STORAGE.lastExplorer, hash);
    try {
      history.replaceState(null, '', hash);
    } catch (error) {
      // Certains navigateurs restrictent replaceState (file://) : on ignore.
    }
  }

  function activeFiltersCount() {
    const { q, cat, sub, hood, quick } = state.filters;
    return [q, cat, sub, hood, quick].filter(Boolean).length;
  }

  function subcategoryOptionsHTML(filters) {
    const categories = filters.cat
      ? [getCategory(filters.cat)]
      : CATEGORIES;
    const subcategories = [...new Set(categories.flatMap((cat) => cat.subcategories))].sort((a, b) =>
      a.localeCompare(b, 'fr')
    );
    return `<option value="">${escapeHtml(t('explore.allSubs'))}</option>${subcategories
      .map(
        (sub) =>
          `<option value="${escapeHtml(sub)}"${filters.sub === sub ? ' selected' : ''}>${escapeHtml(sub)}</option>`
      )
      .join('')}`;
  }

  function quickFiltersHTML(filters) {
    const pool = filters.cat
      ? state.listings.filter((listing) => listing.category === filters.cat)
      : state.listings;

    const available = QUICK_FILTERS.filter(
      (quick) => pool.some((listing) => quick.test(listing)) || filters.quick === quick.id
    );

    if (!available.length) return '';

    return `<div class="quick-filters" role="group" aria-label="${escapeHtml(t('explore.quickGroup'))}">
      <span class="label">${escapeHtml(t('explore.quickLabel'))}</span>
      ${available
        .map((quick) => {
          const active = filters.quick === quick.id;
          return `<button type="button" class="quick-chip${active ? ' is-active' : ''}" data-quick="${quick.id}" aria-pressed="${active}">
            ${ICONS.sparkles} ${escapeHtml(quickLabel(quick))}
          </button>`;
        })
        .join('')}
    </div>`;
  }

  function categoryChipsHTML(filters) {
    return `<div class="category-chips" role="group" aria-label="${escapeHtml(t('explore.filterByCat'))}">
      <button type="button" class="chip${filters.cat === '' ? ' is-active' : ''}" data-cat="" aria-pressed="${filters.cat === ''}">
        ${escapeHtml(t('explore.all'))} <span class="chip-count">${state.listings.length}</span>
      </button>
      ${CATEGORIES.map((cat) => {
        const count = state.listings.filter((listing) => listing.category === cat.id).length;
        const active = filters.cat === cat.id;
        return `<button type="button" class="chip${active ? ' is-active' : ''}" data-cat="${cat.id}" aria-pressed="${active}" style="--cat:${cat.color}">
          <span class="chip-dot"></span>${escapeHtml(catLabel(cat))} <span class="chip-count">${count}</span>
        </button>`;
      }).join('')}
    </div>`;
  }

  function renderExplorer(params) {
    state.filters = filtersFromParams(params);
    state.filtersOpen = false;
    const filters = state.filters;
    const cat = filters.cat ? getCategory(filters.cat) : null;

    const title = cat ? t('explore.catTitle', { cat: catLabel(cat) }) : t('explore.title');
    const subtitle = cat ? cat.tagline : t('explore.subtitle');

    document.title = cat ? `${catLabel(cat)} — BamaHub` : `${t('nav.explore')} — BamaHub`;
    const suggestions = getSuggestions(3);
    const recents = recentSearches(3);
    const dutyList = state.listings.filter((listing) => listing.fields?.onDuty === true);
    const dutyBanner =
      filters.quick === 'duty'
        ? `<aside class="duty-banner" aria-label="${escapeHtml(t('home.duty.title'))}">
            <span class="duty-icon">${ICONS.shieldAlert}</span>
            <div>
              <h2>${escapeHtml(t('home.duty.title'))}</h2>
              <p>${escapeHtml(t('home.duty.sub'))}</p>
            </div>
            <div class="duty-list">
              ${dutyList
                .map((listing) => {
                  const rawPhone = (listing.phone || '').replace(/[^\d+]/g, '');
                  return `<a class="duty-pill" href="tel:${escapeHtml(rawPhone)}" title="${escapeHtml(listing.name)}">${ICONS.phone}${escapeHtml(listing.name)}</a>`;
                })
                .join('')}
            </div>
          </aside>`
        : '';

    $('#main').innerHTML = `
      <div class="container page explorer-page">
        <div class="page-head">
          ${breadcrumbs([
            { label: t('nav.home'), href: '#/' },
            { label: t('nav.explore'), href: '#/explorer' },
            ...(cat ? [{ label: catLabel(cat), href: explorerHash({ ...defaultFilters(), cat: cat.id }) }] : []),
          ])}
          <h1 class="page-title">${escapeHtml(title)}</h1>
          <p class="page-sub">${escapeHtml(subtitle)}</p>
        </div>

        ${dutyBanner}

        <section class="explorer-toolbar" aria-label="Filtres de recherche">
          <div class="search-inline">
            ${ICONS.search}
            <label class="sr-only" for="filter-q">${escapeHtml(t('explore.search.label'))}</label>
            <input id="filter-q" class="input" type="search" placeholder="${escapeHtml(t('explore.search.placeholder'))}" value="${escapeHtml(filters.q)}" autocomplete="off" />
            <button type="button" class="mic-btn" data-voice="explorer" aria-label="${escapeHtml(t('explore.voice'))}" title="${escapeHtml(t('explore.voice'))}">${ICONS.mic}</button>
            <button type="button" class="search-clear" data-clear-search aria-label="${escapeHtml(t('explore.clear'))}" ${filters.q ? '' : 'hidden'}>${ICONS.x}</button>
          </div>

          ${recents.length || suggestions.length ? `<div class="suggestion-chips">
            <span class="label">${escapeHtml(t('explore.suggestions'))}</span>
            ${recents.map((entry) => `<a class="suggestion-chip" href="#/explorer?q=${encodeURIComponent(entry.q)}">${ICONS.search}${escapeHtml(entry.q)}</a>`).join('')}
            ${suggestions.map((listing) => `<a class="suggestion-chip" href="#/adresse/${escapeHtml(listing.id)}">${ICONS.sparkle}${escapeHtml(listing.name)}</a>`).join('')}
          </div>` : ''}

          ${categoryChipsHTML(filters)}

          <div class="quick-filters-slot">${quickFiltersHTML(filters)}</div>

          <button type="button" class="filters-toggle" data-filters-toggle aria-expanded="false" aria-controls="filters-panel">
            <span class="toggle-left">${ICONS.sliders} ${escapeHtml(t('explore.filters'))} <span class="filter-count" data-filter-count ${activeFiltersCount() ? '' : 'hidden'}>${activeFiltersCount()}</span></span>
            ${ICONS.chevronDown}
          </button>

          <div class="filters-panel" id="filters-panel">
            <div class="field">
              <label for="filter-hood">${escapeHtml(t('explore.hood'))}</label>
              <select id="filter-hood" class="select">
                <option value="">${escapeHtml(t('explore.allHoods'))}</option>
                ${NEIGHBORHOODS.map(
                  (hood) => `<option value="${escapeHtml(hood)}"${filters.hood === hood ? ' selected' : ''}>${escapeHtml(hood)}</option>`
                ).join('')}
              </select>
            </div>
            <div class="field">
              <label for="filter-sub">${escapeHtml(t('explore.sub'))}</label>
              <select id="filter-sub" class="select">${subcategoryOptionsHTML(filters)}</select>
            </div>
            <div class="field">
              <label for="filter-sort">${escapeHtml(t('explore.sort'))}</label>
              <select id="filter-sort" class="select">
                ${SORT_OPTIONS.map(
                  (option) => `<option value="${option.id}"${filters.sort === option.id ? ' selected' : ''}>${escapeHtml(sortLabel(option))}</option>`
                ).join('')}
              </select>
            </div>
            <button type="button" class="filters-reset" data-reset-filters>${ICONS.refresh} ${escapeHtml(t('explore.reset'))}</button>
          </div>
        </section>

        <div class="explorer-actions">
          <div class="view-toggle" role="group" aria-label="${escapeHtml(t('explore.view'))}">
            <button type="button" data-view="list" class="${filters.view === 'list' ? 'is-active' : ''}" aria-pressed="${filters.view === 'list'}">
              ${ICONS.list} ${escapeHtml(t('explore.list'))}
            </button>
            <button type="button" data-view="map" class="${filters.view === 'map' ? 'is-active' : ''}" aria-pressed="${filters.view === 'map'}">
              ${ICONS.map} ${escapeHtml(t('explore.map'))}
            </button>
          </div>
          <button type="button" class="near-me-toggle${state.nearMe ? ' is-active' : ''}" data-near-me aria-pressed="${state.nearMe}" aria-controls="near-me-bar">
            ${ICONS.target} <span data-near-me-label>${escapeHtml(state.nearMe ? t('explore.nearMeActive') : t('explore.nearMe'))}</span>
          </button>
        </div>

        <div class="near-me-bar" id="near-me-bar" data-near-me-bar ${state.nearMe ? '' : 'hidden'}>
          <span class="near-me-label">${ICONS.radius} ${escapeHtml(t('explore.radius'))}</span>
          <div class="radius-chips" role="group" aria-label="Rayon de recherche">
            ${RADIUS_OPTIONS.map(
              (option) => `<button type="button" class="radius-chip${option.value === state.radius ? ' is-active' : ''}" data-radius="${option.value}" aria-pressed="${option.value === state.radius}">${option.label}</button>`
            ).join('')}
          </div>
          <span class="near-me-info" data-near-me-info></span>
        </div>

        <div class="results-bar">
          <p class="results-count" data-results-count aria-live="polite"></p>
        </div>
        <div class="active-filters" data-active-filters></div>

        <div class="results-grid-wrap" data-list-view ${filters.view === 'map' ? 'hidden' : ''}>
          <div data-results-grid></div>
        </div>

        <div class="map-shell" data-map-shell data-map-view ${filters.view === 'map' ? '' : 'hidden'}>
          <div id="explorer-map" class="explorer-map" role="application" aria-label="Carte des adresses de Bamako"></div>
          <p class="map-hint">${ICONS.info} ${escapeHtml(t('explore.map.hint'))}</p>
        </div>
      </div>

      <div class="compare-tray" data-compare-tray hidden>
        <span class="tray-label">${escapeHtml(t('explore.compare'))}</span>
        <div class="tray-items" data-compare-items></div>
        <button type="button" class="btn btn-ghost btn-sm" data-compare-clear>${escapeHtml(t('explore.compareClear'))}</button>
        <a class="btn btn-primary btn-sm" data-compare-go href="#/comparer">${escapeHtml(t('explore.compare'))}</a>
        <span class="tray-hint">${escapeHtml(t('explore.compareHint'))}</span>
      </div>`;

    attachExplorerListeners();
    updateExplorerResults();
  }

  /** Construit la liste filtrée puis triée. */
  function getFilteredListings() {
    const { q, cat, sub, hood, quick, sort } = state.filters;
    let items = [...state.listings];

    // Mode « Autour de moi » : on ne garde que le rayon choisi.
    if (state.nearMe && state.userLocation) {
      items = items.filter((listing) => {
        const distance = distanceToListing(listing);
        return distance !== null && distance <= state.radius;
      });
    }

    if (cat) items = items.filter((listing) => listing.category === cat);
    if (hood) items = items.filter((listing) => listing.neighborhood === hood);
    if (sub) items = items.filter((listing) => (listing.subcategories || []).includes(sub));
    if (quick) {
      const quickFilter = QUICK_FILTERS.find((item) => item.id === quick);
      if (quickFilter) items = items.filter(quickFilter.test);
    }

    if (q) {
      const needle = normalize(q);
      const haystack = (listing) => {
        const category = getCategory(listing.category);
        return normalize(
          [
            listing.name,
            listing.description,
            listing.neighborhood,
            listing.address,
            listing.hours,
            category.label,
            category.tagline,
            ...(listing.subcategories || []),
            ...Object.values(listing.fields || {}).map((value) =>
              typeof value === 'boolean' ? (value ? 'oui' : 'non') : String(value ?? '')
            ),
          ].join(' ')
        );
      };

      // Le repère sert de secours : « pharmacie » renvoie d'abord les pharmacies,
      // mais une recherche par repère (« en face du marché ») reste possible.
      const coreMatches = items.filter((listing) => haystack(listing).includes(needle));
      items = coreMatches.length
        ? coreMatches
        : items.filter(
            (listing) =>
              haystack(listing).includes(needle) || normalize(listing.landmark || '').includes(needle)
          );
    }

    switch (sort) {
      case 'distance':
        // Les adresses sans coordonnées passent en fin de liste.
        items.sort((a, b) => (distanceToListing(a) ?? Infinity) - (distanceToListing(b) ?? Infinity));
        break;
      case 'note':
        items.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviews || 0) - (a.reviews || 0));
        break;
      case 'recent':
        items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        break;
      case 'prix-asc':
        items.sort((a, b) => (getPriceValue(a) ?? Infinity) - (getPriceValue(b) ?? Infinity));
        break;
      case 'prix-desc':
        items.sort((a, b) => (getPriceValue(b) ?? -Infinity) - (getPriceValue(a) ?? -Infinity));
        break;
      case 'confiance':
        items.sort((a, b) => getTrustScore(b).score - getTrustScore(a).score || (b.rating || 0) - (a.rating || 0));
        break;
      default:
        items.sort(
          (a, b) =>
            (b.rating || 0) * Math.log10((b.reviews || 0) + 10) -
            (a.rating || 0) * Math.log10((a.reviews || 0) + 10)
        );
    }

    return items;
  }

  function activeFiltersHTML() {
    const chips = [];
    const { q, cat, sub, hood, quick } = state.filters;
    const chip = (key, label) =>
      `<span class="active-filter">${escapeHtml(label)}<button type="button" data-remove-filter="${key}" aria-label="Retirer le filtre ${escapeHtml(label)}">${ICONS.x}</button></span>`;

    if (q) chips.push(chip('q', `« ${q} »`));
    if (cat) chips.push(chip('cat', getCategory(cat).label));
    if (sub) chips.push(chip('sub', sub));
    if (hood) chips.push(chip('hood', hood));
    if (quick) {
      const quickFilter = QUICK_FILTERS.find((item) => item.id === quick);
      if (quickFilter) chips.push(chip('quick', quickLabel(quickFilter)));
    }
    return chips.join('');
  }

  /** Met à jour uniquement la liste et les compteurs (garde le focus). */
  function updateExplorerResults() {
    const resultsGrid = $('[data-results-grid]');
    if (!resultsGrid) return;

    const items = getFilteredListings();
    const count = items.length;
    const { q, cat } = state.filters;

    const countEl = $('[data-results-count]');
    if (countEl) {
      const label = count === 1 ? t('explore.results.one') : t('explore.results.many');
      const forQuery = q ? ` ${t('explore.results.for', { q })}` : '';
      const forCat = cat ? ` · ${escapeHtml(catLabel(getCategory(cat)))}` : '';
      countEl.innerHTML = `<strong>${count}</strong> ${escapeHtml(label)}${escapeHtml(forQuery)}${forCat}`;
    }

    resultsGrid.innerHTML = count
      ? listingGrid(items)
      : emptyState({
          title: t('explore.empty.title'),
          text: t('explore.empty.text'),
          iconMarkup: ICONS.searchX,
          action: `<button type="button" class="btn btn-primary" data-reset-filters>${ICONS.refresh} ${escapeHtml(t('explore.reset'))}</button>`,
        });

    const activeEl = $('[data-active-filters]');
    if (activeEl) activeEl.innerHTML = activeFiltersHTML();

    const filterCount = $('[data-filter-count]');
    if (filterCount) {
      filterCount.textContent = activeFiltersCount();
      filterCount.hidden = activeFiltersCount() === 0;
    }

    // Synchronise les puces de catégorie et les filtres rapides.
    $$('.category-chips .chip').forEach((chip) => {
      const active = chip.dataset.cat === state.filters.cat;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
    $$('[data-quick]').forEach((chip) => {
      const active = chip.dataset.quick === state.filters.quick;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });

    const clearSearch = $('[data-clear-search]');
    if (clearSearch) clearSearch.hidden = !state.filters.q;

    // Bascule Liste / Carte : on garde les deux vues montées, on masque l'autre.
    const isMap = state.filters.view === 'map';
    const listWrap = $('[data-list-view]');
    const mapShell = $('[data-map-shell]');
    if (listWrap) listWrap.hidden = isMap;
    if (mapShell) mapShell.hidden = !isMap;

    if (isMap) {
      renderMapMarkers(items);
    } else if (state.explorerMap) {
      // Évite un décalage de tuiles lorsque la carte réapparaît.
      requestAnimationFrame(() => state.explorerMap?.invalidateSize());
    }

    updateNearMeUI(count);
    renderCompareTray();

    syncExplorerUrl();
  }

  /** Recharge le select de sous-catégories après un changement de catégorie. */
  function refreshSubcategorySelect() {
    const select = $('#filter-sub');
    if (select) select.innerHTML = subcategoryOptionsHTML(state.filters);
  }

  function refreshQuickFilters() {
    const slot = $('.quick-filters-slot');
    if (slot) slot.innerHTML = quickFiltersHTML(state.filters);
  }

  function refreshFilterControls() {
    const qInput = $('#filter-q');
    if (qInput) qInput.value = state.filters.q;
    const hood = $('#filter-hood');
    if (hood) hood.value = state.filters.hood;
    const sort = $('#filter-sort');
    if (sort) sort.value = state.filters.sort;
    refreshSubcategorySelect();
    const sub = $('#filter-sub');
    if (sub) sub.value = state.filters.sub;
    refreshQuickFilters();
  }

  function resetExplorerFilters() {
    state.filters = defaultFilters();
    state.nearMe = false;
    state.radius = DEFAULT_RADIUS;
    refreshFilterControls();
    updateExplorerResults();
  }

  /* --------------------------- Comparateur -------------------------------- */

  function compareListings() {
    return [...state.compare].map((id) => getListing(id)).filter(Boolean);
  }

  /** Met à jour la barre flottante et les boutons « Comparer » visibles. */
  function renderCompareTray() {
    const tray = $('[data-compare-tray]');
    if (!tray) return;
    const listings = compareListings();
    tray.hidden = listings.length === 0;

    const items = $('[data-compare-items]');
    if (items) {
      items.innerHTML = listings
        .map(
          (listing) => `<button type="button" class="compare-chip" data-compare-remove="${escapeHtml(listing.id)}"
            title="${escapeHtml(t('compare.remove'))} — ${escapeHtml(listing.name)}">
            ${escapeHtml(listing.name)} ${ICONS.x}
          </button>`
        )
        .join('');
    }

    const go = $('[data-compare-go]');
    if (go) {
      go.href = `#/comparer?ids=${listings.map((listing) => listing.id).join(',')}`;
      go.textContent = t('explore.compareSelected', { n: listings.length });
      go.setAttribute('aria-disabled', String(listings.length < 2));
    }
  }

  function syncCompareButtons(listingId) {
    const active = state.compare.has(listingId);
    $$(`[data-compare="${escapeSelector(listingId)}"]`).forEach((button) => {
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
      button.innerHTML = `${active ? ICONS.check : ICONS.compare}<span>${escapeHtml(active ? t('detail.compare') : t('explore.compare'))}</span>`;
    });
  }

  function toggleCompare(listingId) {
    if (!getListing(listingId)) return;
    if (state.compare.has(listingId)) {
      state.compare.delete(listingId);
    } else {
      if (state.compare.size >= 3) {
        showToast(t('explore.compareMax'));
        return;
      }
      state.compare.add(listingId);
      recordHistory({ type: 'compare', id: listingId });
    }
    persistCompare();
    syncCompareButtons(listingId);
    renderCompareTray();
    const count = state.compare.size;
    showToast(
      state.compare.has(listingId)
        ? t('explore.compareAdded', { n: count })
        : t('explore.compareRemoved')
    );
  }

  function renderCompare(route) {
    const ids = (route.params.get('ids') || '')
      .split(',')
      .map((id) => id.trim())
      .filter((id, index, array) => id && array.indexOf(id) === index)
      .slice(0, 3);
    const listings = ids.map((id) => getListing(id)).filter(Boolean);
    document.title = `${t('compare.title')} — BamaHub`;

    if (listings.length < 2) {
      $('#main').innerHTML = `<div class="container page">
        ${emptyState({
          title: t('compare.empty'),
          text: t('explore.compareHint'),
          iconMarkup: ICONS.compare,
          action: `<a class="btn btn-primary" href="#/explorer">${ICONS.arrowLeft} ${escapeHtml(t('compare.back'))}</a>`,
        })}
      </div>`;
      return;
    }

    const prices = listings.map((listing) => getPriceValue(listing)).filter((value) => value !== null);
    const bestPrice = prices.length ? Math.min(...prices) : null;
    const bestRating = Math.max(...listings.map((listing) => aggregateRating(listing).avg || 0));
    const bestTrust = Math.max(...listings.map((listing) => getTrustScore(listing).score));

    const row = (label, render) =>
      `<tr><th scope="row">${escapeHtml(label)}</th>${listings
        .map((listing) => `<td>${render(listing)}</td>`)
        .join('')}</tr>`;

    $('#main').innerHTML = `<div class="container page compare-page">
      <a class="back-link" href="#/explorer">${ICONS.arrowLeft} ${escapeHtml(t('compare.back'))}</a>
      <div class="page-head">
        <h1 class="page-title">${escapeHtml(t('compare.title'))}</h1>
        <p class="page-sub">${escapeHtml(t('compare.sub'))}</p>
      </div>

      <div class="table-scroll">
        <table class="compare-table">
          <thead>
            <tr>
              <th scope="col">${escapeHtml(t('compare.criteria'))}</th>
              ${listings
                .map((listing) => {
                  const cat = getCategory(listing.category);
                  return `<th scope="col">
                    <div class="compare-head">
                      <a href="#/adresse/${escapeHtml(listing.id)}">${escapeHtml(listing.name)}</a>
                      <span>${escapeHtml(catLabel(cat))} · ${escapeHtml(listing.neighborhood || 'Bamako')}</span>
                      <button type="button" class="compare-remove" data-compare-remove="${escapeHtml(listing.id)}">${ICONS.x} ${escapeHtml(t('compare.remove'))}</button>
                    </div>
                  </th>`;
                })
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${row(t('compare.category'), (listing) => escapeHtml(catLabel(getCategory(listing.category))))}
            ${row(t('compare.hood'), (listing) => escapeHtml(listing.neighborhood || 'Bamako'))}
            ${row(t('compare.price'), (listing) => `<span class="${getPriceValue(listing) === bestPrice && bestPrice !== null ? 'best' : ''}">${priceMarkup(listing, { detailed: true })}</span>`)}
            ${row(t('compare.rating'), (listing) => {
              const { avg, count } = aggregateRating(listing);
              return avg
                ? `<span class="${avg === bestRating ? 'best' : ''}">${ICONS.star} ${formatRating(avg)} / 5</span><br><span class="muted">${escapeHtml(t('detail.reviewsCount', { n: formatNumber(count) }))}</span>`
                : `<span class="muted">${escapeHtml(t('card.new'))}</span>`;
            })}
            ${row(t('compare.trust'), (listing) => {
              const score = getTrustScore(listing).score;
              return `<span class="${score === bestTrust ? 'best' : ''}">${escapeHtml(t('detail.trust.title'))} : ${score}/100</span>`;
            })}
            ${row(t('compare.distance'), (listing) => (distanceLabel(listing) ? escapeHtml(distanceLabel(listing)) : '—'))}
            ${row(t('compare.hours'), (listing) => escapeHtml(listing.hours || t('detail.hoursUnknown')))}
            ${row(t('compare.status'), (listing) => openBadge(listing, { withDetail: true }) || '—')}
            ${row(t('compare.phone'), (listing) => (listing.phone ? `<a href="tel:${escapeHtml(listing.phone.replace(/[^\d+]/g, ''))}">${escapeHtml(listing.phone)}</a>` : '—'))}
            ${row(t('compare.actions'), (listing) => `<div class="inline-actions">
              <a class="btn btn-primary btn-sm" href="#/adresse/${escapeHtml(listing.id)}">${escapeHtml(t('compare.view'))}</a>
              ${whatsappContactUrl(listing) ? `<a class="btn btn-whatsapp btn-sm" href="${escapeHtml(whatsappContactUrl(listing))}" target="_blank" rel="noopener">${ICONS.whatsapp} WhatsApp</a>` : ''}
            </div>`)}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  function attachExplorerListeners() {
    const qInput = $('#filter-q');
    qInput?.addEventListener('input', () => {
      state.filters.q = qInput.value;
      updateExplorerResults();
      // L'historique n'enregistre que les recherches stabilisées (pas chaque lettre).
      clearTimeout(state.searchHistoryTimer);
      state.searchHistoryTimer = setTimeout(() => {
        const value = qInput.value.trim();
        if (value.length >= 2) recordHistory({ type: 'search', q: value });
      }, 900);
    });

    $('[data-clear-search]')?.addEventListener('click', () => {
      state.filters.q = '';
      if (qInput) {
        qInput.value = '';
        qInput.focus();
      }
      updateExplorerResults();
    });

    $('.category-chips')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-cat]');
      if (!button) return;
      state.filters.cat = button.dataset.cat;
      state.filters.sub = '';
      refreshSubcategorySelect();
      refreshQuickFilters();
      updateExplorerResults();
    });

    $('#filter-hood')?.addEventListener('change', (event) => {
      state.filters.hood = event.target.value;
      updateExplorerResults();
    });

    $('#filter-sub')?.addEventListener('change', (event) => {
      state.filters.sub = event.target.value;
      updateExplorerResults();
    });

    $('#filter-sort')?.addEventListener('change', (event) => {
      state.filters.sort = event.target.value;
      updateExplorerResults();
    });

    // Bascule Liste / Carte.
    $$('[data-view]').forEach((button) => {
      button.addEventListener('click', () => {
        const view = button.dataset.view;
        if (state.filters.view === view) return;
        state.filters.view = view;
        $$('[data-view]').forEach((item) => {
          const active = item.dataset.view === view;
          item.classList.toggle('is-active', active);
          item.setAttribute('aria-pressed', String(active));
        });
        updateExplorerResults();
      });
    });

    $('[data-near-me]')?.addEventListener('click', toggleNearMe);

    $$('[data-radius]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const radius = Number(chip.dataset.radius);
        if (radius === state.radius) return;
        state.radius = radius;
        updateNearMeUI();
        updateExplorerResults();
      });
    });

    $('[data-filters-toggle]')?.addEventListener('click', (event) => {
      const button = event.currentTarget;
      const panel = $('#filters-panel');
      state.filtersOpen = !state.filtersOpen;
      panel?.classList.toggle('is-open', state.filtersOpen);
      button.setAttribute('aria-expanded', String(state.filtersOpen));
    });

    $('.explorer-page')?.addEventListener('click', (event) => {
      const quick = event.target.closest('[data-quick]');
      if (quick) {
        state.filters.quick = state.filters.quick === quick.dataset.quick ? '' : quick.dataset.quick;
        updateExplorerResults();
        return;
      }
      const remove = event.target.closest('[data-remove-filter]');
      if (remove) {
        const key = remove.dataset.removeFilter;
        state.filters[key] = '';
        if (key === 'cat') {
          state.filters.sub = '';
          refreshSubcategorySelect();
          refreshQuickFilters();
        }
        refreshFilterControls();
        updateExplorerResults();
        return;
      }
      if (event.target.closest('[data-reset-filters]')) {
        resetExplorerFilters();
      }
    });
  }

  /* ----------------------------- Fiche détail ----------------------------- */
  function statusFact(field, value) {
    const labels = fieldValueLabels(field);
    const text = labels[value ? 'true' : 'false'] || (value ? 'Oui' : 'Non');
    const statusIcon = value ? ICONS.checkCircle : ICONS.xCircle;
    return `<div class="fact"><span class="fact-label">${escapeHtml(fieldLabel(field))}</span>
      <span class="status ${value ? 'status-yes' : 'status-no'}">${statusIcon} ${escapeHtml(text)}</span></div>`;
  }

  function fieldFact(field, value) {
    if (field.type === 'boolean') return statusFact(field, value === true);

    let text = String(value);
    if (field.type === 'number') {
      text = formatNumber(value);
      if (field.money) text += ' FCFA';
      if (field.suffix) text += ` ${field.suffix}`;
      if (field.prefix) text = `${field.prefix} ${text}`;
    }
    return `<div class="fact"><span class="fact-label">${escapeHtml(fieldLabel(field))}</span><span class="fact-value">${escapeHtml(text)}</span></div>`;
  }

  /** Transforme un texte multi-lignes en liste (avec prix si « — » présent). */
  function linesMarkup(text) {
    const lines = String(text)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return '';
    const hasPrices = lines.some((line) => line.includes(' — '));

    return `<ul class="line-list${hasPrices ? '' : ' plain'}">${lines
      .map((line) => {
        if (hasPrices && line.includes(' — ')) {
          const [main, ...rest] = line.split(' — ');
          return `<li><span class="line-main">${escapeHtml(main)}</span><span class="line-price">${escapeHtml(rest.join(' — '))}</span></li>`;
        }
        return `<li><span class="line-main">${escapeHtml(line)}</span></li>`;
      })
      .join('')}</ul>`;
  }


  /* ------------------------ Avis : rendu et formulaires ------------------- */

  // Mois bambara : Intl ne fournit pas encore de locale « bm » fiable dans
  // les navigateurs, on garde donc une liste locale explicite.
  const BM_MONTHS = [
    'zanwuye', 'feburuye', 'marisi', 'awirili', 'mɛ', 'zuwɛn',
    'zuluye', 'uti', 'sɛtanburu', 'ɔkutɔburu', 'nowanburu', 'desanburu',
  ];

  function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(`${dateString}T12:00:00`);
    if (Number.isNaN(date.getTime())) return dateString;
    if (getLang() === 'bm') {
      return `${date.getDate()} ${BM_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
    }
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  }

  /** Rangée d'étoiles en SVG (pleines ou grisées). */
  function starsRow(rating, className = 'review-stars') {
    const stars = [1, 2, 3, 4, 5]
      .map((step) => `<span class="${step <= Math.round(rating) ? '' : 'off'}">${ICONS.star}</span>`)
      .join('');
    return `<span class="${className}" aria-label="${escapeHtml(t('detail.review.starsLabel', { n: Math.round(rating) }))}">${stars}</span>`;
  }

  function reviewItemMarkup(review, listing) {
    const initials = String(review.author || '?')
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    return `<article class="review-item${review.mine ? ' is-mine' : ''}${review.reported ? ' is-reported' : ''}" data-review-item="${escapeHtml(review.id)}">
      <span class="review-avatar" aria-hidden="true">${escapeHtml(initials)}</span>
      <div>
        <div class="review-head">
          <strong>${escapeHtml(review.author)}</strong>
          ${review.verified ? `<span class="review-verified">${ICONS.check}${escapeHtml(t('detail.review.verified'))}</span>` : ''}
          <span class="review-date">${escapeHtml(formatDate(review.date))}</span>
        </div>
        ${starsRow(review.rating)}
        <p class="review-text"${review.lang === 'bm' ? ' lang="bm"' : ''}>${escapeHtml(review.text)}</p>
        ${review.photo && imagesEnabled() ? `<img class="review-photo" src="${escapeHtml(review.photo)}" alt="${escapeHtml(t('detail.review.photoAlt', { author: review.author }))}" loading="lazy" decoding="async" />` : ''}
        <div class="review-actions">
          <button type="button" class="review-action" data-helpful="${escapeHtml(review.id)}" data-count="${Number(review.helpful) || 0}">
            ${ICONS.sparkles}<span data-helpful-label>${escapeHtml(t('detail.review.helpful'))}${review.helpful ? ` (${review.helpful})` : ''}</span>
          </button>
          <button type="button" class="review-action is-warn" data-report-review="${escapeHtml(review.id)}" data-listing="${escapeHtml(listing.id)}"${review.reported ? ' disabled' : ''}>
            ${ICONS.alert}${escapeHtml(review.reported ? t('detail.review.alreadyReported') : t('detail.review.report'))}
          </button>
        </div>
      </div>
    </article>`;
  }

  function reviewFormMarkup(listing) {
    if (!state.session) {
      return `<div class="review-login-note">
        ${ICONS.info}<span>${escapeHtml(t('detail.review.login'))}</span>
        <button type="button" class="btn btn-soft btn-sm" data-auth-open="login">${escapeHtml(t('auth.login'))}</button>
      </div>`;
    }
    return `<form class="review-form" data-review-form data-listing="${escapeHtml(listing.id)}">
      <h3>${escapeHtml(t('detail.review.write'))}</h3>
      <div class="star-input" role="radiogroup" aria-label="${escapeHtml(t('detail.review.yourRating'))}" data-star-input>
        ${[1, 2, 3, 4, 5]
          .map(
            (step) => `<button type="button" data-star="${step}" aria-label="${escapeHtml(t('detail.review.starsLabel', { n: step }))}" aria-checked="false" role="radio">${ICONS.star}</button>`
          )
          .join('')}
        <input type="hidden" name="rating" value="0" data-rating-value />
      </div>
      <label class="sr-only" for="review-text-${escapeHtml(listing.id)}">${escapeHtml(t('detail.review.placeholder'))}</label>
      <textarea id="review-text-${escapeHtml(listing.id)}" name="text" class="input" maxlength="600" required placeholder="${escapeHtml(t('detail.review.placeholder'))}"></textarea>
      <div class="form-foot">
        <label class="photo-btn">
          ${ICONS.camera}<span>${escapeHtml(t('detail.review.addPhoto'))}</span>
          <input type="file" accept="image/*" data-review-photo hidden />
        </label>
        <span class="photo-preview" data-photo-preview hidden></span>
        <button class="btn btn-primary" type="submit">${escapeHtml(t('detail.review.submit'))}</button>
      </div>
    </form>`;
  }

  function reviewsPanelMarkup(listing) {
    const reviews = reviewsFor(listing.id);
    const { avg, count } = aggregateRating(listing);
    // La répartition n'a de sens que si l'on connaît tous les avis. Les fiches
    // de démonstration affichent une note agrégée (214 avis) mais seulement
    // quelques avis détaillés : on n'invente donc pas de pourcentages.
    const completeSample = count === reviews.length;
    const distribution = [5, 4, 3, 2, 1].map((note) => {
      const total = reviews.filter((review) => Math.round(review.rating) === note).length;
      return { note, total, pct: reviews.length ? Math.round((total / reviews.length) * 100) : 0 };
    });

    return `<section class="panel reviews-panel" id="avis" aria-labelledby="reviews-title">
      <h2 class="panel-title" id="reviews-title">${ICONS.star} ${escapeHtml(t('detail.reviews'))}
        <span class="pill pill-outline">${formatNumber(count)}</span>
      </h2>

      ${
        avg
          ? `<div class="review-summary">
              <div class="review-score">
                <span class="big">${formatRating(avg)}</span>
                <span>
                  ${starsRow(avg, 'stars')}
                  <span class="count">${escapeHtml(t('detail.reviewsCount', { n: formatNumber(count) }))}</span>
                </span>
              </div>
              ${
                completeSample
                  ? `<div class="rating-bars" aria-label="${escapeHtml(t('detail.review.distribution'))}">
                      ${distribution
                        .map(
                          (entry) => `<div class="rating-bar">
                            <span>${entry.note}</span>
                            <span class="bar"><span style="width:${entry.pct}%"></span></span>
                            <span>${entry.pct}%</span>
                          </div>`
                        )
                        .join('')}
                    </div>`
                  : `<p class="review-sample-note">${ICONS.info} ${escapeHtml(
                      t('detail.review.sample', { total: formatNumber(count), shown: reviews.length })
                    )}</p>`
              }
            </div>`
          : ''
      }

      <div class="review-list">
        ${
          reviews.length
            ? reviews.map((review) => reviewItemMarkup(review, listing)).join('')
            : `<p class="review-login-note">${ICONS.info}${escapeHtml(t('detail.review.empty'))}</p>`
        }
      </div>

      ${reviewFormMarkup(listing)}
    </section>`;
  }

  /* ------------------- Confiance, promotions, offre du jour --------------- */

  function trustPanelMarkup(listing) {
    const trust = getTrustScore(listing);
    const rows = [
      { label: t('detail.trust.profile'), value: trust.profile, max: 45 },
      { label: t('detail.trust.reviews'), value: trust.reviews, max: 35 },
      { label: t('detail.trust.seniority'), value: trust.seniority, max: 20 },
    ];
    return `<section class="panel trust-panel" aria-labelledby="trust-title">
      <h2 class="panel-title" id="trust-title">${ICONS.shield} ${escapeHtml(t('detail.trust.title'))}</h2>
      <div class="trust-head">
        <span class="trust-ring is-${trustTier(trust.score)}" style="--pct:${trust.score}"><span>${trust.score}</span></span>
        <div>
          <strong>${escapeHtml(t('detail.trust.sub'))}</strong>
          <p>${escapeHtml(t('detail.trust.note'))}</p>
        </div>
      </div>
      <div class="trust-bars">
        ${rows
          .map(
            (row) => `<div class="trust-bar-row">
              <span>${escapeHtml(row.label)}</span>
              <span class="trust-track"><span class="trust-fill" style="width:${Math.round((row.value / row.max) * 100)}%"></span></span>
              <strong>${row.value}/${row.max}</strong>
            </div>`
          )
          .join('')}
      </div>
    </section>`;
  }

  function promoPanelMarkup(listing) {
    const promo = promoFor(listing.id);
    const canManage = Boolean(state.session);
    if (!promo && !canManage) return '';
    const qrPayload = promo ? `PROMO ${promo.code} — ${listing.name} — ${listingUrl(listing)}` : '';
    return `<section class="panel promo-card" aria-labelledby="promo-title">
      <div class="promo-top">
        <span class="promo-icon">${ICONS.tag}</span>
        <h2 id="promo-title">${escapeHtml(t('detail.promo.title'))}</h2>
      </div>
      ${
        promo
          ? `<p class="promo-title">${escapeHtml(promo.title)}</p>
             ${promo.detail ? `<p class="promo-detail">${escapeHtml(promo.detail)}</p>` : ''}
             <div class="coupon-row">
               <span class="coupon-code">${escapeHtml(promo.code)}</span>
               <button type="button" class="btn btn-soft btn-sm" data-copy="${escapeHtml(promo.code)}">${ICONS.share} ${escapeHtml(t('detail.promo.copy'))}</button>
               ${qrSvg(qrPayload, { cellSize: 4, margin: 2, label: promo.code }) ? `<button type="button" class="btn btn-ghost btn-sm" data-toggle-coupon-qr>${ICONS.qr} ${escapeHtml(t('detail.promo.showQr'))}</button>` : ''}
             </div>
             <p class="coupon-expiry">${escapeHtml(t('detail.promo.expires', { date: formatDate(promo.expires) }))}</p>
             <div class="coupon-qr" data-coupon-qr hidden>${qrSvg(qrPayload, { cellSize: 4, margin: 2, label: promo.code })}</div>
             ${canManage ? `<button type="button" class="btn btn-danger-soft btn-sm" data-remove-promo="${escapeHtml(listing.id)}" style="margin-top:0.7rem">${escapeHtml(t('detail.promo.remove'))}</button>` : ''}`
          : ''
      }
      ${
        canManage
          ? `<details class="promo-editor" style="margin-top:${promo ? '0.8rem' : '0'}">
              <summary class="btn btn-soft btn-sm">${ICONS.plus} ${escapeHtml(t('detail.promo.create'))}</summary>
              <form class="daily-form" data-promo-form data-listing="${escapeHtml(listing.id)}">
                <div class="field"><label>${escapeHtml(t('detail.promo.formTitle'))}</label><input class="input" name="title" required maxlength="80" placeholder="-10 % sur le plat du jour" /></div>
                <div class="field"><label>${escapeHtml(t('detail.promo.formCode'))}</label><input class="input" name="code" required maxlength="18" pattern="[A-Za-z0-9\\-]+" placeholder="BAOBAB10" /></div>
                <div class="field"><label>${escapeHtml(t('detail.promo.formDetail'))}</label><input class="input" name="detail" maxlength="120" /></div>
                <div class="field"><label>${escapeHtml(t('detail.promo.formExpires'))}</label><input class="input" type="date" name="expires" required /></div>
                <p class="settings-hint">${escapeHtml(t('detail.promo.merchantHint'))}</p>
                <div class="inline-actions"><button class="btn btn-primary btn-sm" type="submit">${escapeHtml(t('detail.promo.save'))}</button></div>
              </form>
            </details>`
          : ''
      }
    </section>`;
  }

  function dailyOfferPanelMarkup(listing) {
    const offer = dailyOfferFor(listing.id);
    const seed = !offer && DAILY_OFFERS[listing.id] ? DAILY_OFFERS[listing.id] : null;
    const current = offer || seed;
    const canManage = Boolean(state.session);
    return `<section class="panel" aria-labelledby="daily-title">
      <h2 class="panel-title" id="daily-title">${ICONS.sparkle} ${escapeHtml(t('detail.daily.title'))}</h2>
      ${
        current
          ? `<div class="daily-offer">
              <span class="offer-icon">${ICONS.sparkle}</span>
              <div class="offer-main">
                <h3>${escapeHtml(current.title)}</h3>
                ${current.description ? `<p>${escapeHtml(current.description)}</p>` : ''}
                <p class="settings-hint">${escapeHtml(t('detail.daily.on'))}</p>
              </div>
              <span class="offer-amount">${formatMoney(current.price)}</span>
            </div>`
          : `<p class="settings-hint">${escapeHtml(t('detail.daily.none'))}</p>`
      }
      ${
        canManage
          ? `<details class="daily-editor" style="margin-top:0.8rem">
              <summary class="btn btn-soft btn-sm">${ICONS.plus} ${escapeHtml(offer ? t('detail.daily.edit') : t('detail.daily.publish'))}</summary>
              <form class="daily-form" data-daily-form data-listing="${escapeHtml(listing.id)}">
                <div class="field"><label>${escapeHtml(t('detail.daily.title'))}</label><input class="input" name="title" required maxlength="80" value="${escapeHtml(offer?.title || '')}" /></div>
                <div class="field"><label>${escapeHtml(t('detail.daily.price'))}</label><input class="input" type="number" name="price" min="0" step="100" required value="${escapeHtml(String(offer?.price || ''))}" /></div>
                <div class="field"><label>${escapeHtml(t('detail.daily.desc'))}</label><input class="input" name="description" maxlength="140" value="${escapeHtml(offer?.description || '')}" /></div>
                <p class="settings-hint">${escapeHtml(t('detail.daily.merchantHint'))}</p>
                <div class="inline-actions">
                  <button class="btn btn-primary btn-sm" type="submit">${escapeHtml(t('detail.daily.submit'))}</button>
                  ${offer ? `<button class="btn btn-ghost btn-sm" type="button" data-remove-offer="${escapeHtml(listing.id)}">${escapeHtml(t('detail.daily.delete'))}</button>` : ''}
                </div>
              </form>
            </details>`
          : ''
      }
    </section>`;
  }

  function qrPanelMarkup(listing) {
    const target = sharePageUrl(listing) || listingUrl(listing);
    const svg = qrSvg(target, { cellSize: 4, margin: 2, label: `${listing.name} — BamaHub` });
    if (!svg) return '';
    return `<section class="panel qr-panel" aria-labelledby="qr-title">
      <h2 class="panel-title" id="qr-title">${ICONS.qr} ${escapeHtml(t('detail.qr.title'))}</h2>
      <div class="qr-block">
        <div class="qr-preview">${svg}</div>
        <div class="qr-info">
          <h3>${escapeHtml(listing.name)}</h3>
          <p>${escapeHtml(t('detail.qr.hint'))}</p>
          <div class="inline-actions">
            <button type="button" class="btn btn-soft btn-sm" data-print-qr="${escapeHtml(listing.id)}">${ICONS.printer} ${escapeHtml(t('detail.qr.print'))}</button>
            <button type="button" class="btn btn-ghost btn-sm" data-copy="${escapeHtml(target)}">${ICONS.share} ${escapeHtml(t('detail.share'))}</button>
          </div>
        </div>
      </div>
    </section>`;
  }

  /** Affiche l'affiche vitrine dans #print-root puis lance l'impression. */
  function printQrSheet(listing) {
    const target = sharePageUrl(listing) || listingUrl(listing);
    const svg = qrSvg(target, { cellSize: 6, margin: 3, label: `${listing.name} — BamaHub` });
    if (!svg) {
      showToast(t('detail.qr.fallback'));
      return;
    }
    const promo = promoFor(listing.id);
    const root = $('#print-root');
    if (!root) return;
    root.innerHTML = `<div class="qr-sheet">
      <div class="sheet-brand">BamaHub · Bamako</div>
      <h2>${escapeHtml(listing.name)}</h2>
      <p class="sheet-cat">${escapeHtml(catLabel(getCategory(listing.category)))} · ${escapeHtml(listing.neighborhood || 'Bamako')}</p>
      <div class="sheet-qr">${svg}</div>
      <p class="sheet-cta">${escapeHtml(t('detail.qr.hint'))}</p>
      <p class="sheet-address">${escapeHtml(listing.address)}<br />${escapeHtml(listing.phone || '')}</p>
      ${promo ? `<span class="sheet-code">${escapeHtml(promo.code)}</span>` : ''}
    </div>`;
    document.body.classList.add('is-printing');
    window.print();
    // Nettoyage différé : le dialogue d'impression peut être bloquant (Chrome)
    // ou asynchrone (Safari). On laisse donc le temps nécessaire puis on rend
    // la page normale, sans dépendre d'un unique événement.
    setTimeout(() => {
      document.body.classList.remove('is-printing');
      root.innerHTML = '';
    }, 1500);
  }

  /* --------------------- Photos d'avis (compression) ---------------------- */

  async function compressImage(file, { maxWidth = 900, quality = 0.72 } = {}) {
    if (!file || !/^image\//.test(file.type || '')) return null;
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch (error) {
      return null;
    }
    const scale = Math.min(1, maxWidth / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    return canvas.toDataURL('image/jpeg', quality);
  }

  function renderDetail(route) {
    const listing = getListing(route.segments[1]);
    if (!listing) {
      renderNotFound(t('detail.notFound'), t('notFound.title'));
      return;
    }

    const cat = getCategory(listing.category);
    const isFavorite = state.favorites.has(listing.id);
    const statuses = statusBadges(listing);
    const priceInfo = getPriceInfo(listing);
    const rawPhone = (listing.phone || '').replace(/[^\d+]/g, '');
    const waNumber = (listing.whatsapp || '').replace(/\D/g, '');
    const rating = aggregateRating(listing);
    const status = getOpenState(listing);
    const waContact = whatsappContactUrl(listing);
    const canManage = Boolean(state.session);
    const compareActive = state.compare.has(listing.id);
    document.title = `${listing.name} — BamaHub`;

    // Une fiche consultée nourrit les suggestions personnalisées.
    recordHistory({ type: 'view', id: listing.id });

    // Champs spécifiques : textes longs dans des panneaux, le reste en fiches.
    const contentFields = cat.fields.filter((field) => {
      const value = listing.fields?.[field.key];
      return field.type === 'textarea' && value && String(value).trim();
    });
    const factFields = cat.fields.filter((field) => {
      const value = listing.fields?.[field.key];
      if (field.price || field.type === 'textarea') return false;
      return value !== undefined && value !== null && value !== '';
    });

    const infoPanel = factFields.length
      ? `<section class="panel">
          <h2 class="panel-title">${ICONS.info} ${escapeHtml(t('detail.info'))}</h2>
          <div class="fact-list">${factFields.map((field) => fieldFact(field, listing.fields[field.key])).join('')}</div>
        </section>`
      : '';

    const contentPanels = contentFields
      .map(
        (field) => `<section class="panel">
          <h2 class="panel-title">${ICONS.checkCircle} ${escapeHtml(fieldLabel(field))}</h2>
          ${linesMarkup(listing.fields[field.key])}
        </section>`
      )
      .join('');

    const similar = state.listings
      .filter((item) => item.category === listing.category && item.id !== listing.id)
      .sort((a, b) => (b.reviews || 0) - (a.reviews || 0))
      .slice(0, 3);

    $('#main').innerHTML = `
      <div class="container detail-page page">
        <a class="back-link" href="${escapeHtml(state.lastExplorerHash || '#/explorer')}">${ICONS.arrowLeft} ${escapeHtml(t('detail.back'))}</a>
        ${breadcrumbs([
          { label: t('nav.home'), href: '#/' },
          { label: catLabel(cat), href: explorerHash({ ...defaultFilters(), cat: cat.id }) },
          { label: listing.name, href: '#/adresse/' + listing.id },
        ])}

        <header class="detail-hero" style="--cat:${escapeHtml(cat.color)}">
          <div class="detail-top">
            <span class="detail-icon">${categoryIcon(cat)}</span>
            <div class="detail-heading">
              <div class="detail-badge-row">
                <span class="pill pill-cat">${escapeHtml(catLabel(cat))}</span>
                ${statuses.map((badge) => `<span class="pill pill-success pill-dot">${escapeHtml(badge)}</span>`).join('')}
                ${isNew(listing.createdAt) && rating.count < 10 ? `<span class="pill pill-outline">${escapeHtml(t('card.new'))}</span>` : ''}
                ${listing.isCustom ? `<span class="pill pill-outline">${escapeHtml(t('detail.yourAddress'))}</span>` : ''}
                ${trustBadge(listing, { label: true })}
                ${promoFor(listing.id) ? `<span class="promo-badge">${ICONS.tag}${escapeHtml(t('detail.promo.title'))}</span>` : ''}
              </div>
              <h1 class="detail-title">${escapeHtml(listing.name)}</h1>
              <div class="detail-rating">
                ${
                  rating.avg
                    ? `<span class="rating-pill">${ICONS.star} ${formatRating(rating.avg)}</span>
                       <span>${escapeHtml(t('detail.reviewsCount', { n: formatNumber(rating.count) }))}</span>
                       <span aria-hidden="true">·</span>
                       <span>${escapeHtml((listing.subcategories || []).join(' · '))}</span>`
                    : `<span class="pill pill-outline">${escapeHtml(t('detail.newAddress'))}</span>
                       <span>${escapeHtml(t('detail.noReviews'))}</span>`
                }
              </div>
              ${status.status !== 'unknown' ? `<div class="detail-status-row">${openBadge(listing, { withDetail: true })}</div>` : ''}
              <p class="detail-loc">${ICONS.mapPin}
                <span>${escapeHtml(listing.address)}${listing.neighborhood ? ` · ${escapeHtml(listing.neighborhood)}` : ''}</span>
              </p>
              ${
                listing.landmark
                  ? `<p class="detail-landmark">${ICONS.crosshair}<span><strong>${escapeHtml(t('detail.landmark'))} :</strong> ${escapeHtml(listing.landmark)}</span></p>`
                  : ''
              }
              ${distanceLabel(listing) ? `<p class="detail-distance">${ICONS.target} ${escapeHtml(t('detail.distanceYou', { distance: distanceLabel(listing) }))}</p>` : ''}
            </div>
          </div>

          <div class="detail-actions">
            <button type="button" class="btn ${isFavorite ? 'btn-soft' : 'btn-ghost'}" data-favorite="${escapeHtml(listing.id)}" aria-pressed="${isFavorite}" aria-label="${isFavorite ? escapeHtml(t('detail.unfavorite')) : escapeHtml(t('detail.favorite'))} — ${escapeHtml(listing.name)}">
              ${ICONS.heart}<span data-fav-label>${isFavorite ? escapeHtml(t('detail.saved')) : escapeHtml(t('detail.favorite'))}</span>
            </button>
            <button type="button" class="btn btn-ghost" data-share="${escapeHtml(listing.id)}">
              ${ICONS.share}<span>${escapeHtml(t('detail.share'))}</span>
            </button>
            <a class="btn btn-ghost" href="${googleMapsUrl(listing)}" target="_blank" rel="noopener">
              ${ICONS.route}<span>${escapeHtml(t('detail.google'))}</span>
            </a>
            <a class="btn btn-ghost" href="${wazeUrl(listing)}" target="_blank" rel="noopener">
              ${ICONS.navigation}<span>Waze</span>
            </a>
            <button type="button" class="btn btn-ghost compare-btn-hero${compareActive ? ' is-active' : ''}" data-compare="${escapeHtml(listing.id)}" aria-pressed="${compareActive}">
              ${compareActive ? ICONS.check : ICONS.compare}<span>${escapeHtml(t('detail.compare'))}</span>
            </button>
          </div>

          ${
            waContact
              ? `<a class="detail-wa-cta" href="${escapeHtml(waContact)}" target="_blank" rel="noopener">
                  <span class="wa-icon">${ICONS.whatsapp}</span>
                  <span>
                    <strong>${escapeHtml(
                      listing.category === 'restaurants'
                        ? t('detail.whatsappOrder')
                        : listing.category === 'hotels'
                          ? t('detail.whatsappBook')
                          : t('detail.whatsapp')
                    )}</strong>
                    <small>${escapeHtml(whatsappMessage(listing))}</small>
                  </span>
                  ${ICONS.arrowRight}
                </a>`
              : ''
          }
        </header>

        <div class="detail-layout">
          <div class="detail-main">
            <section class="panel">
              <h2 class="panel-title">${ICONS.info} ${escapeHtml(t('detail.about'))}</h2>
              <div class="prose">
                ${String(listing.description || '')
                  .split('\n')
                  .filter(Boolean)
                  .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
                  .join('') || `<p>${escapeHtml(t('card.noDescription'))}</p>`}
              </div>
              ${
                listing.subcategories?.length
                  ? `<div class="detail-tags" style="margin-top:0.9rem">${listing.subcategories
                      .map((sub) => `<span class="detail-tag">${escapeHtml(sub)}</span>`)
                      .join('')}</div>`
                  : ''
              }
            </section>

            ${contentPanels}
            ${infoPanel}
            ${trustPanelMarkup(listing)}
            ${promoPanelMarkup(listing)}
            ${dailyOfferPanelMarkup(listing)}

            <section class="panel">
              <h2 class="panel-title">${ICONS.mapPin} ${escapeHtml(t('detail.location'))}</h2>
              <div class="fact-list">
                <div class="fact"><span class="fact-label">${escapeHtml(t('detail.hood'))}</span><span class="fact-value">${escapeHtml(listing.neighborhood || 'Bamako')}</span></div>
                <div class="fact"><span class="fact-label">${escapeHtml(t('detail.address'))}</span><span class="fact-value">${escapeHtml(listing.address)}</span></div>
                ${
                  listing.landmark
                    ? `<div class="fact"><span class="fact-label">${escapeHtml(t('detail.landmark'))}</span><span class="fact-value">${escapeHtml(listing.landmark)}</span></div>`
                    : ''
                }
              </div>
              <div id="detail-map" class="detail-map" role="application" aria-label="${escapeHtml(t('detail.location'))} — ${escapeHtml(listing.name)}"></div>
              <div class="location-actions">
                <a class="btn btn-soft" href="${googlePlaceUrl(listing)}" target="_blank" rel="noopener">${ICONS.mapPin} Google Maps</a>
                <a class="btn btn-soft" href="${googleMapsUrl(listing)}" target="_blank" rel="noopener">${ICONS.route} ${escapeHtml(t('detail.itinerary'))}</a>
                <a class="btn btn-soft" href="${wazeUrl(listing)}" target="_blank" rel="noopener">${ICONS.navigation} Waze</a>
                <a class="btn btn-soft is-whatsapp" href="${whatsappShareUrl(listing)}" target="_blank" rel="noopener">${ICONS.whatsapp} ${escapeHtml(t('detail.sharePosition'))}</a>
              </div>
            </section>
          </div>

          <aside class="detail-aside">
            <div class="panel contact-panel" style="--cat:${escapeHtml(cat.color)}">
              ${
                priceInfo
                  ? `<div class="price-block">
                      <span class="price-caption">${escapeHtml(fieldLabel(priceInfo.field))}</span>
                      <div class="price-main">${priceMarkup(listing, { detailed: true })}</div>
                      <p class="price-hint">${escapeHtml(t('detail.priceHint'))}</p>
                    </div>`
                  : ''
              }

              <div class="contact-list">
                ${listing.phone ? `<div class="contact-row">${ICONS.phone}<div><span class="contact-label">${escapeHtml(t('detail.phone'))}</span><a class="contact-value" href="tel:${escapeHtml(rawPhone)}">${escapeHtml(listing.phone)}</a></div></div>` : ''}
                ${waNumber ? `<div class="contact-row">${ICONS.whatsapp}<div><span class="contact-label">WhatsApp</span><a class="contact-value" href="https://wa.me/${escapeHtml(waNumber)}" target="_blank" rel="noopener">${escapeHtml(listing.phone || `+${waNumber}`)}</a></div></div>` : ''}
                <div class="contact-row">${ICONS.clock}<div><span class="contact-label">${escapeHtml(t('detail.hours'))}</span><span class="contact-value">${escapeHtml(listing.hours || t('detail.hoursUnknown'))}</span></div></div>
                <div class="contact-row">${ICONS.mapPin}<div><span class="contact-label">${escapeHtml(t('detail.address'))}</span><span class="contact-value">${escapeHtml(listing.address)}</span></div></div>
              </div>

              <div class="contact-actions">
                ${listing.phone ? `<a class="btn btn-primary btn-block" href="tel:${escapeHtml(rawPhone)}">${ICONS.phone} ${escapeHtml(t('detail.call'))}</a>` : ''}
                ${waContact ? `<a class="btn btn-ghost btn-block" href="${escapeHtml(waContact)}" target="_blank" rel="noopener">${ICONS.whatsapp} ${escapeHtml(t('detail.whatsapp'))}</a>` : ''}
                <a class="btn btn-ghost btn-block" href="${googleMapsUrl(listing)}" target="_blank" rel="noopener">${ICONS.route} ${escapeHtml(t('detail.google'))}</a>
                <a class="btn btn-ghost btn-block" href="${wazeUrl(listing)}" target="_blank" rel="noopener">${ICONS.navigation} ${escapeHtml(t('detail.waze'))}</a>
              </div>

              ${
                listing.isCustom
                  ? `<button type="button" class="btn btn-danger-soft btn-block" style="margin-top:0.7rem" data-delete-listing="${escapeHtml(listing.id)}" data-name="${escapeHtml(listing.name)}">${ICONS.trash} ${escapeHtml(t('detail.delete'))}</button>`
                  : ''
              }
            </div>

            <div class="listing-count-note">
              <span>${escapeHtml(listing.isCustom ? t('detail.addedByYou') : t('detail.community'))}</span>
              <strong>${escapeHtml(t('detail.reviewsCount', { n: formatNumber(rating.count) }))}</strong>
            </div>
          </aside>
        </div>

        ${reviewsPanelMarkup(listing)}
        ${qrPanelMarkup(listing)}

        ${
          similar.length
            ? `<section class="section" aria-labelledby="similar-title">
                <div class="section-head">
                  <div>
                    <span class="eyebrow">${escapeHtml(t('detail.sameCategory'))}</span>
                    <h2 id="similar-title">${escapeHtml(t('detail.similar'))}</h2>
                  </div>
                  <a class="section-link" href="${explorerHash({ ...defaultFilters(), cat: cat.id })}">${escapeHtml(t('home.all'))} ${ICONS.arrowRight}</a>
                </div>
                ${listingGrid(similar)}
              </section>`
            : ''
        }
      </div>`;

    initDetailMap(listing);
  }

  /* ------------------------- Formulaire d'ajout --------------------------- */
  function createDraft(categoryId = 'restaurants') {
    const category = getCategory(categoryId);
    const fields = {};
    category.fields.forEach((field) => {
      fields[field.key] = field.type === 'boolean' ? false : '';
    });
    return {
      category: category.id,
      name: '',
      subcategories: [],
      neighborhood: '',
      address: '',
      landmark: '',
      coords: null,
      phone: '',
      whatsapp: '',
      hours: '',
      description: '',
      fields,
    };
  }

  function collectDraft() {
    const form = $('#add-form');
    if (!form) return;
    const draft = state.addDraft;
    if (!draft) return;

    const data = new FormData(form);
    const get = (name) => (data.get(name) ?? '').toString().trim();

    draft.category = get('category') || draft.category;
    draft.name = get('name');
    draft.neighborhood = get('neighborhood');
    draft.address = get('address');
    draft.landmark = get('landmark');
    draft.phone = get('phone');
    draft.whatsapp = get('whatsapp');
    draft.hours = get('hours');
    draft.description = get('description');
    draft.subcategories = data.getAll('subcategories').map(String);

    const cat = getCategory(draft.category);
    const fields = {};
    cat.fields.forEach((field) => {
      if (field.type === 'boolean') {
        fields[field.key] = Boolean(form.elements[field.key]?.checked);
      } else {
        fields[field.key] = (data.get(field.key) ?? '').toString().trim();
      }
    });
    draft.fields = fields;
  }

  function fieldInputHtml(field, value) {
    const id = `field-${field.key}`;
    const required = field.required ? ' required' : '';
    const requiredMark = field.required ? '<span class="req" aria-hidden="true">*</span>' : '';
    const hintParts = [];
    if (field.hint) hintParts.push(field.hint);
    if (field.money) hintParts.push('Montant en FCFA');
    if (field.suffix) hintParts.push(`Unité : ${field.suffix.replace('/', '')}`);
    const hint = hintParts.length ? `<span class="hint">${escapeHtml(hintParts.join(' · '))}</span>` : '';

    if (field.type === 'textarea') {
      return `<div class="field span-2">
        <label for="${id}">${escapeHtml(fieldLabel(field))}${requiredMark}</label>
        <textarea class="textarea" id="${id}" name="${escapeHtml(field.key)}" rows="4" placeholder="${escapeHtml(field.placeholder || '')}"${required}>${escapeHtml(value || '')}</textarea>
        ${hint}
      </div>`;
    }

    if (field.type === 'boolean') {
      return `<label class="checkbox-row" for="${id}">
        <input type="checkbox" id="${id}" name="${escapeHtml(field.key)}"${value ? ' checked' : ''} />
        <span><strong>${escapeHtml(fieldLabel(field))}</strong>${field.valueLabels || field.valueLabelsBm ? `<br /><span class="hint">${escapeHtml(fieldValueLabels(field).true)} / ${escapeHtml(fieldValueLabels(field).false)}</span>` : ''}</span>
      </label>`;
    }

    if (field.type === 'select' && field.options) {
      return `<div class="field">
        <label for="${id}">${escapeHtml(fieldLabel(field))}${requiredMark}</label>
        <select class="select" id="${id}" name="${escapeHtml(field.key)}"${required}>
          <option value="">Choisir…</option>
          ${field.options
            .map(
              (option) =>
                `<option value="${escapeHtml(option)}"${String(value) === option ? ' selected' : ''}>${escapeHtml(option)}</option>`
            )
            .join('')}
        </select>
        ${hint}
      </div>`;
    }

    if (field.type === 'number') {
      return `<div class="field">
        <label for="${id}">${escapeHtml(fieldLabel(field))}${requiredMark}${field.money ? ' <span class="hint">(FCFA)</span>' : ''}</label>
        <input class="input" id="${id}" name="${escapeHtml(field.key)}" type="number" inputmode="numeric"
          value="${escapeHtml(value ?? '')}" placeholder="${escapeHtml(field.placeholder || '')}"
          ${field.min !== undefined ? `min="${field.min}"` : ''} ${field.step !== undefined ? `step="${field.step}"` : 'step="1"'}${required} />
        ${hint}
      </div>`;
    }

    return `<div class="field">
      <label for="${id}">${escapeHtml(fieldLabel(field))}${requiredMark}</label>
      <input class="input" id="${id}" name="${escapeHtml(field.key)}" type="text"
        value="${escapeHtml(value || '')}" placeholder="${escapeHtml(field.placeholder || '')}"${required} />
      ${hint}
    </div>`;
  }

  function previewListingFromDraft() {
    const draft = state.addDraft;
    const cat = getCategory(draft.category);
    const fields = { ...draft.fields };
    cat.fields.forEach((field) => {
      if (field.type === 'number' && fields[field.key] !== '') {
        fields[field.key] = Number(fields[field.key]);
      }
    });
    return {
      id: 'apercu',
      name: draft.name || 'Nom de votre adresse',
      category: draft.category,
      subcategories: draft.subcategories,
      neighborhood: draft.neighborhood || 'Quartier à préciser',
      address: draft.address || 'Adresse à préciser',
      landmark: draft.landmark,
      coords: draft.coords,
      phone: draft.phone,
      hours: draft.hours || 'Horaires à préciser',
      description: draft.description || 'Votre description apparaîtra ici. Présentez votre commerce en quelques mots.',
      rating: null,
      reviews: 0,
      createdAt: todayISO(),
      fields,
    };
  }

  function updatePreview() {
    const container = $('#form-preview-card');
    if (!container) return;
    container.innerHTML = listingCard(previewListingFromDraft(), 0, { preview: true });
  }

  function renderAddPage() {
    destroyMaps();
    const draft = state.addDraft;
    const cat = getCategory(draft.category);

    document.title = 'Ajouter une adresse — BamaHub';

    $('#main').innerHTML = `
      <div class="container form-page page">
        ${breadcrumbs([
          { label: t('nav.home'), href: '#/' },
          { label: t('add.title'), href: '#/ajouter' },
        ])}
        <div class="page-head" style="padding-top:0.4rem">
          <h1 class="page-title">${escapeHtml(t('add.title'))}</h1>
          <p class="page-sub">${escapeHtml(t('add.subtitle'))}</p>
        </div>

        <div class="form-layout">
          <form class="form-card" id="add-form" novalidate>
            <section class="form-section">
              <div class="form-section-head">
                <span class="form-step">1</span>
                <div>
                  <h2>${escapeHtml(t('add.identite'))}</h2>
                  <p>${escapeHtml(t('add.identiteHint'))}</p>
                </div>
              </div>

              <div class="form-grid">
                <div class="field span-2">
                  <label for="field-name">${escapeHtml(t('add.name'))} <span class="req" aria-hidden="true">*</span></label>
                  <input class="input" id="field-name" name="name" type="text" required maxlength="80" value="${escapeHtml(draft.name)}" placeholder="Ex. Le Baobab, Pharmacie du Carrefour…" />
                  <span class="hint">${escapeHtml(t('add.nameHint'))}</span>
                </div>

                <div class="field span-2">
                  <label for="field-category">${escapeHtml(t('add.categoryLabel'))} <span class="req" aria-hidden="true">*</span></label>
                  <select class="select" id="field-category" name="category" required>
                    ${CATEGORIES.map(
                      (category) =>
                        `<option value="${category.id}"${draft.category === category.id ? ' selected' : ''}>${escapeHtml(catLabel(category))}</option>`
                    ).join('')}
                  </select>
                </div>

                <div class="field span-2">
                  <span class="field-label">${escapeHtml(t('add.subcategories'))} <span class="hint">(${escapeHtml(t('add.optional'))}, ${escapeHtml(t('add.multiple'))})</span></span>
                  <div class="subcategory-options">
                    ${cat.subcategories
                      .map(
                        (sub) => `<label class="subcat-option">
                          <input type="checkbox" name="subcategories" value="${escapeHtml(sub)}"${draft.subcategories.includes(sub) ? ' checked' : ''} />
                          <span>${escapeHtml(sub)}</span>
                        </label>`
                      )
                      .join('') || `<span class="hint">${escapeHtml(t('add.noSubcategories'))}</span>`}
                  </div>
                </div>
              </div>
            </section>

            <section class="form-section">
              <div class="form-section-head">
                <span class="form-step">2</span>
                <div>
                  <h2>${escapeHtml(t('add.localisation'))}</h2>
                  <p>${escapeHtml(t('add.localisationHint'))}</p>
                </div>
              </div>

              <div class="form-grid">
                <div class="field">
                  <label for="field-neighborhood">${escapeHtml(t('add.hood'))} <span class="req" aria-hidden="true">*</span></label>
                  <select class="select" id="field-neighborhood" name="neighborhood" required>
                    <option value="">${escapeHtml(t('add.chooseHood'))}</option>
                    ${NEIGHBORHOODS.map(
                      (hood) =>
                        `<option value="${escapeHtml(hood)}"${draft.neighborhood === hood ? ' selected' : ''}>${escapeHtml(hood)}</option>`
                    ).join('')}
                  </select>
                </div>

                <div class="field">
                  <label for="field-phone">${escapeHtml(t('add.phone'))} <span class="req" aria-hidden="true">*</span></label>
                  <input class="input" id="field-phone" name="phone" type="tel" required pattern="[0-9+\-. ]{8,24}" title="${escapeHtml(t('add.phoneTitle'))}" value="${escapeHtml(draft.phone)}" placeholder="+223 66 12 34 56" />
                </div>

                <div class="field span-2">
                  <label for="field-address">${escapeHtml(t('add.addressLabel'))} <span class="req" aria-hidden="true">*</span></label>
                  <input class="input" id="field-address" name="address" type="text" required maxlength="140" value="${escapeHtml(draft.address)}" placeholder="Rue, repère, immeuble…" />
                  <span class="hint">Rue, numéro de porte, immeuble ou indication utile.</span>
                </div>

                <div class="field span-2">
                  <label for="field-landmark">${escapeHtml(t('add.landmark'))} <span class="hint">(${escapeHtml(t('add.optional'))})</span></label>
                  <input class="input" id="field-landmark" name="landmark" type="text" maxlength="120" value="${escapeHtml(draft.landmark || '')}" placeholder="Ex. en face de la Pharmacie du Carrefour, à côté de la mosquée…" />
                  <span class="hint">Beaucoup de rues de Bamako ne portent pas de nom : un repère connu est souvent plus utile que l’adresse.</span>
                </div>

                <div class="field span-2">
                  <div class="map-field-head">
                    <span class="field-label">${escapeHtml(t('add.position'))} <span class="hint">(${escapeHtml(t('add.optional'))})</span></span>
                    <button type="button" class="btn btn-soft btn-sm" data-form-geolocate>
                      ${ICONS.crosshair} Ma position
                    </button>
                  </div>
                  <div id="add-map" class="form-map" role="application" aria-label="Carte : cliquez pour placer votre adresse"></div>
                  <p class="form-coords-hint" data-form-coords>Cliquez sur la carte (ou utilisez « Ma position ») pour placer le pin.</p>
                </div>

                <div class="field">
                  <label for="field-whatsapp">WhatsApp <span class="hint">(${escapeHtml(t('add.optional'))})</span></label>
                  <input class="input" id="field-whatsapp" name="whatsapp" type="tel" pattern="[0-9+\-. ]{8,24}" title="${escapeHtml(t('add.whatsappTitle'))}" value="${escapeHtml(draft.whatsapp)}" placeholder="+223 66 12 34 56" />
                </div>

                <div class="field">
                  <label for="field-hours">${escapeHtml(t('add.hours'))} <span class="hint">(${escapeHtml(t('add.optional'))})</span></label>
                  <input class="input" id="field-hours" name="hours" type="text" maxlength="80" value="${escapeHtml(draft.hours)}" placeholder="Ex. Lun – Sam · 8h – 19h" />
                </div>

                <div class="field span-2">
                  <label for="field-description">${escapeHtml(t('add.description'))} <span class="hint">(${escapeHtml(t('add.optional'))})</span></label>
                  <textarea class="textarea" id="field-description" name="description" rows="4" maxlength="600" placeholder="Présentez votre commerce, vos spécialités, ce qui vous distingue…">${escapeHtml(draft.description)}</textarea>
                </div>
              </div>
            </section>

            <section class="form-section">
              <div class="form-section-head">
                <span class="form-step">3</span>
                <div>
                  <h2>${escapeHtml(t('add.details', { cat: catLabel(cat) }))}</h2>
                  <p>${escapeHtml(t('add.detailsHint'))}</p>
                </div>
              </div>

              <div class="form-grid" id="dynamic-fields">
                ${cat.fields.map((field) => fieldInputHtml(field, draft.fields[field.key])).join('')}
              </div>
            </section>

            <div class="form-actions">
              <a class="btn btn-ghost" href="#/explorer">${escapeHtml(t('common.cancel'))}</a>
              <button class="btn btn-primary" type="submit">${ICONS.plus} ${escapeHtml(t('add.publish'))}</button>
            </div>
            <p class="form-note">En publiant, vous confirmez que les informations sont exactes. Cet annuaire est une démonstration : les données restent dans votre navigateur.</p>
          </form>

          <aside class="form-preview">
            <div class="preview-wrap">
              <div class="preview-head">
                <h2>${ICONS.sparkles} ${escapeHtml(t('add.previewTitle'))}</h2>
                <span class="pill pill-brand">Nouveau</span>
              </div>
              <div id="form-preview-card"></div>
              <p class="preview-hint">Voici comment votre adresse apparaîtra dans l’annuaire. L’aperçu se met à jour au fil de la saisie.</p>
            </div>
          </aside>
        </div>
      </div>`;

    updatePreview();
    initFormMap();

    // « Ma position » : centre la carte sur l'utilisateur et y place le pin.
    $('[data-form-geolocate]')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      button.classList.add('is-loading');
      button.setAttribute('aria-busy', 'true');
      try {
        const location = await getCurrentPosition();
        placeFormPin([location.lat, location.lng]);
        showToast(
          `Position placée (précision ${formatDistance(location.accuracy)}). Ajustez le pin en le faisant glisser si besoin.`,
          { duration: 4200 }
        );
      } catch (error) {
        showToast(
          error?.code === 'unsupported'
            ? 'La géolocalisation n’est pas disponible sur cet appareil.'
            : geolocationErrorMessage(error),
          { duration: 6000 }
        );
      } finally {
        button.classList.remove('is-loading');
        button.removeAttribute('aria-busy');
      }
    });

    // Changement de catégorie : on conserve la saisie, on recharge les champs.
    $('#field-category')?.addEventListener('change', (event) => {
      collectDraft();
      const nextCategory = event.target.value;
      state.addDraft.category = nextCategory;
      state.addDraft.subcategories = [];
      state.addDraft.fields = createDraft(nextCategory).fields;
      renderAddPage();
    });

    // Aperçu en direct.
    $('#add-form')?.addEventListener('input', () => {
      collectDraft();
      updatePreview();
    });
    $('#add-form')?.addEventListener('change', () => {
      collectDraft();
      updatePreview();
    });
  }

  function handleAddSubmit(event) {
    const form = event.target;
    event.preventDefault();
    collectDraft();

    if (!form.reportValidity()) return;
    const draft = state.addDraft;
    const cat = getCategory(draft.category);

    if (!draft.name || !draft.category || !draft.neighborhood || !draft.address || !draft.phone) {
      showToast('Merci de renseigner les champs obligatoires.');
      return;
    }

    const phoneDigits = draft.phone.replace(/\D/g, '');
    if (phoneDigits.length < 8) {
      showToast('Le numéro de téléphone semble incomplet.');
      return;
    }

    // Conversion des champs selon leur type déclaré dans la config.
    const fields = {};
    cat.fields.forEach((field) => {
      const raw = draft.fields[field.key];
      if (field.type === 'boolean') {
        fields[field.key] = Boolean(raw);
      } else if (field.type === 'number') {
        fields[field.key] = raw === '' || raw === null ? '' : Number(raw);
      } else {
        fields[field.key] = raw;
      }
    });

    let id = `${slugify(draft.name)}-${Date.now().toString(36)}`;
    while (getListing(id)) id += '-2';

    const listing = {
      id,
      name: draft.name,
      category: draft.category,
      subcategories: draft.subcategories,
      neighborhood: draft.neighborhood,
      address: draft.address,
      landmark: draft.landmark || '',
      coords: Array.isArray(draft.coords) && draft.coords.length === 2 ? draft.coords : null,
      phone: draft.phone,
      whatsapp: draft.whatsapp.replace(/[^\d]/g, ''),
      hours: draft.hours || 'Horaires non communiqués',
      description:
        draft.description ||
        `Adresse ajoutée par un habitant de Bamako dans la catégorie ${cat.label.toLowerCase()}.`,
      rating: null,
      reviews: 0,
      createdAt: todayISO(),
      fields,
      isCustom: true,
    };

    state.listings.unshift(listing);
    persistCustomListings();

    state.addDraft = null;
    showToast(`« ${listing.name} » a été ajoutée à BamaHub.`, { duration: 4500 });
    location.hash = `#/adresse/${listing.id}`;
  }

  /* ------------------------------ Favoris --------------------------------- */
  function renderFavorites() {
    const favorites = [...state.favorites]
      .map((id) => getListing(id))
      .filter(Boolean);

    document.title = `${t('fav.title')} — BamaHub`;

    $('#main').innerHTML = `
      <div class="container page" style="padding-top:1.6rem;padding-bottom:2rem">
        ${breadcrumbs([
          { label: t('nav.home'), href: '#/' },
          { label: t('nav.favorites'), href: '#/favoris' },
        ])}
        <div class="favorites-head">
          <div>
            <h1 class="page-title">${escapeHtml(t('fav.title'))}</h1>
            <p class="page-sub">${escapeHtml(favorites.length ? t('fav.count', { n: favorites.length }) : t('fav.sub'))}</p>
          </div>
          ${favorites.length ? `<button type="button" class="btn btn-danger-soft btn-sm" data-clear-favorites>${ICONS.trash} ${escapeHtml(t('fav.clear'))}</button>` : ''}
        </div>

        ${
          favorites.length
            ? listingGrid(favorites)
            : emptyState({
                title: t('fav.empty.title'),
                text: t('fav.empty.text'),
                iconMarkup: ICONS.heart,
                action: `<a class="btn btn-primary" href="#/explorer">${ICONS.search} ${escapeHtml(t('nav.explore'))}</a>`,
              })
        }
      </div>`;
  }

  function renderNotFound(message, title = 'Page introuvable') {
    document.title = 'Page introuvable — BamaHub';
    $('#main').innerHTML = `
      <div class="container page" style="padding:3rem 1.15rem">
        <h1 class="sr-only">${escapeHtml(title)}</h1>
        ${emptyState({
          title,
          text: message,
          iconMarkup: ICONS.marker,
          action: `<a class="btn btn-primary" href="#/">${ICONS.arrowLeft} Retour à l’accueil</a>`,
        })}
      </div>`;
  }

  /* ==========================================================================
     5. Routage, thème et événements globaux
     ========================================================================== */

  function parseRoute() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [pathPart, query = ''] = raw.split('?');
    let path = pathPart || '/';
    if (path.length > 1) path = path.replace(/\/+$/, '');
    const segments = path.split('/').filter(Boolean);
    return { path, segments, params: new URLSearchParams(query) };
  }

  function setActiveNav(page) {
    $$('[data-nav]').forEach((link) => {
      if (link.dataset.nav === page) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function updateFavoritesCount() {
    const count = state.favorites.size;
    const badge = $('#nav-fav-count');
    if (badge) {
      badge.textContent = count;
      badge.hidden = count === 0;
    }
  }

  function renderRoute({ initial = false } = {}) {
    const route = parseRoute();
    state.route = route;

    // Toute navigation hors des routes d'authentification referme la fenêtre.
    const authModal = $('#auth-modal');
    const isAuthRoute = route.path === '/connexion' || route.path === '/inscription';
    if (authModal && !authModal.hidden && !isAuthRoute) closeAuthModal({ syncRoute: false });

    // Les cartes Leaflet sont liées au DOM : on les détruit avant de remplacer
    // le contenu de #main (la fenêtre de connexion, elle, garde la page en place).
    if (!isAuthRoute) destroyMaps();

    // Réinitialise le brouillon du formulaire quand on arrive depuis une autre page.
    if (route.path === '/ajouter' && state.previousPath !== '/ajouter') {
      const categoryFromUrl = route.params.get('cat');
      state.addDraft = createDraft(categoryFromUrl && CATEGORIES.some((cat) => cat.id === categoryFromUrl) ? categoryFromUrl : 'restaurants');
    }

    switch (route.path) {
      case '/':
        setActiveNav('home');
        renderHome();
        break;
      case '/explorer':
        setActiveNav('explore');
        renderExplorer(route.params);
        break;
      case '/favoris':
        setActiveNav('favorites');
        renderFavorites();
        break;
      case '/comparer':
        setActiveNav('explore');
        renderCompare(route);
        break;
      case '/ajouter':
        setActiveNav('add');
        if (!state.addDraft) state.addDraft = createDraft('restaurants');
        renderAddPage();
        break;
      case '/connexion':
      case '/inscription':
        setActiveNav('');
        // La fenêtre s'ouvre par-dessus la page courante (ou l'accueil).
        if (!$('#main').children.length) renderHome();
        openAuthModal(route.path === '/inscription' ? 'register' : 'login');
        break;
      default:
        if (route.segments[0] === 'adresse' && route.segments[1]) {
          setActiveNav('explore');
          renderDetail(route);
        } else {
          setActiveNav('');
          renderNotFound('La page demandée n’existe pas. Revenez à l’accueil pour continuer votre recherche.');
        }
    }

    updateFavoritesCount();
    state.previousPath = route.path;

    if (!initial) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      const main = $('#main');
      main?.focus({ preventScroll: true });
    }
  }

  /* ------------------------------- Thème ---------------------------------- */
  function applyTheme(theme, persist = true) {
    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute('content', nextTheme === 'dark' ? '#070d18' : '#2563eb');

    const button = $('#theme-toggle');
    if (button) {
      const label = nextTheme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre';
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
    }
    if (persist) writeStorage(STORAGE.theme, nextTheme);
  }

  function initTheme() {
    const saved = readStorage(STORAGE.theme, null);
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    applyTheme(saved === 'dark' || saved === 'light' ? saved : prefersDark ? 'dark' : 'light', false);

    $('#theme-toggle')?.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  /* ------------------------------ Toasts ---------------------------------- */
  function showToast(message, { actionLabel = '', onAction = null, duration = 3800 } = {}) {
    const region = $('#toast-region');
    if (!region) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span class="toast-icon">${ICONS.checkCircle}</span>
      <span class="toast-message">${escapeHtml(message)}</span>
      ${actionLabel ? `<button type="button" class="toast-action">${escapeHtml(actionLabel)}</button>` : ''}
      <button type="button" class="toast-close" aria-label="Fermer la notification">${ICONS.x}</button>`;

    let timer;
    const remove = () => {
      clearTimeout(timer);
      toast.classList.add('is-leaving');
      setTimeout(() => toast.remove(), 200);
    };

    toast.querySelector('.toast-close')?.addEventListener('click', remove);
    toast.querySelector('.toast-action')?.addEventListener('click', () => {
      if (typeof onAction === 'function') onAction();
      remove();
    });

    region.appendChild(toast);
    timer = setTimeout(remove, duration);
  }


  /* ==========================================================================
     Cartes, distances et géolocalisation
     --------------------------------------------------------------------------
     Leaflet + OpenStreetMap sont auto-hébergés (assets/vendor/leaflet), sans
     clé API. Les distances sont calculées avec la formule de Haversine.
     ========================================================================== */

  const EARTH_RADIUS = 6371000; // mètres

  /** Distance orthodromique entre deux points (formule de Haversine), en mètres. */
  function haversine(lat1, lng1, lat2, lng2) {
    const toRad = (degrees) => (degrees * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  const hasCoords = (listing) =>
    Array.isArray(listing?.coords) &&
    listing.coords.length === 2 &&
    Number.isFinite(Number(listing.coords[0])) &&
    Number.isFinite(Number(listing.coords[1]));

  /** Distance (m) entre la position de l'utilisateur et une adresse, ou null. */
  function distanceToListing(listing) {
    if (!state.userLocation || !hasCoords(listing)) return null;
    const [lat, lng] = listing.coords;
    return haversine(state.userLocation.lat, state.userLocation.lng, Number(lat), Number(lng));
  }

  /** « 850 m », « 1,2 km » — arrondi lisible pour l'interface. */
  function formatDistance(meters) {
    if (meters === null || meters === undefined || Number.isNaN(meters)) return '';
    if (meters < 950) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
    const km = meters / 1000;
    const rounded = km < 9.95 ? Math.round(km * 10) / 10 : Math.round(km);
    return `${String(rounded).replace('.', ',')} km`;
  }

  const radiusLabel = (meters) =>
    (RADIUS_OPTIONS.find((option) => option.value === meters)?.label || formatDistance(meters));

  /** Texte « à 850 m » utilisé sur les cartes et les fiches. */
  function distanceLabel(listing, { prefix = 'à' } = {}) {
    if (!state.nearMe) return '';
    const distance = distanceToListing(listing);
    if (distance === null) return '';
    return `${prefix} ${formatDistance(distance)}`;
  }

  /* --------------------------- Liens externes ----------------------------- */
  const googleMapsUrl = (listing) => {
    if (hasCoords(listing)) {
      const [lat, lng] = listing.coords;
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${listing.name}, ${listing.address || ''}, Bamako, Mali`
    )}`;
  };

  const googlePlaceUrl = (listing) => {
    if (hasCoords(listing)) {
      const [lat, lng] = listing.coords;
      return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${listing.name}, ${listing.address || ''}, Bamako, Mali`
    )}`;
  };

  /** Waze : lance la navigation vers un point (ll = latitude, longitude). */
  const wazeUrl = (listing) => {
    if (hasCoords(listing)) {
      const [lat, lng] = listing.coords;
      return `https://www.waze.com/ul?ll=${lat}%2C${lng}&navigate=yes&zoom=17`;
    }
    return `https://www.waze.com/ul?q=${encodeURIComponent(`${listing.name}, Bamako, Mali`)}&navigate=yes`;
  };

  /** Message WhatsApp partageant la position complète (adresse + repère + lien). */
  function whatsappShareUrl(listing) {
    const lines = [
      `📍 ${listing.name}`,
      [listing.address, listing.neighborhood].filter(Boolean).join(' · '),
    ];
    if (listing.landmark) lines.push(`Repère : ${listing.landmark}`);
    if (hasCoords(listing)) lines.push(googlePlaceUrl(listing));
    lines.push('Partagé via BamaHub');
    return `https://wa.me/?text=${encodeURIComponent(lines.filter(Boolean).join('\n'))}`;
  }

  /* ------------------------------ Géolocalisation ------------------------- */
  function geolocationErrorMessage(error) {
    switch (error?.code) {
      case 1:
        return 'Localisation refusée. Autorisez l’accès dans votre navigateur pour voir les adresses autour de vous.';
      case 2:
        return 'Position indisponible. Vérifiez votre connexion ou réessayez dans un instant.';
      case 3:
        return 'La localisation a pris trop de temps. Réessayez.';
      default:
        return 'Impossible d’obtenir votre position.';
    }
  }

  /**
   * Demande la position du navigateur.
   * @returns {Promise<{lat:number,lng:number,accuracy:number}>}
   */
  function getCurrentPosition({ highAccuracy = true } = {}) {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        const error = new Error('unsupported');
        error.code = 'unsupported';
        reject(error);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy || 0,
          };
          state.userLocation = location;
          state.geoStatus = 'ready';
          resolve(location);
        },
        (error) => {
          state.geoStatus = error.code === 1 ? 'denied' : 'unavailable';
          reject(error);
        },
        { enableHighAccuracy: highAccuracy, timeout: 12000, maximumAge: 60000 }
      );
    });
  }

  /** Active le mode « Autour de moi » : position + tri par distance. */
  async function activateNearMe() {
    const button = $('[data-near-me]');
    button?.classList.add('is-loading');
    button?.setAttribute('aria-busy', 'true');
    state.geoStatus = 'locating';
    updateNearMeUI();

    try {
      const location = await getCurrentPosition();
      state.nearMe = true;
      state.filters.sort = 'distance';
      refreshFilterControls();
      updateExplorerResults();
      const inside = getFilteredListings().length;
      showToast(
        `Position trouvée (précision ${formatDistance(location.accuracy)}) — ${inside} adresse${
          inside > 1 ? 's' : ''
        } dans un rayon de ${radiusLabel(state.radius)}.`,
        { duration: 4600 }
      );
    } catch (error) {
      showToast(
        error?.code === 'unsupported'
          ? 'La géolocalisation n’est pas disponible sur cet appareil.'
          : geolocationErrorMessage(error),
        { duration: 6000 }
      );
      state.geoStatus = 'denied';
    } finally {
      button?.classList.remove('is-loading');
      button?.removeAttribute('aria-busy');
      updateNearMeUI();
    }
  }

  function deactivateNearMe() {
    state.nearMe = false;
    if (state.filters.sort === 'distance') state.filters.sort = 'pertinence';
    refreshFilterControls();
    updateExplorerResults();
  }

  async function toggleNearMe() {
    if (state.nearMe) {
      deactivateNearMe();
      return;
    }
    if (state.userLocation) {
      // Position déjà connue : on réactive sans redemander l'autorisation.
      state.nearMe = true;
      state.filters.sort = 'distance';
      refreshFilterControls();
      updateExplorerResults();
      return;
    }
    await activateNearMe();
  }

  /** Met à jour les puces de rayon et l'état du bouton « Autour de moi ». */
  function updateNearMeUI(resultCount = null) {
    const button = $('[data-near-me]');
    if (button) {
      button.classList.toggle('is-active', state.nearMe);
      button.setAttribute('aria-pressed', String(state.nearMe));
      button.classList.toggle('is-locating', state.geoStatus === 'locating');
      const label = button.querySelector('[data-near-me-label]');
      if (label) label.textContent = state.nearMe ? t('explore.nearMeActive') : t('explore.nearMe');
    }

    const bar = $('[data-near-me-bar]');
    if (bar) bar.hidden = !state.nearMe;

    $$('[data-radius]').forEach((chip) => {
      const active = Number(chip.dataset.radius) === state.radius;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });

    const info = $('[data-near-me-info]');
    if (info) {
      if (!state.nearMe) {
        info.textContent = '';
      } else {
        const count = resultCount ?? getFilteredListings().length;
        const accuracy = state.userLocation?.accuracy
          ? ` · précision ${formatDistance(state.userLocation.accuracy)}`
          : '';
        info.textContent = `${count} adresse${count > 1 ? 's' : ''} dans un rayon de ${radiusLabel(
          state.radius
        )}${accuracy}`;
      }
    }
  }

  /* ------------------------------ Carte Leaflet --------------------------- */
  const leafletReady = () => Boolean(window.L && window.L.markerClusterGroup);

  /** Icône d'épingle colorée selon la catégorie (avec son pictogramme). */
  function categoryPinIcon(listing) {
    const cat = getCategory(listing.category);
    return L.divIcon({
      className: 'bh-pin-wrap',
      html: `<span class="bh-pin" style="--cat:${escapeHtml(cat.color)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${cat.icon}</svg>
      </span><span class="sr-only">${escapeHtml(listing.name)} — ${escapeHtml(cat.label)}</span>`,
      iconSize: [34, 34],
      iconAnchor: [17, 32],
      popupAnchor: [0, -30],
    });
  }

  const userIcon = () =>
    L.divIcon({
      className: 'bh-user-wrap',
      html: '<span class="bh-user"><span class="bh-user-pulse"></span></span>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

  const formPinIcon = () =>
    L.divIcon({
      className: 'bh-pin-wrap',
      html: '<span class="bh-pin bh-pin-form"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/></svg></span>',
      iconSize: [34, 34],
      iconAnchor: [17, 32],
    });

  /** Icône de regroupement (clusters) aux couleurs de la marque. */
  function clusterIcon(cluster) {
    const count = cluster.getChildCount();
    const size = count < 10 ? 38 : count < 100 ? 44 : 50;
    return L.divIcon({
      className: 'bh-cluster-wrap',
      html: `<span class="bh-cluster" style="width:${size}px;height:${size}px" role="img"
        aria-label="${count} adresse${count > 1 ? 's' : ''} à cet endroit">${count}</span>`,
      iconSize: [size, size],
    });
  }

  /** HTML du panneau qui s'ouvre au clic sur un marqueur. */
  function mapPopupHTML(listing) {
    const cat = getCategory(listing.category);
    const price = getPriceInfo(listing);
    const distance = state.nearMe ? distanceToListing(listing) : null;
    return `<article class="map-popup" style="--cat:${escapeHtml(cat.color)}">
      <span class="pill pill-cat">${escapeHtml(cat.label)}</span>
      <h3 class="map-popup-title">${escapeHtml(listing.name)}</h3>
      <p class="map-popup-meta">
        ${escapeHtml(listing.neighborhood || 'Bamako')}
        ${distance !== null ? `· <strong>${escapeHtml(formatDistance(distance))}</strong>` : ''}
        ${price ? `· ${escapeHtml(formatNumber(price.value))} FCFA` : ''}
      </p>
      <p class="map-popup-address">
        ${escapeHtml(listing.address || '')}
        ${listing.landmark ? `<br><span class="map-popup-landmark">${ICONS.mapPin} ${escapeHtml(listing.landmark)}</span>` : ''}
      </p>
      <div class="map-popup-actions">
        <a class="btn btn-primary btn-sm" href="#/adresse/${escapeHtml(listing.id)}">${ICONS.eye} Voir la fiche</a>
        <a class="map-link" href="${googleMapsUrl(listing)}" target="_blank" rel="noopener" aria-label="Itinéraire Google Maps vers ${escapeHtml(listing.name)}">
          ${ICONS.route} Google
        </a>
        <a class="map-link" href="${wazeUrl(listing)}" target="_blank" rel="noopener" aria-label="Itinéraire Waze vers ${escapeHtml(listing.name)}">
          ${ICONS.navigation} Waze
        </a>
        <a class="map-link is-whatsapp" href="${whatsappShareUrl(listing)}" target="_blank" rel="noopener" aria-label="Partager la position sur WhatsApp — ${escapeHtml(listing.name)}">
          ${ICONS.whatsapp} WhatsApp
        </a>
      </div>
    </article>`;
  }

  /** Contrôles de zoom avec libellés français (Leaflet est en anglais). */
  function addZoomControl(map) {
    L.control
      .zoom({ zoomInTitle: 'Zoom avant', zoomOutTitle: 'Zoom arrière', position: 'topleft' })
      .addTo(map);
  }

  function addOsmTiles(map) {
    const layer = L.tileLayer(OSM_URL, {
      maxZoom: 19,
      attribution: OSM_ATTRIBUTION,
    });

    // Ouverture hors connexion (ou aperçu sans réseau) : les tuiles manquent,
    // mais les épingles, distances et itinéraires restent utilisables.
    let tileErrors = 0;
    layer.on('tileerror', () => {
      tileErrors += 1;
      if (tileErrors === 8 && !state.mapOfflineNoticeShown) {
        state.mapOfflineNoticeShown = true;
        showToast(
          'Fond de carte indisponible hors connexion. Les épingles, distances et itinéraires restent utilisables.',
          { duration: 7000 }
        );
      }
    });

    layer.addTo(map);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
  }

  function showMapFallback(container, message) {
    if (!container) return;
    container.innerHTML = `<div class="map-fallback">
      ${ICONS.map}
      <p>${escapeHtml(message)}</p>
      <p class="hint">La vue Liste reste disponible avec toutes les adresses.</p>
    </div>`;
  }

  /** Crée (une seule fois) la carte de l'explorateur. */
  function ensureExplorerMap() {
    const container = $('#explorer-map');
    if (!container) return null;

    if (!leafletReady()) {
      showMapFallback(
        container,
        'La carte n’a pas pu être chargée. Vérifiez votre connexion puis rechargez la page.'
      );
      return null;
    }

    if (state.explorerMap) return state.explorerMap;

    const map = L.map(container, {
      center: BAMAKO_CENTER,
      zoom: MAP_DEFAULT_ZOOM,
      zoomControl: false,
      // La molette reste dédiée au défilement de la page ; le zoom se fait
      // avec les boutons + / −, le pincement ou le double-clic.
      scrollWheelZoom: false,
      worldCopyJump: false,
      minZoom: 4,
      maxZoom: 19,
    });

    addOsmTiles(map);
    addZoomControl(map);

    state.clusterLayer = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 17,
      maxClusterRadius: 52,
      iconCreateFunction: clusterIcon,
    });
    map.addLayer(state.clusterLayer);

    state.userLayer = L.layerGroup().addTo(map);
    state.explorerMap = map;
    state.mapSignature = '';

    return map;
  }

  /** Affiche les marqueurs correspondant aux résultats filtrés. */
  function renderMapMarkers(items) {
    const map = ensureExplorerMap();
    if (!map) return;

    const group = state.clusterLayer;
    const userLayer = state.userLayer;
    group.clearLayers();
    userLayer.clearLayers();

    const withCoords = items.filter(hasCoords);
    const bounds = L.latLngBounds([]);

    withCoords.forEach((listing) => {
      const marker = L.marker([Number(listing.coords[0]), Number(listing.coords[1])], {
        icon: categoryPinIcon(listing),
        title: listing.name,
        alt: `${listing.name} — ${getCategory(listing.category).label}`,
        keyboard: true,
      });
      marker.bindPopup(mapPopupHTML(listing), {
        maxWidth: 300,
        minWidth: 240,
        autoPanPadding: [26, 26],
      });
      group.addLayer(marker);
      bounds.extend(marker.getLatLng());
    });

    // Marqueur + cercle de rayon « Autour de moi ».
    if (state.nearMe && state.userLocation) {
      const userLatLng = [state.userLocation.lat, state.userLocation.lng];
      L.marker(userLatLng, { icon: userIcon(), zIndexOffset: 1200, keyboard: false })
        .addTo(userLayer)
        .bindPopup(
          `<div class="map-popup"><strong>Votre position</strong><br><span class="hint">Rayon de recherche : ${escapeHtml(
            radiusLabel(state.radius)
          )}</span></div>`
        );
      L.circle(userLatLng, {
        radius: state.radius,
        color: '#2563eb',
        weight: 1.5,
        fillColor: '#2563eb',
        fillOpacity: 0.07,
        dashArray: '5 7',
      }).addTo(userLayer);

      map.fitBounds(L.latLng(userLatLng).toBounds(state.radius * 2), {
        padding: [24, 24],
        maxZoom: 16,
        animate: true,
      });
      state.mapSignature = `near:${state.radius}:${withCoords.map((l) => l.id).join(',')}`;
    } else if (bounds.isValid()) {
      // On ne recadre que si la sélection a réellement changé (évite les sauts
      // pendant la frappe dans la recherche).
      const signature = withCoords.map((listing) => listing.id).join(',');
      if (signature !== state.mapSignature) {
        state.mapSignature = signature;
        clearTimeout(state.mapFitTimer);
        state.mapFitTimer = setTimeout(() => {
          if (state.filters.view === 'map') {
            map.fitBounds(bounds, { padding: [34, 34], maxZoom: 15, animate: true });
          }
        }, 180);
      }
    } else {
      map.setView(BAMAKO_CENTER, MAP_DEFAULT_ZOOM);
    }

    // Taille correcte après un changement de vue (conteneur masqué puis réaffiché).
    requestAnimationFrame(() => map.invalidateSize());

    const count = withCoords.length;
    const missing = items.length - count;
    const shell = $('[data-map-shell]');
    let note = shell?.querySelector('[data-map-note]');
    if (shell && !note) {
      note = document.createElement('p');
      note.className = 'map-note';
      note.dataset.mapNote = '';
      note.setAttribute('aria-live', 'polite');
      shell.appendChild(note);
    }
    if (note) {
      note.textContent =
        count === 0
          ? 'Aucune adresse géolocalisée ne correspond à ces filtres.'
          : `${count} adresse${count > 1 ? 's' : ''} sur la carte${
              missing > 0 ? ` · ${missing} sans position` : ''
            }`;
    }
  }

  /** Carte compacte de la fiche détail. */
  function initDetailMap(listing) {
    const container = $('#detail-map');
    if (!container) return;
    if (!leafletReady()) {
      showMapFallback(container, 'Carte indisponible hors connexion.');
      return;
    }
    if (!hasCoords(listing)) {
      showMapFallback(container, 'La position exacte de cette adresse n’a pas encore été renseignée.');
      return;
    }

    const [lat, lng] = [Number(listing.coords[0]), Number(listing.coords[1])];
    const map = L.map(container, {
      center: [lat, lng],
      zoom: 16,
      scrollWheelZoom: false,
      zoomControl: false,
    });
    addOsmTiles(map);
    addZoomControl(map);

    L.marker([lat, lng], { icon: categoryPinIcon(listing), title: listing.name })
      .addTo(map)
      .bindPopup(mapPopupHTML(listing));

    state.detailMap = map;
    requestAnimationFrame(() => map.invalidateSize());
  }

  /* --------------------------- Carte du formulaire ------------------------ */
  function updateFormCoordsHint() {
    const hint = $('[data-form-coords]');
    if (!hint) return;
    const coords = state.addDraft?.coords;
    hint.innerHTML = coords
      ? `${ICONS.checkCircle} Position enregistrée : <strong>${Number(coords[0]).toFixed(5)}, ${Number(
          coords[1]
        ).toFixed(5)}</strong>`
      : 'Cliquez sur la carte (ou utilisez « Ma position ») pour placer le pin.';
    hint.classList.toggle('is-set', Boolean(coords));
  }

  /** Place (ou déplace) le pin du formulaire. */
  function placeFormPin(coords, { recenter = true } = {}) {
    if (!state.formMap || !state.addDraft) return;
    const lat = Number(Number(coords[0]).toFixed(6));
    const lng = Number(Number(coords[1]).toFixed(6));
    state.addDraft.coords = [lat, lng];

    if (!state.formMarker) {
      state.formMarker = L.marker([lat, lng], {
        icon: formPinIcon(),
        draggable: true,
        keyboard: true,
        title: 'Position de l’adresse',
      }).addTo(state.formMap);
      state.formMarker.on('dragend', () => {
        const point = state.formMarker.getLatLng();
        placeFormPin([point.lat, point.lng], { recenter: false });
      });
    } else {
      state.formMarker.setLatLng([lat, lng]);
    }

    if (recenter) state.formMap.setView([lat, lng], Math.max(state.formMap.getZoom(), 15));
    updateFormCoordsHint();
  }

  function initFormMap() {
    const container = $('#add-map');
    if (!container || !state.addDraft) return;
    if (!leafletReady()) {
      showMapFallback(container, 'La carte n’a pas pu être chargée. Vous pouvez saisir l’adresse et le repère à la main.');
      return;
    }

    const draft = state.addDraft;
    const start = hasCoords(draft) ? [Number(draft.coords[0]), Number(draft.coords[1])] : BAMAKO_CENTER;

    const map = L.map(container, {
      center: start,
      zoom: hasCoords(draft) ? 16 : MAP_DEFAULT_ZOOM,
      scrollWheelZoom: false,
      zoomControl: false,
    });
    addOsmTiles(map);
    addZoomControl(map);
    state.formMap = map;

    map.on('click', (event) => placeFormPin([event.latlng.lat, event.latlng.lng], { recenter: false }));

    if (hasCoords(draft)) placeFormPin(draft.coords, { recenter: false });
    updateFormCoordsHint();

    requestAnimationFrame(() => map.invalidateSize());
  }

  /** Supprime toutes les instances Leaflet (changement de page). */
  function destroyMaps() {
    clearTimeout(state.mapFitTimer);
    state.mapFitTimer = null;
    if (state.explorerMap) {
      state.explorerMap.remove();
      state.explorerMap = null;
      state.clusterLayer = null;
      state.userLayer = null;
    }
    if (state.detailMap) {
      state.detailMap.remove();
      state.detailMap = null;
    }
    if (state.formMap) {
      state.formMap.remove();
      state.formMap = null;
      state.formMarker = null;
    }
    state.mapSignature = '';
  }

  /* ==========================================================================
     Écran de démarrage, connexion et compte local
     --------------------------------------------------------------------------
     Les comptes sont une démonstration : tout reste dans le navigateur
     (localStorage). Le mot de passe n'est jamais stocké en clair.
     ========================================================================== */

  /** Initiales affichées dans l'avatar (« Awa Traoré » → « AT »). */
  function initialsOf(name = '') {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  }

  /** Empreinte du mot de passe (SHA-256, ou repli si indisponible en file://). */
  async function hashPassword(password) {
    const data = new TextEncoder().encode(`bamahub:${password}`);
    if (window.crypto?.subtle) {
      try {
        const buffer = await window.crypto.subtle.digest('SHA-256', data);
        return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
      } catch (error) {
        // On bascule sur le repli ci-dessous.
      }
    }
    let hash = 2166136261;
    for (const byte of data) {
      hash ^= byte;
      hash = Math.imul(hash, 16777619);
    }
    return `fnv:${(hash >>> 0).toString(16)}`;
  }

  const isSignedIn = () => Boolean(state.session);

  /** Met à jour le bouton de compte (en-tête) et l'onglet mobile. */
  function updateAccountUI() {
    const signed = isSignedIn();
    const account = state.session;
    const label = signed ? account.name.split(' ')[0] : t('auth.loginAction');
    const initials = signed ? initialsOf(account.name) : '?';

    $$('[data-auth-label]').forEach((element) => {
      element.textContent = label;
    });
    $$('[data-auth-avatar]').forEach((element) => {
      element.textContent = initials;
    });
    $$('[data-auth-open]').forEach((element) => {
      element.classList.toggle('is-signed-in', signed);
      element.setAttribute(
        'aria-label',
        signed ? t('auth.accountAria', { name: account.name }) : t('auth.loginAria')
      );
      element.dataset.authOpen = signed ? 'account' : 'login';
    });
  }

  function persistAccounts() {
    writeStorage(STORAGE.accounts, state.accounts);
  }

  function persistSession() {
    if (state.session) {
      writeStorage(STORAGE.session, { email: state.session.email });
    } else {
      try {
        localStorage.removeItem(STORAGE.session);
      } catch (error) {
        // Stockage indisponible : la session reste simplement en mémoire.
      }
    }
  }

  /* ------------------------------- Splash --------------------------------- */
  function initSplash() {
    const splash = $('#splash');
    if (!splash) return;

    const startedAt = performance.now();
    document.body.classList.add('is-loading');
    let hidden = false;

    const hide = () => {
      if (hidden) return;
      hidden = true;
      splash.classList.add('is-hidden');
      document.body.classList.remove('is-loading');
      splash.addEventListener('transitionend', () => splash.remove(), { once: true });
      // Filet de sécurité (transition désactivée, onglet en arrière-plan…).
      setTimeout(() => splash.remove(), 1400);
    };

    // Durée d'affichage : assez pour apprécier l'animation, assez courte pour
    // ne pas retarder l'accès au contenu.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const minimumDelay = reduced ? 320 : 1500;

    const schedule = () => {
      const wait = Math.max(0, minimumDelay - (performance.now() - startedAt));
      setTimeout(hide, wait);
    };

    if (document.readyState === 'complete') {
      schedule();
    } else {
      window.addEventListener('load', schedule, { once: true });
    }

    // Le splash ne bloque jamais l'application plus de 2,6 s.
    setTimeout(hide, 2600);
  }

  /* --------------------------- Fenêtre de connexion ----------------------- */
  function authViewTemplate(mode) {
    if (mode === 'account' && isSignedIn()) {
      const account = state.session;
      return `
        <div class="auth-account">
          <span class="avatar">${escapeHtml(initialsOf(account.name))}</span>
          <div>
            <p class="auth-account-name">${escapeHtml(account.name)}</p>
            <p class="auth-account-mail">${escapeHtml(account.email)}</p>
          </div>
          <div class="auth-account-actions">
            <a class="btn btn-primary btn-block" href="#/favoris" data-auth-close>${ICONS.heart} ${escapeHtml(t('auth.favorites'))}</a>
            <a class="btn btn-ghost btn-block" href="#/ajouter" data-auth-close>${ICONS.plus} ${escapeHtml(t('auth.addAddress'))}</a>
            <button type="button" class="btn btn-danger-soft btn-block" data-auth-signout>${escapeHtml(t('auth.logout'))}</button>
          </div>
          <p class="auth-note">${ICONS.info} ${escapeHtml(t('auth.accountNote'))}</p>
        </div>`;
    }

    const register = mode === 'register';
    return `
      <div class="auth-form">
        <div>
          <h2 class="auth-title" id="auth-title">${escapeHtml(register ? t('auth.signup') : t('auth.loginTitle'))}</h2>
          <p class="auth-sub" id="auth-subtitle">
            ${escapeHtml(register ? t('auth.signupSub') : t('auth.loginSub'))}
          </p>
        </div>

        <form class="auth-form" data-auth-form="${register ? 'register' : 'login'}" novalidate>
          ${register
            ? `<div class="field">
                 <label for="auth-name">${escapeHtml(t('auth.name'))}</label>
                 <input class="input" id="auth-name" name="name" type="text" autocomplete="name" required maxlength="60" placeholder="Ex. Awa Traoré" />
               </div>`
            : ''}
          <div class="field">
            <label for="auth-email">${escapeHtml(t('auth.email'))}</label>
            <input class="input" id="auth-email" name="email" type="email" autocomplete="email" required placeholder="vous@exemple.ml" />
          </div>
          <div class="field">
            <label for="auth-password">${escapeHtml(t('auth.password'))}</label>
            <input class="input" id="auth-password" name="password" type="password"
              autocomplete="${register ? 'new-password' : 'current-password'}" required minlength="6"
              placeholder="${escapeHtml(t('auth.passwordHint'))}" />
          </div>
          <p class="auth-error" data-auth-error role="alert"></p>
          <button class="btn btn-primary btn-block" type="submit">
            ${escapeHtml(register ? t('auth.signupAction') : t('auth.loginAction'))}
          </button>
        </form>

        ${register
          ? ''
          : `<p class="auth-switch">${escapeHtml(t('auth.switchRegister'))}
               <button type="button" data-auth-tab="register">${escapeHtml(t('auth.signup'))}</button>
             </p>`}
        ${register
          ? `<p class="auth-switch">${escapeHtml(t('auth.switchLogin'))}
               <button type="button" data-auth-tab="login">${escapeHtml(t('auth.login'))}</button>
             </p>`
          : `<p class="auth-switch">Compte de démonstration :
               <button type="button" data-auth-demo>remplir automatiquement</button>
             </p>`}

        <p class="auth-note">${ICONS.info} ${escapeHtml(t('auth.note'))}</p>
      </div>`;
  }

  function renderAuthView(mode = state.authMode) {
    state.authMode = mode;
    const view = $('[data-auth-view]');
    if (!view) return;

    view.innerHTML = authViewTemplate(mode);

    // Onglets : l'état « Compte » garde les deux onglets désactivés.
    const isAccount = mode === 'account' && isSignedIn();
    $$('[data-auth-tab]').forEach((tab) => {
      const active = !isAccount && tab.dataset.authTab === mode;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    const tabs = $('.auth-tabs');
    if (tabs) tabs.hidden = isAccount;

    const viewPanel = $('[data-auth-view]');
    const labelledBy = isAccount ? 'auth-title' : mode === 'register' ? 'tab-register' : 'tab-login';
    viewPanel?.setAttribute('aria-labelledby', labelledBy);

    // Focus sur le premier champ utile.
    const focusTarget = view.querySelector('input') || view.querySelector('button, a');
    focusTarget?.focus({ preventScroll: true });
  }

  function openAuthModal(mode = 'login', { returnRoute = null } = {}) {
    const modal = $('#auth-modal');
    if (!modal) return;

    state.lastFocusedElement = document.activeElement;
    if (returnRoute) state.authReturnRoute = returnRoute;

    modal.hidden = false;
    state.authOpen = true;
    document.body.classList.add('auth-open');
    document.body.style.overflow = 'hidden';

    // Le contenu de la page derrière la fenêtre devient inerte.
    ['#main', '.site-header', '.site-footer', '.bottom-nav'].forEach((selector) => {
      const element = $(selector);
      if (element) element.setAttribute('inert', '');
    });

    // Le focus part directement sur le premier champ : on peut taper sans
    // chercher la souris (le bouton de fermeture reste atteignable au clavier).
    renderAuthView(mode === 'register' ? 'register' : mode === 'account' && isSignedIn() ? 'account' : 'login');
  }

  function closeAuthModal({ syncRoute = true } = {}) {
    const modal = $('#auth-modal');
    if (!modal || modal.hidden) return;

    modal.hidden = true;
    state.authOpen = false;
    document.body.classList.remove('auth-open');
    if (!state.settingsOpen) {
      document.body.style.overflow = '';
      setInertBackground(false);
    }

    const routeIsAuth = state.route?.path === '/connexion' || state.route?.path === '/inscription';
    if (syncRoute && routeIsAuth) {
      history.replaceState(null, '', state.authReturnRoute || '#/');
      state.route = parseRoute();
    }

    if (state.lastFocusedElement instanceof HTMLElement && document.contains(state.lastFocusedElement)) {
      state.lastFocusedElement.focus({ preventScroll: true });
    }
  }

  function setAuthError(message) {
    const error = $('[data-auth-error]');
    if (!error) return;
    error.textContent = message;
    error.classList.toggle('is-visible', Boolean(message));
  }

  /** Crée le compte de démonstration s'il n'existe pas, puis pré-remplit. */
  async function fillDemoAccount() {
    const email = $('#auth-email');
    const password = $('#auth-password');
    if (email) email.value = DEMO_ACCOUNT.email;
    if (password) password.value = DEMO_ACCOUNT.password;

    if (!state.accounts.some((account) => account.email === DEMO_ACCOUNT.email)) {
      state.accounts.push({
        name: DEMO_ACCOUNT.name,
        email: DEMO_ACCOUNT.email,
        password: await hashPassword(DEMO_ACCOUNT.password),
        createdAt: todayISO(),
        demo: true,
      });
      persistAccounts();
    }

    setAuthError('');
    showToast(`Compte de démonstration prêt : ${DEMO_ACCOUNT.email}`, { duration: 4200 });
  }

  async function handleAuthSubmit(form) {
    const mode = form.dataset.authForm;
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim().toLowerCase();
    const password = String(data.get('password') || '');
    const name = String(data.get('name') || '').trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setAuthError('Merci de saisir une adresse e-mail valide.');
      return;
    }
    if (password.length < 6) {
      setAuthError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (mode === 'register' && name.length < 2) {
      setAuthError('Merci d’indiquer votre nom.');
      return;
    }

    const hashed = await hashPassword(password);

    if (mode === 'register') {
      if (state.accounts.some((account) => account.email === email)) {
        setAuthError('Un compte existe déjà avec cette adresse. Essayez de vous connecter.');
        return;
      }
      const account = {
        name,
        email,
        password: hashed,
        createdAt: todayISO(),
      };
      state.accounts.push(account);
      persistAccounts();
      state.session = account;
      persistSession();
      updateAccountUI();
      renderAuthView('account');
      showToast(`Bienvenue sur BamaHub, ${name.split(' ')[0]} !`);
      return;
    }

    const account = state.accounts.find((item) => item.email === email);
    if (!account || account.password !== hashed) {
      setAuthError('E-mail ou mot de passe incorrect. Vérifiez votre saisie.');
      return;
    }

    state.session = account;
    persistSession();
    updateAccountUI();
    renderAuthView('account');
    showToast(`Ravi de vous revoir, ${account.name.split(' ')[0]} !`);
  }

  function signOut({ silent = false } = {}) {
    if (!state.session) return;
    const name = state.session.name;
    state.session = null;
    persistSession();
    updateAccountUI();
    renderAuthView('login');
    if (!silent) showToast(`À bientôt, ${name.split(' ')[0]} !`);
  }

  /** Piège de focus minimal : Tab reste dans la fenêtre modale. */
  function trapFocus(event) {
    if (event.key !== 'Tab') return;
    const dialog = $('.auth-dialog');
    if (!dialog) return;
    const focusables = $$('a[href], button:not([disabled]), input, select, textarea', dialog).filter(
      (element) => element.offsetParent !== null
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function bindAuthEvents() {
    document.addEventListener('click', (event) => {
      const opener = event.target.closest('[data-auth-open]');
      if (opener) {
        event.preventDefault();
        const signed = isSignedIn();
        openAuthModal(signed ? 'account' : 'login', { returnRoute: location.hash || '#/' });
        return;
      }

      if (event.target.closest('[data-auth-close]')) {
        event.preventDefault();
        closeAuthModal();
        return;
      }

      const tab = event.target.closest('[data-auth-tab]');
      if (tab && $('#auth-modal') && !$('#auth-modal').hidden) {
        event.preventDefault();
        renderAuthView(tab.dataset.authTab === 'register' ? 'register' : 'login');
        return;
      }

      if (event.target.closest('[data-auth-signout]')) {
        event.preventDefault();
        signOut();
        return;
      }

      if (event.target.closest('[data-auth-demo]')) {
        event.preventDefault();
        fillDemoAccount();
      }
    });

    document.addEventListener('submit', (event) => {
      const form = event.target.closest('[data-auth-form]');
      if (!form) return;
      event.preventDefault();
      handleAuthSubmit(form);
    });

    document.addEventListener('keydown', (event) => {
      const modal = $('#auth-modal');
      if (!modal || modal.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAuthModal();
        return;
      }
      trapFocus(event);
    });
  }

  /* ---------------------------- Favoris ----------------------------------- */
  function updateFavoriteButtons(listingId) {
    const active = state.favorites.has(listingId);
    $$(`[data-favorite="${escapeSelector(listingId)}"]`).forEach((button) => {
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
      const listing = getListing(listingId);
      const label = active ? t('detail.unfavorite') : t('detail.favorite');
      if (listing) button.setAttribute('aria-label', `${label} — ${listing.name}`);
      button.setAttribute('title', active ? t('detail.unfavorite') : t('detail.favorite'));
      const labelSpan = button.querySelector('[data-fav-label]');
      if (labelSpan) labelSpan.textContent = active ? t('detail.saved') : t('detail.favorite');
      if (button.classList.contains('btn')) {
        button.classList.toggle('btn-soft', active);
        button.classList.toggle('btn-ghost', !active);
      }
    });
  }

  function toggleFavorite(listingId) {
    const listing = getListing(listingId);
    if (!listing) return;
    const wasFavorite = state.favorites.has(listingId);

    if (wasFavorite) {
      state.favorites.delete(listingId);
      persistFavorites();
      updateFavoriteButtons(listingId);
      updateFavoritesCount();
      showToast(t('toast.favoriteRemoved', { name: listing.name }), {
        actionLabel: t('common.cancel'),
        onAction: () => {
          state.favorites.add(listingId);
          persistFavorites();
          updateFavoriteButtons(listingId);
          updateFavoritesCount();
          if (state.route?.path === '/favoris') renderRoute();
        },
      });
      if (state.route?.path === '/favoris') renderRoute();
    } else {
      state.favorites.add(listingId);
      persistFavorites();
      updateFavoriteButtons(listingId);
      updateFavoritesCount();
      showToast(t('toast.favoriteAdded', { name: listing.name }), {
        actionLabel: t('toast.view'),
        onAction: () => {
          location.hash = '#/favoris';
        },
      });
    }
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      // On bascule sur la méthode de secours ci-dessous.
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      textarea.remove();
      return success;
    } catch (error) {
      return false;
    }
  }

  async function shareListing(listingId) {
    const listing = getListing(listingId);
    if (!listing) return;
    const url = sharePageUrl(listing) || listingUrl(listing);
    if (navigator.share) {
      try {
        await navigator.share({ title: listing.name, text: t('detail.share.text', { name: listing.name }), url });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    const success = await copyText(url);
    showToast(success ? t('detail.share.copied') : t('toast.error'));
  }

  function deleteCustomListing(listingId, name) {
    if (!window.confirm(`Supprimer définitivement « ${name} » de BamaHub ?`)) return;
    const index = state.listings.findIndex((listing) => listing.id === listingId);
    if (index === -1) return;
    state.listings.splice(index, 1);
    state.favorites.delete(listingId);
    persistCustomListings();
    persistFavorites();
    updateFavoritesCount();
    showToast(`« ${name} » a été supprimée.`);
    location.hash = '#/explorer';
  }


  /* ==========================================================================
     12bis. Interactions v2 : langue, réglages, avis, promos, voix, QR
     ========================================================================== */

  /* ------------------------------ Langue ---------------------------------- */

  function syncLangButton() {
    const button = $('[data-lang-toggle]');
    if (!button) return;
    const lang = getLang();
    const label = button.querySelector('[data-lang-label]');
    if (label) label.textContent = lang === 'bm' ? 'BM' : 'FR';
    const name = window.BamaHubI18n?.getName(lang) || 'Français';
    button.setAttribute('aria-label', `${t('nav.language')} : ${name}`);
    button.setAttribute('title', `${t('nav.language')} : ${name}`);
  }

  function changeLanguage(lang) {
    if (!window.BamaHubI18n) return;
    const changed = window.BamaHubI18n.setLang(lang);
    syncLangButton();
    syncSettingsUI();
    updateAccountUI();
    renderRoute();
    showToast(t('toast.language', { lang: window.BamaHubI18n.getName(changed) }));
  }

  function toggleLanguage() {
    changeLanguage(getLang() === 'fr' ? 'bm' : 'fr');
  }

  /* ----------------------------- Paramètres -------------------------------- */

  function syncSettingsUI() {
    if (!window.BamaHubI18n) return;
    const lang = getLang();
    $$('[data-set-lang]').forEach((button) => {
      button.setAttribute('aria-checked', String(button.dataset.setLang === lang));
    });
    $$('[data-set-datasaver]').forEach((button) => {
      button.setAttribute('aria-checked', String(button.dataset.setDatasaver === state.dataSaver));
    });
    $$('[data-set-images]').forEach((button) => {
      button.setAttribute('aria-checked', String(button.dataset.setImages === state.images));
    });
    const theme = readStorage(STORAGE.theme, null) || 'auto';
    $$('[data-set-theme]').forEach((button) => {
      button.setAttribute('aria-checked', String(button.dataset.setTheme === theme));
    });
    const modal = $('#settings-modal');
    if (modal) modal.setAttribute('data-datasaver', dataSaverActive() ? 'on' : 'off');
  }

  function setInertBackground(inert) {
    ['#main', '.site-header', '.site-footer', '.bottom-nav'].forEach((selector) => {
      const element = $(selector);
      if (!element) return;
      if (inert) element.setAttribute('inert', '');
      else element.removeAttribute('inert');
    });
  }

  function openSettingsModal() {
    const modal = $('#settings-modal');
    if (!modal || !modal.hidden) return;
    state.lastFocusedElement = document.activeElement;
    state.settingsOpen = true;
    syncSettingsUI();
    modal.hidden = false;
    document.body.classList.add('settings-open');
    document.body.style.overflow = 'hidden';
    setInertBackground(true);
    $('.settings-dialog', modal)?.focus({ preventScroll: true });
  }

  function closeSettingsModal() {
    const modal = $('#settings-modal');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    state.settingsOpen = false;
    document.body.classList.remove('settings-open');
    document.body.style.overflow = '';
    if (!state.authOpen) setInertBackground(false);
    if (state.lastFocusedElement instanceof HTMLElement && document.contains(state.lastFocusedElement)) {
      state.lastFocusedElement.focus({ preventScroll: true });
    }
  }

  function setDataSaverPreference(value) {
    if (!['auto', 'on', 'off'].includes(value)) return;
    state.dataSaver = value;
    writeStorage(STORAGE.dataSaver, value);
    syncSettingsUI();
    renderRoute();
    const labels = { auto: t('settings.data.auto'), on: t('settings.data.on'), off: t('settings.data.off') };
    showToast(t('toast.dataSaver', { state: labels[value] }));
  }

  function setImagesPreference(value) {
    if (!['normal', 'none'].includes(value)) return;
    state.images = value;
    writeStorage(STORAGE.images, value);
    syncSettingsUI();
    renderRoute();
    showToast(t('settings.saved'));
  }

  function setThemePreference(value) {
    if (value === 'auto') {
      try {
        localStorage.removeItem(STORAGE.theme);
      } catch (error) {
        /* stockage indisponible */
      }
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark ? 'dark' : 'light', false);
    } else {
      applyTheme(value, true);
    }
    syncSettingsUI();
  }

  /* -------------------------------- Voix ----------------------------------- */

  function startVoiceSearch(scope) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast(t('explore.voiceUnsupported'));
      return;
    }

    if (state.voiceActive) {
      state.voiceRecognition?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    state.voiceRecognition = recognition;
    state.voiceActive = true;
    $$('[data-voice]').forEach((button) => button.classList.add('is-listening'));
    showToast(t('explore.voiceListening'), { duration: 6000 });

    recognition.onresult = (event) => {
      const transcript = String(event.results?.[0]?.[0]?.transcript || '').trim();
      if (!transcript) {
        showToast(t('explore.voiceError'));
        return;
      }
      if (scope === 'home') {
        const input = $('#home-search');
        if (input) input.value = transcript;
        location.hash = `#/explorer?q=${encodeURIComponent(transcript)}`;
      } else {
        state.filters.q = transcript;
        const input = $('#filter-q');
        if (input) input.value = transcript;
        updateExplorerResults();
      }
      recordHistory({ type: 'search', q: transcript });
      showToast(t('explore.voiceDone', { q: transcript }));
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted') return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        showToast(t('explore.voiceUnsupported'));
      } else {
        showToast(t('explore.voiceError'));
      }
    };

    recognition.onend = () => {
      state.voiceActive = false;
      state.voiceRecognition = null;
      $$('[data-voice]').forEach((button) => button.classList.remove('is-listening'));
    };

    try {
      recognition.start();
    } catch (error) {
      state.voiceActive = false;
      showToast(t('explore.voiceUnsupported'));
    }
  }

  /* -------------------------------- Avis ----------------------------------- */

  function handleReviewSubmit(form) {
    if (!state.session) {
      showToast(t('detail.review.login'));
      return;
    }
    const listing = getListing(form.dataset.listing);
    if (!listing) return;
    const rating = Number(form.querySelector('[data-rating-value]')?.value || 0);
    const text = (form.querySelector('textarea')?.value || '').trim();
    if (!rating || !text) {
      showToast(t('detail.review.required'));
      return;
    }

    const photo =
      state.reviewPhotoDraft?.listingId === listing.id ? state.reviewPhotoDraft.dataUrl : null;
    const review = {
      id: `r-${Date.now()}`,
      author: state.session.name,
      rating: Math.min(5, Math.max(1, rating)),
      text: text.slice(0, 600),
      date: todayISO(),
      verified: true,
      photo,
      helpful: 0,
    };
    state.reviews[listing.id] = [review, ...(Array.isArray(state.reviews[listing.id]) ? state.reviews[listing.id] : [])];
    if (!persistReviews()) showToast(t('toast.storage'));
    state.reviewPhotoDraft = null;
    showToast(t('detail.review.thanks'));
    renderRoute();
    requestAnimationFrame(() => {
      $('.reviews-panel')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }

  function openReportForm(button) {
    const item = button.closest('.review-item');
    if (!item) return;
    const existing = item.querySelector('[data-report-form]');
    if (existing) {
      existing.hidden = !existing.hidden;
      if (!existing.hidden) existing.querySelector('select')?.focus();
      return;
    }
    const form = document.createElement('form');
    form.className = 'review-form report-form';
    form.setAttribute('data-report-form', '');
    form.dataset.reviewId = button.dataset.reportReview;
    form.dataset.listing = button.dataset.listing;
    form.innerHTML = `<h3>${escapeHtml(t('detail.review.reportTitle'))}</h3>
      <p class="settings-hint">${escapeHtml(t('detail.review.reportText'))}</p>
      <label class="sr-only" for="report-reason-${escapeHtml(button.dataset.reportReview)}">${escapeHtml(t('detail.review.reportReason'))}</label>
      <select class="select" name="reason" id="report-reason-${escapeHtml(button.dataset.reportReview)}">
        <option value="fake">${escapeHtml(t('detail.review.reportFake'))}</option>
        <option value="offensive">${escapeHtml(t('detail.review.reportOffensive'))}</option>
        <option value="wrong">${escapeHtml(t('detail.review.reportWrong'))}</option>
      </select>
      <textarea class="input" name="note" rows="2" maxlength="240" placeholder="${escapeHtml(t('detail.review.reportReason'))}"></textarea>
      <div class="inline-actions">
        <button type="submit" class="btn btn-danger-soft btn-sm">${escapeHtml(t('detail.review.reportSend'))}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-report-cancel>${escapeHtml(t('common.cancel'))}</button>
      </div>`;
    item.appendChild(form);
    form.querySelector('[data-report-cancel]')?.addEventListener('click', () => form.remove());
    form.querySelector('select')?.focus();
  }

  function handleReportSubmit(form) {
    const reviewId = form.dataset.reviewId;
    if (!reviewId) return;
    if (state.reports.some((report) => report.reviewId === reviewId)) {
      showToast(t('detail.review.alreadyReported'));
      return;
    }
    const data = new FormData(form);
    state.reports.push({
      reviewId,
      listingId: form.dataset.listing,
      reason: String(data.get('reason') || 'fake'),
      note: String(data.get('note') || '').slice(0, 240),
      at: Date.now(),
    });
    persistReports();
    form.closest('.review-item')?.classList.add('is-reported');
    const button = $(`[data-report-review="${escapeSelector(reviewId)}"]`);
    if (button) {
      button.disabled = true;
      button.innerHTML = `${ICONS.alert}${escapeHtml(t('detail.review.alreadyReported'))}`;
    }
    form.remove();
    showToast(t('detail.review.reportThanks'));
  }

  /* --------------------------- Promotions & offres ------------------------- */

  function handlePromoSubmit(form) {
    if (!state.session) {
      showToast(t('auth.login'));
      return;
    }
    const listing = getListing(form.dataset.listing);
    if (!listing) return;
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    const code = String(data.get('code') || '').trim().toUpperCase();
    const expires = String(data.get('expires') || '').trim();
    if (!title || !code || !expires) {
      showToast(t('detail.review.required'));
      return;
    }
    state.promos[listing.id] = {
      title,
      code,
      detail: String(data.get('detail') || '').trim().slice(0, 140),
      expires,
    };
    persistPromos();
    showToast(t('detail.promo.saved'));
    renderRoute();
  }

  function removePromo(listingId) {
    if (!state.promos[listingId]) return;
    delete state.promos[listingId];
    persistPromos();
    showToast(t('detail.promo.remove'));
    renderRoute();
  }

  function handleDailyOfferSubmit(form) {
    if (!state.session) {
      showToast(t('auth.login'));
      return;
    }
    const listing = getListing(form.dataset.listing);
    if (!listing) return;
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    const price = Number(data.get('price'));
    if (!title || !Number.isFinite(price) || price < 0) {
      showToast(t('detail.review.required'));
      return;
    }
    state.offers[listing.id] = {
      title,
      price,
      description: String(data.get('description') || '').trim().slice(0, 160),
      date: todayISO(),
    };
    persistOffers();
    showToast(t('detail.daily.saved'));
    renderRoute();
  }

  function removeDailyOffer(listingId) {
    if (!state.offers[listingId]) return;
    delete state.offers[listingId];
    persistOffers();
    showToast(t('detail.daily.delete'));
    renderRoute();
  }

  /* ------------------------- Badges d'ouverture ---------------------------- */

  function refreshOpenBadges() {
    $$('[data-open-badge]').forEach((badge) => {
      const listing = getListing(badge.dataset.openBadge);
      if (!listing) return;
      const status = getOpenState(listing);
      if (status.status === 'unknown') return;
      badge.className = `open-badge is-${status.status}`;
      const withDetail = badge.dataset.openDetail === 'true';
      badge.innerHTML = `<span class="dot" aria-hidden="true"></span>${escapeHtml(status.label)}${
        withDetail ? `<span class="open-detail">· ${escapeHtml(status.detail)}</span>` : ''
      }`;
      badge.title = status.detail;
    });
  }

  /* ------------------------------ Événements ------------------------------- */

  function bindV2Events() {
    document.addEventListener('click', (event) => {
      /* Langue et réglages */
      if (event.target.closest('[data-lang-toggle]')) {
        event.preventDefault();
        toggleLanguage();
        return;
      }

      const langButton = event.target.closest('[data-set-lang]');
      if (langButton) {
        event.preventDefault();
        changeLanguage(langButton.dataset.setLang);
        return;
      }

      if (event.target.closest('[data-settings-open]')) {
        event.preventDefault();
        openSettingsModal();
        return;
      }

      if (event.target.closest('[data-settings-close]')) {
        event.preventDefault();
        closeSettingsModal();
        return;
      }

      const dataSaverButton = event.target.closest('[data-set-datasaver]');
      if (dataSaverButton) {
        event.preventDefault();
        setDataSaverPreference(dataSaverButton.dataset.setDatasaver);
        return;
      }

      const imagesButton = event.target.closest('[data-set-images]');
      if (imagesButton) {
        event.preventDefault();
        setImagesPreference(imagesButton.dataset.setImages);
        return;
      }

      const themeButton = event.target.closest('[data-set-theme]');
      if (themeButton) {
        event.preventDefault();
        setThemePreference(themeButton.dataset.setTheme);
        return;
      }

      /* Recherche vocale */
      const voiceButton = event.target.closest('[data-voice]');
      if (voiceButton) {
        event.preventDefault();
        startVoiceSearch(voiceButton.dataset.voice === 'home' ? 'home' : 'explorer');
        return;
      }

      /* Comparateur */
      const compareButton = event.target.closest('[data-compare]');
      if (compareButton) {
        event.preventDefault();
        toggleCompare(compareButton.dataset.compare);
        return;
      }

      const compareRemove = event.target.closest('[data-compare-remove]');
      if (compareRemove) {
        event.preventDefault();
        toggleCompare(compareRemove.dataset.compareRemove);
        if (state.route?.path === '/comparer') {
          const ids = [...state.compare];
          location.hash = ids.length >= 2 ? `#/comparer?ids=${ids.join(',')}` : '#/explorer';
        }
        return;
      }

      if (event.target.closest('[data-compare-clear]')) {
        event.preventDefault();
        state.compare.clear();
        persistCompare();
        renderCompareTray();
        if (state.route?.path === '/comparer') {
          location.hash = '#/explorer';
        } else {
          $$('[data-compare]').forEach((button) => syncCompareButtons(button.dataset.compare));
        }
        return;
      }

      const compareGo = event.target.closest('[data-compare-go]');
      if (compareGo) {
        if (state.compare.size < 2) {
          event.preventDefault();
          showToast(t('explore.compareHint'));
        }
        return;
      }

      /* Avis : note, photo, utile, signalement */
      const star = event.target.closest('[data-star]');
      if (star) {
        event.preventDefault();
        const input = star.closest('[data-star-input]');
        const value = Number(star.dataset.star);
        const hidden = input?.querySelector('[data-rating-value]');
        if (hidden) hidden.value = value;
        $$('[data-star]', input || document).forEach((button) => {
          const active = Number(button.dataset.star) <= value;
          button.classList.toggle('is-on', active);
          button.setAttribute('aria-checked', String(Number(button.dataset.star) === value));
        });
        return;
      }

      const helpful = event.target.closest('[data-helpful]');
      if (helpful) {
        event.preventDefault();
        const id = helpful.dataset.helpful;
        if (state.helpfulGiven.has(id)) return;
        state.helpfulGiven.add(id);
        const count = Number(helpful.dataset.count || 0) + 1;
        const label = helpful.querySelector('[data-helpful-label]');
        if (label) label.textContent = `${t('detail.review.helpful')} (${count})`;
        helpful.classList.add('is-active');
        return;
      }

      const reportButton = event.target.closest('[data-report-review]');
      if (reportButton) {
        event.preventDefault();
        if (!state.session) {
          showToast(t('detail.review.login'));
          openAuthModal('login');
          return;
        }
        openReportForm(reportButton);
        return;
      }

      const removePhoto = event.target.closest('[data-remove-review-photo]');
      if (removePhoto) {
        event.preventDefault();
        state.reviewPhotoDraft = null;
        const form = removePhoto.closest('[data-review-form]');
        const preview = form?.querySelector('[data-photo-preview]');
        if (preview) {
          preview.hidden = true;
          preview.innerHTML = '';
        }
        const input = form?.querySelector('[data-review-photo]');
        if (input) input.value = '';
        return;
      }

      /* Promos, offres, QR, partage */
      if (event.target.closest('[data-toggle-coupon-qr]')) {
        const block = $('[data-coupon-qr]');
        if (block) block.hidden = !block.hidden;
        return;
      }

      const printButton = event.target.closest('[data-print-qr]');
      if (printButton) {
        event.preventDefault();
        const listing = getListing(printButton.dataset.printQr);
        if (listing) printQrSheet(listing);
        return;
      }

      const copyButton = event.target.closest('[data-copy]');
      if (copyButton) {
        event.preventDefault();
        copyText(copyButton.dataset.copy).then((success) => {
          showToast(success ? t('toast.copied') : t('toast.error'));
        });
        return;
      }

      const removePromoButton = event.target.closest('[data-remove-promo]');
      if (removePromoButton) {
        event.preventDefault();
        removePromo(removePromoButton.dataset.removePromo);
        return;
      }

      const removeOfferButton = event.target.closest('[data-remove-offer]');
      if (removeOfferButton) {
        event.preventDefault();
        removeDailyOffer(removeOfferButton.dataset.removeOffer);
        return;
      }

      const clearHistory = event.target.closest('[data-clear-history]');
      if (clearHistory) {
        event.preventDefault();
        state.history = [];
        writeStorage(STORAGE.history, state.history);
        renderRoute();
        showToast(t('settings.saved'));
        return;
      }
    });

    /* Formulaires v2 */
    document.addEventListener('submit', (event) => {
      const form = event.target;
      if (form.matches('[data-review-form]')) {
        event.preventDefault();
        handleReviewSubmit(form);
        return;
      }
      if (form.matches('[data-report-form]')) {
        event.preventDefault();
        handleReportSubmit(form);
        return;
      }
      if (form.matches('[data-promo-form]')) {
        event.preventDefault();
        handlePromoSubmit(form);
        return;
      }
      if (form.matches('[data-daily-form]')) {
        event.preventDefault();
        handleDailyOfferSubmit(form);
        return;
      }
    });

    /* Photo d'avis : compression avant stockage */
    document.addEventListener('change', async (event) => {
      const input = event.target.closest('[data-review-photo]');
      if (!input) return;
      const file = input.files?.[0];
      if (!file) return;
      const form = input.closest('[data-review-form]');
      if (!form) return;
      const options = dataSaverActive() ? { maxWidth: 640, quality: 0.6 } : { maxWidth: 900, quality: 0.72 };
      const dataUrl = await compressImage(file, options);
      if (!dataUrl) {
        showToast(t('toast.error'));
        return;
      }
      state.reviewPhotoDraft = { listingId: form.dataset.listing, dataUrl };
      const preview = form.querySelector('[data-photo-preview]');
      if (preview) {
        preview.hidden = false;
        preview.innerHTML = `<img src="${dataUrl}" alt="${escapeHtml(t('detail.review.photoHint'))}" />
          <button type="button" class="review-action is-warn" data-remove-review-photo>${ICONS.x}${escapeHtml(t('detail.review.removePhoto'))}</button>`;
      }
    });

    /* Échap et piège à focus pour la fenêtre de paramètres */
    document.addEventListener('keydown', (event) => {
      const modal = $('#settings-modal');
      if (!modal || modal.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSettingsModal();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = $('.settings-dialog', modal);
      if (!dialog) return;
      const focusables = $$('a[href], button:not([disabled]), input, select, textarea', dialog).filter(
        (element) => element.offsetParent !== null
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    /* Mise à jour des badges « Ouvert / Fermé » chaque minute */
    window.setInterval(refreshOpenBadges, 60000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshOpenBadges();
    });
  }

  /* ---------------------- Événements globaux ------------------------------ */
  function bindGlobalEvents() {
    document.addEventListener('submit', (event) => {
      const form = event.target;
      if (form.matches('[data-search-form]')) {
        event.preventDefault();
        const query = (new FormData(form).get('q') || '').toString().trim();
        location.hash = query ? `#/explorer?q=${encodeURIComponent(query)}` : '#/explorer';
        return;
      }
      if (form.id === 'add-form') {
        handleAddSubmit(event);
      }
    });

    document.addEventListener('click', (event) => {
      const skipLink = event.target.closest('[data-skip-link]');
      if (skipLink) {
        event.preventDefault();
        const main = $('#main');
        main?.focus();
        main?.scrollIntoView({ block: 'start' });
        return;
      }

      const favorite = event.target.closest('[data-favorite]');
      if (favorite) {
        event.preventDefault();
        toggleFavorite(favorite.dataset.favorite);
        return;
      }

      const share = event.target.closest('[data-share]');
      if (share) {
        event.preventDefault();
        shareListing(share.dataset.share);
        return;
      }

      const clearFavorites = event.target.closest('[data-clear-favorites]');
      if (clearFavorites) {
        if (!state.favorites.size) return;
        if (!window.confirm(`Retirer les ${state.favorites.size} adresses de vos favoris ?`)) return;
        state.favorites.clear();
        persistFavorites();
        updateFavoritesCount();
        renderRoute();
        showToast('Vos favoris ont été effacés.');
        return;
      }

      const deleteButton = event.target.closest('[data-delete-listing]');
      if (deleteButton) {
        deleteCustomListing(deleteButton.dataset.deleteListing, deleteButton.dataset.name || 'cette adresse');
      }
    });

    window.addEventListener('hashchange', () => renderRoute());

    // Raccourci clavier « / » pour aller à la recherche (hors champs de saisie).
    document.addEventListener('keydown', (event) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (state.route?.path === '/explorer') {
        event.preventDefault();
        $('#filter-q')?.focus();
      }
    });
  }

  /* ------------------------------- Démarrage ------------------------------ */
  function init() {
    loadState();
    initTheme();
    initSplash();
    bindGlobalEvents();
    bindV2Events();
    bindAuthEvents();
    if (window.BamaHubI18n) window.BamaHubI18n.apply();
    syncLangButton();
    syncSettingsUI();
    updateAccountUI();
    renderRoute({ initial: true });
    state.initialized = true;

    // Sécurité légère : si la page devient visible via le cache (bfcache).
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        updateFavoritesCount();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
