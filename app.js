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

  const { CATEGORIES, NEIGHBORHOODS, LISTINGS } = DATA;

  const STORAGE = {
    favorites: 'bamahub:favorites',
    custom: 'bamahub:listings',
    theme: 'bamahub:theme',
    lastExplorer: 'bamahub:last-explorer',
    accounts: 'bamahub:accounts',
    session: 'bamahub:session',
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
  ];

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
    lastFocusedElement: null,
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
  };

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
        ? '<span class="no-price">Tarif sur demande</span>'
        : '<span class="no-price">Prix sur demande</span>';
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
    if (!listing.rating) {
      return '<span class="pill pill-outline">Nouveau</span>';
    }
    return `<span class="card-rating" title="Note moyenne de ${formatRating(listing.rating)} sur 5">${ICONS.star}<strong>${formatRating(listing.rating)}</strong><span>(${formatNumber(listing.reviews || 0)} avis)</span></span>`;
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
    const label = active ? 'Retirer des favoris' : 'Ajouter aux favoris';
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
    const mediaBadges = badges.length
      ? badges.slice(0, 2).map((badge) => `<span class="media-badge is-status">${escapeHtml(badge)}</span>`)
      : [`<span class="media-badge">${escapeHtml(cat.label)}</span>`];

    const subcategory = listing.subcategories?.[0] || cat.label;
    const title = preview
      ? `<span>${escapeHtml(listing.name)}</span>`
      : `<a href="#/adresse/${escapeHtml(listing.id)}">${escapeHtml(listing.name)}</a>`;
    return `<article class="listing-card" style="--cat:${escapeHtml(cat.color)};--i:${Math.min(index, 8)}"${preview ? ' data-preview="true"' : ''}>
      <div class="card-media">
        <div class="media-icon">${categoryIcon(cat)}</div>
        ${preview ? '' : favoriteButton(listing)}
        <div class="media-labels">${mediaBadges.join('')}</div>
      </div>
      <div class="card-body">
        <p class="card-kicker">${escapeHtml(subcategory)} <span class="sep">·</span> ${escapeHtml(listing.neighborhood || 'Bamako')}</p>
        <h3 class="card-title">${title}</h3>
        ${ratingMarkup(listing)}
        ${distanceLabel(listing) ? `<p class="card-distance">${ICONS.crosshair} Vous êtes ${escapeHtml(distanceLabel(listing))}</p>` : ''}
        <div class="card-meta">
          <span>${ICONS.mapPin} ${escapeHtml(listing.neighborhood || 'Bamako')}</span>
          <span>${ICONS.clock} ${escapeHtml(listing.hours || 'Horaires sur demande')}</span>
        </div>
        <p class="card-desc">${escapeHtml(listing.description || 'Aucune description pour le moment.')}</p>
        <div class="card-footer">
          <div class="card-price">${priceMarkup(listing)}</div>
          <span class="card-cta">${preview ? 'Aperçu' : 'Voir la fiche'} ${ICONS.arrowRight}</span>
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

    const categoryCards = CATEGORIES.map((cat) => {
      const count = state.listings.filter((listing) => listing.category === cat.id).length;
      return `<a class="category-card" style="--cat:${escapeHtml(cat.color)}" href="#/explorer?cat=${escapeHtml(cat.id)}">
        <div class="cat-top">
          <span class="cat-icon">${categoryIcon(cat)}</span>
          <span class="cat-arrow">${ICONS.arrowRight}</span>
        </div>
        <div class="cat-info">
          <h3>${escapeHtml(cat.label)}</h3>
          <p>${count} adresse${count > 1 ? 's' : ''}</p>
        </div>
      </a>`;
    }).join('');

    document.title = 'BamaHub — L’annuaire de Bamako';

    $('#main').innerHTML = `
      <section class="hero">
        <div class="container hero-content">
          <span class="hero-eyebrow"><span class="dot"></span> Annuaire local · Bamako, Mali</span>
          <h1>Les bonnes adresses de <span class="gradient">Bamako</span>, à portée de main.</h1>
          <p class="hero-sub">Restaurants, hôtels, pharmacies de garde, artisans et adresses utiles : trouvez le bon contact, appelez et gardez vos favoris sous la main.</p>

          <form class="search-form" data-search-form role="search">
            <label class="sr-only" for="home-search">Rechercher une adresse à Bamako</label>
            ${ICONS.search}
            <input id="home-search" type="search" name="q" placeholder="Restaurant, pharmacie, quartier, repère…" autocomplete="off" />
            <button class="btn btn-primary" type="submit">Rechercher</button>
          </form>

          <div class="search-hints">
            <span>Essayez :</span>
            <a class="hint-chip" href="#/explorer?quick=duty">Pharmacie de garde</a>
            <a class="hint-chip" href="#/explorer?cat=restaurants">Riz au gras</a>
            <a class="hint-chip" href="#/explorer?q=poisson">Poisson braisé</a>
            <a class="hint-chip" href="#/explorer?cat=hotels">Hôtel ACI 2000</a>
          </div>

          <div class="hero-stats">
            <div class="hero-stat"><strong>${total}</strong><span>adresses</span></div>
            <div class="hero-stat"><strong>${CATEGORIES.length}</strong><span>catégories</span></div>
            <div class="hero-stat"><strong>${NEIGHBORHOODS.length}</strong><span>quartiers couverts</span></div>
            <div class="hero-stat"><strong>100 %</strong><span>local &amp; gratuit</span></div>
          </div>
        </div>
      </section>

      <div class="container">
        <section class="section" aria-labelledby="categories-title">
          <div class="section-head">
            <div>
              <span class="eyebrow">Explorer</span>
              <h2 id="categories-title">Que cherchez-vous ?</h2>
              <p>Toutes les catégories de l’annuaire, en un clin d’œil.</p>
            </div>
          </div>
          <div class="category-grid stagger">${categoryCards}</div>
        </section>

        <section class="section" aria-labelledby="latest-title">
          <div class="section-head">
            <div>
              <span class="eyebrow">Nouveau à Bamako</span>
              <h2 id="latest-title">Derniers ajouts</h2>
              <p>Les adresses qui viennent de rejoindre BamaHub.</p>
            </div>
            <a class="section-link" href="#/explorer?sort=recent">Tout voir ${ICONS.arrowRight}</a>
          </div>
          ${listingGrid(latest)}
        </section>

        <section class="section" aria-labelledby="popular-title">
          <div class="section-head">
            <div>
              <span class="eyebrow">Les incontournables</span>
              <h2 id="popular-title">Populaires</h2>
              <p>Les adresses les plus recommandées par les habitants.</p>
            </div>
            <a class="section-link" href="#/explorer?sort=note">Tout voir ${ICONS.arrowRight}</a>
          </div>
          ${listingGrid(popular)}
        </section>

        <section class="section" aria-labelledby="hoods-title">
          <div class="section-head">
            <div>
              <span class="eyebrow">Près de chez vous</span>
              <h2 id="hoods-title">Explorer par quartier</h2>
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
            <h2>Vous tenez un commerce à Bamako ?</h2>
            <p>Ajoutez votre adresse gratuitement et aidez les habitants à vous trouver.</p>
          </div>
          <a class="btn btn-white btn-lg" href="#/ajouter">${ICONS.plus} Ajouter mon adresse</a>
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
    return `<option value="">Toutes les sous-catégories</option>${subcategories
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

    return `<div class="quick-filters" role="group" aria-label="Filtres rapides">
      <span class="label">Filtres rapides</span>
      ${available
        .map((quick) => {
          const active = filters.quick === quick.id;
          return `<button type="button" class="quick-chip${active ? ' is-active' : ''}" data-quick="${quick.id}" aria-pressed="${active}">
            ${ICONS.sparkles} ${escapeHtml(quick.label)}
          </button>`;
        })
        .join('')}
    </div>`;
  }

  function categoryChipsHTML(filters) {
    return `<div class="category-chips" role="group" aria-label="Filtrer par catégorie">
      <button type="button" class="chip${filters.cat === '' ? ' is-active' : ''}" data-cat="" aria-pressed="${filters.cat === ''}">
        Toutes <span class="chip-count">${state.listings.length}</span>
      </button>
      ${CATEGORIES.map((cat) => {
        const count = state.listings.filter((listing) => listing.category === cat.id).length;
        const active = filters.cat === cat.id;
        return `<button type="button" class="chip${active ? ' is-active' : ''}" data-cat="${cat.id}" aria-pressed="${active}" style="--cat:${cat.color}">
          <span class="chip-dot"></span>${escapeHtml(cat.label)} <span class="chip-count">${count}</span>
        </button>`;
      }).join('')}
    </div>`;
  }

  function renderExplorer(params) {
    state.filters = filtersFromParams(params);
    state.filtersOpen = false;
    const filters = state.filters;
    const cat = filters.cat ? getCategory(filters.cat) : null;

    const title = cat ? `${cat.label} à Bamako` : 'Toutes les adresses de Bamako';
    const subtitle = cat
      ? cat.tagline
      : 'Parcourez l’annuaire, filtrez par catégorie, quartier ou besoin, et trouvez la bonne adresse en quelques secondes.';

    document.title = cat ? `${cat.label} — BamaHub` : 'Explorer — BamaHub';

    $('#main').innerHTML = `
      <div class="container page explorer-page">
        <div class="page-head">
          ${breadcrumbs([
            { label: 'Accueil', href: '#/' },
            { label: 'Explorer', href: '#/explorer' },
            ...(cat ? [{ label: cat.label, href: explorerHash({ ...defaultFilters(), cat: cat.id }) }] : []),
          ])}
          <h1 class="page-title">${escapeHtml(title)}</h1>
          <p class="page-sub">${escapeHtml(subtitle)}</p>
        </div>

        <section class="explorer-toolbar" aria-label="Filtres de recherche">
          <div class="search-inline">
            ${ICONS.search}
            <label class="sr-only" for="filter-q">Rechercher une adresse</label>
            <input id="filter-q" class="input" type="search" placeholder="Nom, plat, service, quartier, repère…" value="${escapeHtml(filters.q)}" autocomplete="off" />
            <button type="button" class="search-clear" data-clear-search aria-label="Effacer la recherche" ${filters.q ? '' : 'hidden'}>${ICONS.x}</button>
          </div>

          ${categoryChipsHTML(filters)}

          <div class="quick-filters-slot">${quickFiltersHTML(filters)}</div>

          <button type="button" class="filters-toggle" data-filters-toggle aria-expanded="false" aria-controls="filters-panel">
            <span class="toggle-left">${ICONS.sliders} Plus de filtres <span class="filter-count" data-filter-count ${activeFiltersCount() ? '' : 'hidden'}>${activeFiltersCount()}</span></span>
            ${ICONS.chevronDown}
          </button>

          <div class="filters-panel" id="filters-panel">
            <div class="field">
              <label for="filter-hood">Quartier</label>
              <select id="filter-hood" class="select">
                <option value="">Tous les quartiers</option>
                ${NEIGHBORHOODS.map(
                  (hood) => `<option value="${escapeHtml(hood)}"${filters.hood === hood ? ' selected' : ''}>${escapeHtml(hood)}</option>`
                ).join('')}
              </select>
            </div>
            <div class="field">
              <label for="filter-sub">Sous-catégorie</label>
              <select id="filter-sub" class="select">${subcategoryOptionsHTML(filters)}</select>
            </div>
            <div class="field">
              <label for="filter-sort">Trier par</label>
              <select id="filter-sort" class="select">
                ${SORT_OPTIONS.map(
                  (option) => `<option value="${option.id}"${filters.sort === option.id ? ' selected' : ''}>${option.label}</option>`
                ).join('')}
              </select>
            </div>
            <button type="button" class="filters-reset" data-reset-filters>${ICONS.refresh} Réinitialiser les filtres</button>
          </div>
        </section>

        <div class="explorer-actions">
          <div class="view-toggle" role="group" aria-label="Mode d’affichage">
            <button type="button" data-view="list" class="${filters.view === 'list' ? 'is-active' : ''}" aria-pressed="${filters.view === 'list'}">
              ${ICONS.list} Liste
            </button>
            <button type="button" data-view="map" class="${filters.view === 'map' ? 'is-active' : ''}" aria-pressed="${filters.view === 'map'}">
              ${ICONS.map} Carte
            </button>
          </div>
          <button type="button" class="near-me-toggle${state.nearMe ? ' is-active' : ''}" data-near-me aria-pressed="${state.nearMe}" aria-controls="near-me-bar">
            ${ICONS.target} <span data-near-me-label>${state.nearMe ? 'Autour de moi · actif' : 'Autour de moi'}</span>
          </button>
        </div>

        <div class="near-me-bar" id="near-me-bar" data-near-me-bar ${state.nearMe ? '' : 'hidden'}>
          <span class="near-me-label">${ICONS.radius} Rayon</span>
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
          <p class="map-hint">${ICONS.info} Cliquez sur une épingle pour voir l’adresse, l’itinéraire et le partage WhatsApp.</p>
        </div>
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
      if (quickFilter) chips.push(chip('quick', quickFilter.label));
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
      const label = count === 1 ? 'adresse trouvée' : 'adresses trouvées';
      countEl.innerHTML = `<strong>${count}</strong> ${label}${q ? ` pour « ${escapeHtml(q)} »` : ''}${cat ? ` · ${escapeHtml(getCategory(cat).label)}` : ''}`;
    }

    resultsGrid.innerHTML = count
      ? listingGrid(items)
      : emptyState({
          title: 'Aucune adresse trouvée',
          text: 'Essayez un autre mot-clé, changez de quartier ou retirez un filtre. De nouvelles adresses arrivent régulièrement.',
          iconMarkup: ICONS.searchX,
          action: `<button type="button" class="btn btn-primary" data-reset-filters>${ICONS.refresh} Réinitialiser les filtres</button>`,
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

  function attachExplorerListeners() {
    const qInput = $('#filter-q');
    qInput?.addEventListener('input', () => {
      state.filters.q = qInput.value;
      updateExplorerResults();
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
    const labels = field.valueLabels || { true: 'Oui', false: 'Non' };
    const text = labels[value ? 'true' : 'false'] || (value ? 'Oui' : 'Non');
    const statusIcon = value ? ICONS.checkCircle : ICONS.xCircle;
    return `<div class="fact"><span class="fact-label">${escapeHtml(field.label)}</span>
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
    return `<div class="fact"><span class="fact-label">${escapeHtml(field.label)}</span><span class="fact-value">${escapeHtml(text)}</span></div>`;
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

  function renderDetail(route) {
    const listing = getListing(route.segments[1]);
    if (!listing) {
      renderNotFound('Cette adresse n’existe pas ou a été supprimée.', 'Adresse introuvable');
      return;
    }

    const cat = getCategory(listing.category);
    const isFavorite = state.favorites.has(listing.id);
    const statuses = statusBadges(listing);
    const priceInfo = getPriceInfo(listing);
    const rawPhone = (listing.phone || '').replace(/[^\d+]/g, '');
    const waNumber = (listing.whatsapp || '').replace(/\D/g, '');
    document.title = `${listing.name} — BamaHub`;

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
          <h2 class="panel-title">${ICONS.info} Informations</h2>
          <div class="fact-list">${factFields.map((field) => fieldFact(field, listing.fields[field.key])).join('')}</div>
        </section>`
      : '';

    const contentPanels = contentFields
      .map(
        (field) => `<section class="panel">
          <h2 class="panel-title">${ICONS.checkCircle} ${escapeHtml(field.label)}</h2>
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
        <a class="back-link" href="${escapeHtml(state.lastExplorerHash || '#/explorer')}">${ICONS.arrowLeft} Retour aux adresses</a>
        ${breadcrumbs([
          { label: 'Accueil', href: '#/' },
          { label: cat.label, href: explorerHash({ ...defaultFilters(), cat: cat.id }) },
          { label: listing.name, href: '#/adresse/' + listing.id },
        ])}

        <header class="detail-hero" style="--cat:${escapeHtml(cat.color)}">
          <div class="detail-top">
            <span class="detail-icon">${categoryIcon(cat)}</span>
            <div class="detail-heading">
              <div class="detail-badge-row">
                <span class="pill pill-cat">${escapeHtml(cat.label)}</span>
                ${statuses.map((status) => `<span class="pill pill-success pill-dot">${escapeHtml(status)}</span>`).join('')}
                ${isNew(listing.createdAt) ? '<span class="pill pill-outline">Nouveau</span>' : ''}
                ${listing.isCustom ? '<span class="pill pill-outline">Votre adresse</span>' : ''}
              </div>
              <h1 class="detail-title">${escapeHtml(listing.name)}</h1>
              <div class="detail-rating">
                ${
                  listing.rating
                    ? `<span class="rating-pill">${ICONS.star} ${formatRating(listing.rating)}</span>
                       <span>${formatNumber(listing.reviews || 0)} avis</span>
                       <span aria-hidden="true">·</span>
                       <span>${escapeHtml((listing.subcategories || []).join(' · '))}</span>`
                    : `<span class="pill pill-outline">Nouvelle adresse</span>
                       <span>Aucun avis pour le moment</span>`
                }
              </div>
              <p class="detail-loc">${ICONS.mapPin}
                <span>${escapeHtml(listing.address)}${listing.neighborhood ? ` · ${escapeHtml(listing.neighborhood)}` : ''}</span>
              </p>
              ${
                listing.landmark
                  ? `<p class="detail-landmark">${ICONS.crosshair}<span><strong>Repère :</strong> ${escapeHtml(listing.landmark)}</span></p>`
                  : ''
              }
              ${distanceLabel(listing) ? `<p class="detail-distance">${ICONS.target} Vous êtes ${escapeHtml(distanceLabel(listing))} de cette adresse.</p>` : ''}
            </div>
          </div>

          <div class="detail-actions">
            <button type="button" class="btn ${isFavorite ? 'btn-soft' : 'btn-ghost'}" data-favorite="${escapeHtml(listing.id)}" aria-pressed="${isFavorite}" aria-label="${isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} — ${escapeHtml(listing.name)}">
              ${ICONS.heart}<span data-fav-label>${isFavorite ? 'Enregistré' : 'Favori'}</span>
            </button>
            <button type="button" class="btn btn-ghost" data-share="${escapeHtml(listing.id)}">
              ${ICONS.share}<span>Partager</span>
            </button>
            <a class="btn btn-ghost" href="${googleMapsUrl(listing)}" target="_blank" rel="noopener">
              ${ICONS.route}<span>Itinéraire Google</span>
            </a>
            <a class="btn btn-ghost" href="${wazeUrl(listing)}" target="_blank" rel="noopener">
              ${ICONS.navigation}<span>Waze</span>
            </a>
            <a class="btn btn-whatsapp" href="${whatsappShareUrl(listing)}" target="_blank" rel="noopener">
              ${ICONS.whatsapp}<span>Partager sur WhatsApp</span>
            </a>
          </div>
        </header>

        <div class="detail-layout">
          <div class="detail-main">
            <section class="panel">
              <h2 class="panel-title">${ICONS.info} À propos</h2>
              <div class="prose">
                ${String(listing.description || '')
                  .split('\n')
                  .filter(Boolean)
                  .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
                  .join('') || '<p>Cette adresse n’a pas encore de description.</p>'}
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

            <section class="panel">
              <h2 class="panel-title">${ICONS.mapPin} Localisation</h2>
              <div class="fact-list">
                <div class="fact"><span class="fact-label">Quartier</span><span class="fact-value">${escapeHtml(listing.neighborhood || 'Bamako')}</span></div>
                <div class="fact"><span class="fact-label">Adresse</span><span class="fact-value">${escapeHtml(listing.address)}</span></div>
                ${
                  listing.landmark
                    ? `<div class="fact"><span class="fact-label">Repère</span><span class="fact-value">${escapeHtml(listing.landmark)}</span></div>`
                    : ''
                }
              </div>
              <div id="detail-map" class="detail-map" role="application" aria-label="Carte de ${escapeHtml(listing.name)}"></div>
              <div class="location-actions">
                <a class="btn btn-soft" href="${googlePlaceUrl(listing)}" target="_blank" rel="noopener">${ICONS.mapPin} Google Maps</a>
                <a class="btn btn-soft" href="${googleMapsUrl(listing)}" target="_blank" rel="noopener">${ICONS.route} Itinéraire</a>
                <a class="btn btn-soft" href="${wazeUrl(listing)}" target="_blank" rel="noopener">${ICONS.navigation} Waze</a>
                <a class="btn btn-soft is-whatsapp" href="${whatsappShareUrl(listing)}" target="_blank" rel="noopener">${ICONS.whatsapp} Partager la position</a>
              </div>
            </section>
          </div>

          <aside class="detail-aside">
            <div class="panel contact-panel" style="--cat:${escapeHtml(cat.color)}">
              ${
                priceInfo
                  ? `<div class="price-block">
                      <span class="price-caption">${escapeHtml(priceInfo.field.label)}</span>
                      <div class="price-main">${priceMarkup(listing, { detailed: true })}</div>
                      <p class="price-hint">Tarif indicatif — à confirmer auprès de l’établissement.</p>
                    </div>`
                  : ''
              }

              <div class="contact-list">
                ${listing.phone ? `<div class="contact-row">${ICONS.phone}<div><span class="contact-label">Téléphone</span><a class="contact-value" href="tel:${escapeHtml(rawPhone)}">${escapeHtml(listing.phone)}</a></div></div>` : ''}
                ${waNumber ? `<div class="contact-row">${ICONS.whatsapp}<div><span class="contact-label">WhatsApp</span><a class="contact-value" href="https://wa.me/${escapeHtml(waNumber)}" target="_blank" rel="noopener">${escapeHtml(listing.phone || `+${waNumber}`)}</a></div></div>` : ''}
                <div class="contact-row">${ICONS.clock}<div><span class="contact-label">Horaires</span><span class="contact-value">${escapeHtml(listing.hours || 'Horaires non communiqués')}</span></div></div>
                <div class="contact-row">${ICONS.mapPin}<div><span class="contact-label">Adresse</span><span class="contact-value">${escapeHtml(listing.address)}</span></div></div>
              </div>

              <div class="contact-actions">
                ${listing.phone ? `<a class="btn btn-primary btn-block" href="tel:${escapeHtml(rawPhone)}">${ICONS.phone} Appeler</a>` : ''}
                ${waNumber ? `<a class="btn btn-ghost btn-block" href="https://wa.me/${escapeHtml(waNumber)}" target="_blank" rel="noopener">${ICONS.whatsapp} Écrire sur WhatsApp</a>` : ''}
                <a class="btn btn-ghost btn-block" href="${googleMapsUrl(listing)}" target="_blank" rel="noopener">${ICONS.route} Itinéraire Google</a>
                <a class="btn btn-ghost btn-block" href="${wazeUrl(listing)}" target="_blank" rel="noopener">${ICONS.navigation} Itinéraire Waze</a>
              </div>

              ${
                listing.isCustom
                  ? `<button type="button" class="btn btn-danger-soft btn-block" style="margin-top:0.7rem" data-delete-listing="${escapeHtml(listing.id)}" data-name="${escapeHtml(listing.name)}">${ICONS.trash} Supprimer cette adresse</button>`
                  : ''
              }
            </div>

            <div class="listing-count-note">
              <span>${listing.isCustom ? 'Adresse ajoutée par vous' : 'Adresse partagée par la communauté'}</span>
              <strong>${formatNumber(listing.reviews || 0)} avis</strong>
            </div>
          </aside>
        </div>

        ${
          similar.length
            ? `<section class="section" aria-labelledby="similar-title">
                <div class="section-head">
                  <div>
                    <span class="eyebrow">Dans la même catégorie</span>
                    <h2 id="similar-title">Adresses similaires</h2>
                  </div>
                  <a class="section-link" href="${explorerHash({ ...defaultFilters(), cat: cat.id })}">Tout voir ${ICONS.arrowRight}</a>
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
        <label for="${id}">${escapeHtml(field.label)}${requiredMark}</label>
        <textarea class="textarea" id="${id}" name="${escapeHtml(field.key)}" rows="4" placeholder="${escapeHtml(field.placeholder || '')}"${required}>${escapeHtml(value || '')}</textarea>
        ${hint}
      </div>`;
    }

    if (field.type === 'boolean') {
      return `<label class="checkbox-row" for="${id}">
        <input type="checkbox" id="${id}" name="${escapeHtml(field.key)}"${value ? ' checked' : ''} />
        <span><strong>${escapeHtml(field.label)}</strong>${field.valueLabels ? `<br /><span class="hint">${escapeHtml(field.valueLabels.true)} / ${escapeHtml(field.valueLabels.false)}</span>` : ''}</span>
      </label>`;
    }

    if (field.type === 'select' && field.options) {
      return `<div class="field">
        <label for="${id}">${escapeHtml(field.label)}${requiredMark}</label>
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
        <label for="${id}">${escapeHtml(field.label)}${requiredMark}${field.money ? ' <span class="hint">(FCFA)</span>' : ''}</label>
        <input class="input" id="${id}" name="${escapeHtml(field.key)}" type="number" inputmode="numeric"
          value="${escapeHtml(value ?? '')}" placeholder="${escapeHtml(field.placeholder || '')}"
          ${field.min !== undefined ? `min="${field.min}"` : ''} ${field.step !== undefined ? `step="${field.step}"` : 'step="1"'}${required} />
        ${hint}
      </div>`;
    }

    return `<div class="field">
      <label for="${id}">${escapeHtml(field.label)}${requiredMark}</label>
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
          { label: 'Accueil', href: '#/' },
          { label: 'Ajouter une adresse', href: '#/ajouter' },
        ])}
        <div class="page-head" style="padding-top:0.4rem">
          <h1 class="page-title">Ajouter une adresse</h1>
          <p class="page-sub">Faites connaître votre commerce ou une adresse utile du quartier. L’ajout est gratuit et prend moins de deux minutes.</p>
        </div>

        <div class="form-layout">
          <form class="form-card" id="add-form" novalidate>
            <section class="form-section">
              <div class="form-section-head">
                <span class="form-step">1</span>
                <div>
                  <h2>Identité de l’adresse</h2>
                  <p>Le nom, la catégorie et les spécialités de votre commerce.</p>
                </div>
              </div>

              <div class="form-grid">
                <div class="field span-2">
                  <label for="field-name">Nom de l’adresse <span class="req" aria-hidden="true">*</span></label>
                  <input class="input" id="field-name" name="name" type="text" required maxlength="80" value="${escapeHtml(draft.name)}" placeholder="Ex. Le Baobab, Pharmacie du Carrefour…" />
                  <span class="hint">Le nom tel qu’il apparaîtra dans l’annuaire.</span>
                </div>

                <div class="field span-2">
                  <label for="field-category">Catégorie principale <span class="req" aria-hidden="true">*</span></label>
                  <select class="select" id="field-category" name="category" required>
                    ${CATEGORIES.map(
                      (category) =>
                        `<option value="${category.id}"${draft.category === category.id ? ' selected' : ''}>${escapeHtml(category.label)}</option>`
                    ).join('')}
                  </select>
                </div>

                <div class="field span-2">
                  <span class="field-label">Sous-catégories <span class="hint">(facultatif, plusieurs choix possibles)</span></span>
                  <div class="subcategory-options">
                    ${cat.subcategories
                      .map(
                        (sub) => `<label class="subcat-option">
                          <input type="checkbox" name="subcategories" value="${escapeHtml(sub)}"${draft.subcategories.includes(sub) ? ' checked' : ''} />
                          <span>${escapeHtml(sub)}</span>
                        </label>`
                      )
                      .join('') || '<span class="hint">Aucune sous-catégorie pour cette catégorie.</span>'}
                  </div>
                </div>
              </div>
            </section>

            <section class="form-section">
              <div class="form-section-head">
                <span class="form-step">2</span>
                <div>
                  <h2>Localisation &amp; contact</h2>
                  <p>Pour que les habitants puissent vous trouver et vous appeler.</p>
                </div>
              </div>

              <div class="form-grid">
                <div class="field">
                  <label for="field-neighborhood">Quartier <span class="req" aria-hidden="true">*</span></label>
                  <select class="select" id="field-neighborhood" name="neighborhood" required>
                    <option value="">Choisir un quartier…</option>
                    ${NEIGHBORHOODS.map(
                      (hood) =>
                        `<option value="${escapeHtml(hood)}"${draft.neighborhood === hood ? ' selected' : ''}>${escapeHtml(hood)}</option>`
                    ).join('')}
                  </select>
                </div>

                <div class="field">
                  <label for="field-phone">Téléphone <span class="req" aria-hidden="true">*</span></label>
                  <input class="input" id="field-phone" name="phone" type="tel" required pattern="[0-9+\-. ]{8,24}" title="Au moins 8 chiffres, ex. +223 66 12 34 56" value="${escapeHtml(draft.phone)}" placeholder="+223 66 12 34 56" />
                </div>

                <div class="field span-2">
                  <label for="field-address">Adresse précise <span class="req" aria-hidden="true">*</span></label>
                  <input class="input" id="field-address" name="address" type="text" required maxlength="140" value="${escapeHtml(draft.address)}" placeholder="Rue, repère, immeuble…" />
                  <span class="hint">Rue, numéro de porte, immeuble ou indication utile.</span>
                </div>

                <div class="field span-2">
                  <label for="field-landmark">Repère <span class="hint">(facultatif)</span></label>
                  <input class="input" id="field-landmark" name="landmark" type="text" maxlength="120" value="${escapeHtml(draft.landmark || '')}" placeholder="Ex. en face de la Pharmacie du Carrefour, à côté de la mosquée…" />
                  <span class="hint">Beaucoup de rues de Bamako ne portent pas de nom : un repère connu est souvent plus utile que l’adresse.</span>
                </div>

                <div class="field span-2">
                  <div class="map-field-head">
                    <span class="field-label">Position exacte sur la carte <span class="hint">(facultatif, recommandé)</span></span>
                    <button type="button" class="btn btn-soft btn-sm" data-form-geolocate>
                      ${ICONS.crosshair} Ma position
                    </button>
                  </div>
                  <div id="add-map" class="form-map" role="application" aria-label="Carte : cliquez pour placer votre adresse"></div>
                  <p class="form-coords-hint" data-form-coords>Cliquez sur la carte (ou utilisez « Ma position ») pour placer le pin.</p>
                </div>

                <div class="field">
                  <label for="field-whatsapp">WhatsApp <span class="hint">(facultatif)</span></label>
                  <input class="input" id="field-whatsapp" name="whatsapp" type="tel" pattern="[0-9+\-. ]{8,24}" title="Numéro WhatsApp avec indicatif, ex. +223 66 12 34 56" value="${escapeHtml(draft.whatsapp)}" placeholder="+223 66 12 34 56" />
                </div>

                <div class="field">
                  <label for="field-hours">Horaires <span class="hint">(facultatif)</span></label>
                  <input class="input" id="field-hours" name="hours" type="text" maxlength="80" value="${escapeHtml(draft.hours)}" placeholder="Ex. Lun – Sam · 8h – 19h" />
                </div>

                <div class="field span-2">
                  <label for="field-description">Description <span class="hint">(facultatif)</span></label>
                  <textarea class="textarea" id="field-description" name="description" rows="4" maxlength="600" placeholder="Présentez votre commerce, vos spécialités, ce qui vous distingue…">${escapeHtml(draft.description)}</textarea>
                </div>
              </div>
            </section>

            <section class="form-section">
              <div class="form-section-head">
                <span class="form-step">3</span>
                <div>
                  <h2>${escapeHtml(cat.label)} — détails</h2>
                  <p>Ces champs s’adaptent automatiquement à la catégorie choisie.</p>
                </div>
              </div>

              <div class="form-grid" id="dynamic-fields">
                ${cat.fields.map((field) => fieldInputHtml(field, draft.fields[field.key])).join('')}
              </div>
            </section>

            <div class="form-actions">
              <a class="btn btn-ghost" href="#/explorer">Annuler</a>
              <button class="btn btn-primary" type="submit">${ICONS.plus} Publier l’adresse</button>
            </div>
            <p class="form-note">En publiant, vous confirmez que les informations sont exactes. Cet annuaire est une démonstration : les données restent dans votre navigateur.</p>
          </form>

          <aside class="form-preview">
            <div class="preview-wrap">
              <div class="preview-head">
                <h2>${ICONS.sparkles} Aperçu en direct</h2>
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

    document.title = 'Mes favoris — BamaHub';

    $('#main').innerHTML = `
      <div class="container page" style="padding-top:1.6rem;padding-bottom:2rem">
        ${breadcrumbs([
          { label: 'Accueil', href: '#/' },
          { label: 'Favoris', href: '#/favoris' },
        ])}
        <div class="favorites-head">
          <div>
            <h1 class="page-title">Mes favoris</h1>
            <p class="page-sub">${
              favorites.length
                ? `${favorites.length} adresse${favorites.length > 1 ? 's' : ''} enregistrée${favorites.length > 1 ? 's' : ''} dans ce navigateur.`
                : 'Retrouvez ici les adresses que vous gardez sous la main.'
            }</p>
          </div>
          ${favorites.length ? `<button type="button" class="btn btn-danger-soft btn-sm" data-clear-favorites>${ICONS.trash} Tout effacer</button>` : ''}
        </div>

        ${
          favorites.length
            ? listingGrid(favorites)
            : emptyState({
                title: 'Votre carnet est encore vide',
                text: 'Touchez le cœur sur une adresse pour l’enregistrer. Vos favoris restent disponibles dans ce navigateur, sans compte à créer.',
                iconMarkup: ICONS.heart,
                action: `<a class="btn btn-primary" href="#/explorer">${ICONS.search} Explorer les adresses</a>`,
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
      if (label) label.textContent = state.nearMe ? 'Autour de moi · actif' : 'Autour de moi';
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
    const label = signed ? account.name.split(' ')[0] : 'Se connecter';
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
        signed ? `Compte de ${account.name}` : 'Se connecter ou créer un compte'
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
            <a class="btn btn-primary btn-block" href="#/favoris" data-auth-close>${ICONS.heart} Mes favoris</a>
            <a class="btn btn-ghost btn-block" href="#/ajouter" data-auth-close>${ICONS.plus} Ajouter une adresse</a>
            <button type="button" class="btn btn-danger-soft btn-block" data-auth-signout>Se déconnecter</button>
          </div>
          <p class="auth-note">${ICONS.info} Compte de démonstration stocké uniquement dans ce navigateur.</p>
        </div>`;
    }

    const register = mode === 'register';
    return `
      <div class="auth-form">
        <div>
          <h2 class="auth-title" id="auth-title">${register ? 'Créer un compte' : 'Content de vous revoir'}</h2>
          <p class="auth-sub" id="auth-subtitle">
            ${register
              ? 'Enregistrez vos adresses favorites et retrouvez-les à chaque visite.'
              : 'Connectez-vous pour retrouver vos favoris et vos adresses.'}
          </p>
        </div>

        <form class="auth-form" data-auth-form="${register ? 'register' : 'login'}" novalidate>
          ${register
            ? `<div class="field">
                 <label for="auth-name">Nom complet</label>
                 <input class="input" id="auth-name" name="name" type="text" autocomplete="name" required maxlength="60" placeholder="Ex. Awa Traoré" />
               </div>`
            : ''}
          <div class="field">
            <label for="auth-email">Adresse e-mail</label>
            <input class="input" id="auth-email" name="email" type="email" autocomplete="email" required placeholder="vous@exemple.ml" />
          </div>
          <div class="field">
            <label for="auth-password">Mot de passe</label>
            <input class="input" id="auth-password" name="password" type="password"
              autocomplete="${register ? 'new-password' : 'current-password'}" required minlength="6"
              placeholder="6 caractères minimum" />
          </div>
          <p class="auth-error" data-auth-error role="alert"></p>
          <button class="btn btn-primary btn-block" type="submit">
            ${register ? 'Créer mon compte' : 'Se connecter'}
          </button>
        </form>

        ${register
          ? ''
          : `<p class="auth-switch">Pas encore de compte ?
               <button type="button" data-auth-tab="register">Créer un compte</button>
             </p>`}
        ${register
          ? `<p class="auth-switch">Déjà inscrit ?
               <button type="button" data-auth-tab="login">Se connecter</button>
             </p>`
          : `<p class="auth-switch">Compte de démonstration :
               <button type="button" data-auth-demo>remplir automatiquement</button>
             </p>`}

        <p class="auth-note">${ICONS.info} Démonstration : le compte reste dans ce navigateur, aucune donnée n'est envoyée.</p>
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
    document.body.classList.remove('auth-open');
    document.body.style.overflow = '';
    ['#main', '.site-header', '.site-footer', '.bottom-nav'].forEach((selector) => {
      $(selector)?.removeAttribute('inert');
    });

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
      const label = active ? 'Retirer des favoris' : 'Ajouter aux favoris';
      if (listing) button.setAttribute('aria-label', `${label} — ${listing.name}`);
      button.setAttribute('title', active ? 'Retirer des favoris' : 'Ajouter aux favoris');
      const labelSpan = button.querySelector('[data-fav-label]');
      if (labelSpan) labelSpan.textContent = active ? 'Enregistré' : 'Favori';
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
      showToast(`« ${listing.name} » retiré des favoris.`, {
        actionLabel: 'Annuler',
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
      showToast('Ajouté à vos favoris.', {
        actionLabel: 'Voir',
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

  function shareListing(listingId) {
    const listing = getListing(listingId);
    if (!listing) return;
    const url = `${location.origin === 'null' ? '' : location.origin}${location.pathname}#/adresse/${listingId}`;
    copyText(url).then((success) => {
      showToast(
        success
          ? 'Lien de l’adresse copié dans le presse-papiers.'
          : 'Impossible de copier le lien. Copiez l’adresse depuis la barre du navigateur.'
      );
    });
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
    bindAuthEvents();
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
