/* ==========================================================================
   BamaHub — Module « Événements & Bons plans »
   --------------------------------------------------------------------------
   Couche de données du module événementiel. Elle fonctionne dans deux modes :

   • « live »  : interroge les fonctions Netlify (/api/events, /api/chat,
                 /api/import-event, /api/submit-event, /api/report-event).
                 Ces fonctions lisent et écrivent dans Supabase ; l’IA Gemini
                 ne tourne jamais dans le navigateur et jamais à chaque visite.
   • « démo »  : si l’API n’est pas déployée (ou en file://), le module sert
                 un jeu d’événements d’exemple, répond au chat localement et
                 conserve les propositions dans localStorage. La structure des
                 objets, des filtres et des réponses est identique : brancher
                 le backend ne change aucune vue.

   Aucune dépendance. Expose `window.BamaHubEvents`.
   ========================================================================== */
(function () {
  'use strict';

  const TZ = 'Africa/Bamako';
  const DAY_MS = 86400000;
  const STORAGE = {
    local: 'bamahub:events:local',
    submissions: 'bamahub:events:submissions',
    reports: 'bamahub:events:reports',
    limits: 'bamahub:events:limits',
    device: 'bamahub:events:device',
    admin: 'bamahub:events:admin',
  };

  const LIMITS = {
    chat: { max: 25, windowMs: 3600 * 1000, label: 'questions' },
    import: { max: 5, windowMs: 3600 * 1000, label: 'imports' },
    submit: { max: 4, windowMs: DAY_MS, label: 'publications' },
    report: { max: 10, windowMs: 3600 * 1000, label: 'signalements' },
  };

  /* ------------------------------------------------------------------------
     1. Catégories
     ------------------------------------------------------------------------ */

  const CATEGORIES = [
    { id: 'concert', label: 'Concert', labelBm: 'Dɔnkili', color: '#7c3aed', icon: '<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>' },
    { id: 'festival', label: 'Festival', labelBm: 'Fɛti', color: '#ea580c', icon: '<path d="M4 21V9l8-6 8 6v12"/><path d="M9 21v-7h6v7"/><path d="M4 9h16"/>' },
    { id: 'expo', label: 'Exposition', labelBm: 'Jirali', color: '#0891b2', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>' },
    { id: 'theatre', label: 'Théâtre', labelBm: 'Teatiri', color: '#db2777', icon: '<path d="M4 4h16v6a8 8 0 0 1-16 0Z"/><path d="M8 4v6M16 4v6M2 4h2M20 4h2M8 17c1.3 1.6 2.7 2.4 4 2.4S14.7 18.6 16 17"/>' },
    { id: 'sport', label: 'Sport', labelBm: 'Sports', color: '#16a34a', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/>' },
    { id: 'marche', label: 'Marché & brocante', labelBm: 'Sugu', color: '#f59e0b', icon: '<path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/>' },
    { id: 'conference', label: 'Conférence', labelBm: 'Kunnafoni', color: '#2563eb', icon: '<path d="M12 3v18M4 7h16M4 17h16"/><circle cx="12" cy="7" r="2"/><circle cx="12" cy="17" r="2"/>' },
    { id: 'cinema', label: 'Cinéma', labelBm: 'Sinema', color: '#6366f1', icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>' },
    { id: 'atelier', label: 'Atelier', labelBm: 'Baarakɛyɔrɔ', color: '#0d9488', icon: '<path d="m14 6 4 4M3 21l4-1 11-11a2.8 2.8 0 0 0-4-4L3 16Z"/><path d="M14 6l-3-3"/>' },
    { id: 'soiree', label: 'Soirée', labelBm: 'Su fɛti', color: '#9333ea', icon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/><path d="m15 3 .9 2.1L18 6l-2.1.9L15 9l-.9-2.1L12 6l2.1-.9Z"/>' },
    { id: 'bonplan', label: 'Bon plan', labelBm: 'Sɔngɔ ɲuman', color: '#e11d48', icon: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.5"/>' },
  ];

  const categoryOf = (id) => CATEGORIES.find((cat) => cat.id === id) || CATEGORIES[0];

  /* ------------------------------------------------------------------------
     2. Dates (Bamako = UTC+0, sans heure d’été)
     ------------------------------------------------------------------------ */

  const pad = (value) => String(value).padStart(2, '0');

  /** Minuscules sans accents, pour les recherches et le chat. */
  const normalize = (value = '') =>
    String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  /** Date du jour à Bamako, sous forme { y, m, d }. */
  function bamakoToday(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const get = (type) => Number(parts.find((part) => part.type === type)?.value);
    return { y: get('year'), m: get('month'), d: get('day') };
  }

  /** Date ISO (UTC) pour un jour relatif à aujourd’hui et une heure locale. */
  function bamakoDate(offsetDays = 0, hours = 0, minutes = 0, now = new Date()) {
    const { y, m, d } = bamakoToday(now);
    return new Date(Date.UTC(y, m - 1, d + offsetDays, hours, minutes, 0, 0));
  }

  const startOfBamakoDay = (date = new Date()) => {
    const { y, m, d } = bamakoToday(date);
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  };

  const endOfBamakoDay = (date = new Date()) =>
    new Date(startOfBamakoDay(date).getTime() + DAY_MS - 1);

  /** Clé locale `AAAA-MM-JJ` (Bamako). */
  function dateKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const WEEKDAYS_BM = ['karidon', 'ntɛnɛn', 'tarata', 'araba', 'alamisa', 'juma', 'sibiri'];
  const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MONTHS_BM = ['zanwuye', 'feburuye', 'marisi', 'awirili', 'mɛ', 'zuwɛn', 'zuluye', 'uti', 'sɛtanburu', 'ɔkutɔburu', 'nowanburu', 'desanburu'];

  function bamakoWeekday(value) {
    const short = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(new Date(value));
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(short);
  }

  /** Heure locale de Bamako, ex. « 20 h » ou « 20 h 30 ». */
  function formatTime(value, lang = 'fr') {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const h = Number(parts.find((part) => part.type === 'hour')?.value);
    const min = Number(parts.find((part) => part.type === 'minute')?.value);
    if (lang === 'bm') return `${h}h${min ? ` ${min}` : ''}`;
    return `${h} h${min ? ` ${pad(min)}` : ''}`;
  }

  /** Date longue : « samedi 24 octobre » (ou avec l’année si demandé). */
  function formatDate(value, { lang = 'fr', weekday = true, year = false } = {}) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const day = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric' }).format(date));
    const month = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, month: 'numeric' }).format(date)) - 1;
    const y = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric' }).format(date));
    const wd = bamakoWeekday(date);
    const months = lang === 'bm' ? MONTHS_BM : MONTHS_FR;
    const prefix = weekday ? `${lang === 'bm' ? WEEKDAYS_BM[wd] : WEEKDAYS[wd]} ` : '';
    return `${prefix}${day} ${months[month]}${year ? ` ${y}` : ''}`;
  }

  /** « Aujourd’hui », « Demain », « samedi 24 octobre »… */
  function humanDate(value, lang = 'fr', now = new Date()) {
    const key = dateKey(value);
    if (!key) return '';
    if (key === dateKey(now)) return lang === 'bm' ? 'Bi' : 'Aujourd’hui';
    if (key === dateKey(new Date(now.getTime() + DAY_MS))) return lang === 'bm' ? 'Sini' : 'Demain';
    return formatDate(value, { lang });
  }

  const toISO = (date) => (date instanceof Date ? date.toISOString() : new Date(date).toISOString());
  const asDate = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  /* ------------------------------------------------------------------------
     3. Jeu de données d’exemple (mode démo)
     ------------------------------------------------------------------------ */

  /**
   * Les dates sont relatives au chargement : la démo reste donc toujours
   * crédible (« ce soir », « ce week-end ») même plusieurs mois après.
   * Les commerces, lieux et organisateurs sont fictifs.
   */
  function seed(now = new Date()) {
    const ev = (config) => {
      const start = bamakoDate(config.day, config.h ?? 20, config.m ?? 0, now);
      const end =
        config.endDay !== undefined
          ? bamakoDate(config.endDay, config.endH ?? 18, 0, now)
          : new Date(start.getTime() + (config.duration ?? 2) * 3600 * 1000);
      return {
        id: config.id,
        title: config.title,
        description: config.description,
        startsAt: toISO(start),
        endsAt: toISO(end),
        venue: config.venue,
        neighborhood: config.hood,
        lat: config.lat,
        lng: config.lng,
        price: config.price ?? 0,
        originalPrice: config.originalPrice ?? null,
        organizer: config.organizer,
        sourceUrl: config.source ?? '',
        category: config.category,
        reliability: config.reliability ?? 80,
        status: config.status ?? 'verified',
        sourceKind: config.sourceKind ?? 'ai',
        deal: Boolean(config.deal),
        image: '',
        createdAt: toISO(bamakoDate(config.day - 3, 9, 0, now)),
        updatedAt: toISO(now),
        contact: '',
        tags: config.tags || [],
      };
    };

    return [
      ev({
        id: 'nuit-du-kora',
        title: 'Nuit du Kora',
        description:
          'Une soirée de kora et de voix mandingues avec les maîtres de Bamako, suivie d’un bœuf ouvert aux jeunes talents. Terrasse et restauration sur place.',
        day: 0, h: 20, duration: 3,
        venue: 'Palais de la Culture Amadou Hampâté Bâ',
        hood: 'Hamdallaye', lat: 12.6421, lng: -8.0117,
        price: 5000, organizer: 'Association Kora Bamako',
        category: 'concert', reliability: 96, status: 'verified',
        source: 'https://example.org/bamako/nuit-du-kora',
        tags: ['musique', 'kora'],
      }),
      ev({
        id: 'marche-nuit-badalabougou',
        title: 'Marché de nuit de Badalabougou',
        description:
          'Artisans, brochettes, jus de bissap et petits concerts acoustiques au bord du fleuve. Entrée libre, pensez à apporter de la monnaie.',
        day: 0, h: 18, duration: 5,
        venue: 'Place du marché de Badalabougou',
        hood: 'Badalabougou', lat: 12.6261, lng: -8.0062,
        price: 0, organizer: 'Collectif Badalabougou Debout',
        category: 'marche', reliability: 92, status: 'verified',
        source: 'https://example.org/bamako/marche-nuit',
        tags: ['gratuit', 'artisanat'],
      }),
      ev({
        id: 'cine-plein-air-magnambougou',
        title: 'Ciné plein air : Le Retour du Baobab',
        description:
          'Projection en plein air d’un classique du cinéma malien, suivie d’une discussion avec l’équipe du film. Chaises limitées, apportez un coussin.',
        day: 0, h: 19, m: 30, duration: 2.5,
        venue: 'Maison des Jeunes de Magnambougou',
        hood: 'Magnambougou', lat: 12.6162, lng: -7.9515,
        price: 1000, organizer: 'Ciné Mali',
        category: 'cinema', reliability: 71, status: 'ai_suggested',
        source: 'https://example.org/bamako/cine-plein-air',
        tags: ['cinéma'],
      }),
      ev({
        id: 'bamako-jazz-session',
        title: 'Bamako Jazz Session',
        description:
          'Jam session jazz et afrobeat avec trois formations de la scène bamakoise. Entrée 3 000 FCFA, consommation offerte avant 21 h.',
        day: 0, h: 21, duration: 3,
        venue: 'Le Manguier, Quartier du fleuve',
        hood: 'Quartier du fleuve', lat: 12.6306, lng: -8.0058,
        price: 3000, organizer: 'Bamako Jazz Club',
        category: 'concert', reliability: 89, status: 'verified',
        source: 'https://example.org/bamako/jazz-session',
        tags: ['jazz', 'soirée'],
      }),
      ev({
        id: 'concert-acoustique-fleuve',
        title: 'Concert acoustique au bord du fleuve',
        description:
          'Guitare, balafon et voix : une heure de musique gratuite au coucher du soleil, avec les jeunes talents du conservatoire.',
        day: 0, h: 18, m: 30, duration: 1.5,
        venue: 'Berges du fleuve, près du pont des Martyrs',
        hood: 'Quartier du fleuve', lat: 12.6322, lng: -8.0004,
        price: 0, organizer: 'Conservatoire de Bamako',
        category: 'concert', reliability: 90, status: 'verified',
        source: 'https://example.org/bamako/concert-fleuve',
        tags: ['gratuit', 'musique'],
      }),
      ev({
        id: 'expo-bamako-couleur-terre',
        title: 'Exposition « Bamako couleur terre »',
        description:
          'Trente photographes racontent la ville : ses rues, ses marchés, ses visages. Visite guidée chaque samedi à 11 h.',
        day: 0, h: 10, endDay: 20, endH: 18,
        venue: 'Musée National du Mali',
        hood: 'Quartier du fleuve', lat: 12.6331, lng: -7.9982,
        price: 2000, organizer: 'Musée National du Mali',
        category: 'expo', reliability: 94, status: 'verified',
        source: 'https://example.org/bamako/expo-couleur-terre',
        tags: ['photo', 'exposition'],
      }),
      ev({
        id: 'salon-entrepreneuriat',
        title: 'Salon de l’entrepreneuriat jeunesse',
        description:
          'Ateliers, pitchs et rencontres avec des incubateurs de Bamako. Programme complet en ligne, inscription gratuite sur place.',
        day: 1, h: 9, duration: 8,
        venue: 'Centre de conférences de Bamako',
        hood: 'ACI 2000', lat: 12.6414, lng: -8.0165,
        price: 0, organizer: 'Bamako Innovation Hub',
        category: 'conference', reliability: 88, status: 'verified',
        source: 'https://example.org/bamako/salon-entrepreneuriat',
        tags: ['gratuit', 'business'],
      }),
      ev({
        id: 'theatre-la-dot',
        title: 'Théâtre : La dot de nos mères',
        description:
          'Une comédie satirique sur les traditions et les négociations de dot, jouée par la troupe Koteba. Débat avec le public après la pièce.',
        day: 2, h: 19, duration: 2,
        venue: 'Palais de la Culture Amadou Hampâté Bâ',
        hood: 'Hamdallaye', lat: 12.6421, lng: -8.0117,
        price: 2500, organizer: 'Troupe Koteba',
        category: 'theatre', reliability: 78, status: 'ai_suggested',
        source: 'https://example.org/bamako/theatre-dot',
        tags: ['théâtre', 'famille'],
      }),
      ev({
        id: 'bamako-run-10km',
        title: 'Bamako Run — 10 km du fleuve',
        description:
          'Course ouverte à tous le long du Niger, avec un parcours 5 km pour les familles. Dossards à retirer au Stade du 26 Mars dès 6 h.',
        day: 3, h: 7, duration: 3,
        venue: 'Stade du 26 Mars',
        hood: 'Yirimadio', lat: 12.5857, lng: -7.9448,
        price: 3000, organizer: 'Bamako Athlétisme',
        category: 'sport', reliability: 91, status: 'verified',
        source: 'https://example.org/bamako/run-10km',
        tags: ['course', 'sport'],
      }),
      ev({
        id: 'atelier-cuisine-bamanan',
        title: 'Atelier cuisine bamanan',
        description:
          'Apprenez à préparer un tô, un riz au gras et un bissap maison avec la cheffe Aminata. Places limitées à 12 personnes, inscription obligatoire.',
        day: 3, h: 16, duration: 3,
        venue: 'Atelier Saveurs de Hamdallaye',
        hood: 'Hamdallaye', lat: 12.6377, lng: -8.0122,
        price: 7500, organizer: 'Saveurs de Bamako',
        category: 'atelier', reliability: 90, status: 'verified',
        source: 'https://example.org/bamako/atelier-cuisine',
        tags: ['cuisine', 'atelier'],
      }),
      ev({
        id: 'kine-festival-enfants',
        title: 'Kiné-Festival des enfants',
        description:
          'Spectacles, ateliers de dessin, contes et jeux d’eau pour les 3–12 ans. Entrée libre, goûter offert jusqu’à 16 h.',
        day: 5, h: 10, duration: 8,
        venue: 'Place du Cinquantenaire',
        hood: 'Quartier du fleuve', lat: 12.6348, lng: -8.0031,
        price: 0, organizer: 'Kiné Collectif',
        category: 'festival', reliability: 93, status: 'verified',
        source: 'https://example.org/bamako/kine-festival',
        tags: ['gratuit', 'enfants'],
      }),
      ev({
        id: 'soiree-afrobeat-aci',
        title: 'Soirée afrobeat ACI',
        description:
          'DJ sets afrobeat, amapiano et coupé-décalé jusqu’au bout de la nuit. Préventes en ligne, vestiaire sur place.',
        day: 5, h: 22, duration: 4,
        venue: 'Rooftop ACI 2000',
        hood: 'ACI 2000', lat: 12.6398, lng: -8.0221,
        price: 5000, organizer: 'ACI Nights',
        category: 'soiree', reliability: 66, status: 'ai_suggested',
        source: 'https://example.org/bamako/afrobeat-aci',
        tags: ['soirée', 'danse'],
      }),
      ev({
        id: 'festival-wassa-wassa',
        title: 'Festival Wassa Wassa',
        description:
          'Deux jours de danses traditionnelles, de percussions et de mode au bord du fleuve. Pass journée ou week-end.',
        day: 6, h: 17, duration: 6,
        venue: 'Berges du fleuve, Badalabougou',
        hood: 'Badalabougou', lat: 12.6239, lng: -8.0012,
        price: 2000, organizer: 'Wassa Wassa Association',
        category: 'festival', reliability: 74, status: 'ai_suggested',
        source: 'https://example.org/bamako/wassa-wassa',
        tags: ['danse', 'musique'],
      }),
      ev({
        id: 'brocante-kalaban',
        title: 'Brocante de Kalaban',
        description:
          'Livres, vinyles, tissus et objets de maison à petits prix. Buvette et espace enfants sur place.',
        day: 6, h: 9, duration: 5,
        venue: 'École Les Étoiles, Kalaban Coura',
        hood: 'Kalaban Coura', lat: 12.6106, lng: -7.9819,
        price: 0, organizer: 'Parents d’élèves Kalaban',
        category: 'marche', reliability: 87, status: 'verified',
        source: 'https://example.org/bamako/brocante-kalaban',
        tags: ['gratuit', 'brocante'],
      }),
      ev({
        id: 'conference-climat-sahel',
        title: 'Conférence climat & Sahel',
        description:
          'Chercheurs, agriculteurs et ONG discutent de l’eau, des semences et de l’adaptation au changement climatique. Entrée libre sur inscription.',
        day: 9, h: 9, duration: 4,
        venue: 'Musée National du Mali',
        hood: 'Quartier du fleuve', lat: 12.6331, lng: -7.9982,
        price: 0, organizer: 'Institut Sahel Durable',
        category: 'conference', reliability: 90, status: 'verified',
        source: 'https://example.org/bamako/conference-climat',
        tags: ['gratuit', 'climat'],
      }),
      ev({
        id: 'numérique-jeunesse',
        title: 'Tribune : la jeunesse et le numérique',
        description:
          'Débat ouvert sur les métiers du numérique, les formations et le financement des jeunes entreprises. Inscription conseillée.',
        day: 12, h: 15, duration: 3,
        venue: 'Maison des Jeunes de Bamako',
        hood: 'Hamdallaye', lat: 12.6408, lng: -8.0086,
        price: 0, organizer: 'Bamako Digital',
        category: 'conference', reliability: 64, status: 'ai_suggested',
        source: 'https://example.org/bamako/tribune-numerique',
        tags: ['numérique', 'jeunesse'],
      }),
      ev({
        id: 'bonplan-baobab',
        title: '-30 % au restaurant Le Baobab',
        description:
          'Sur presentation du QR code BamaHub, -30 % sur le menu du jour jusqu’à 15 h. Hors boissons, du lundi au vendredi.',
        day: 0, h: 11, duration: 4,
        venue: 'Le Baobab, Hamdallaye ACI 2000',
        hood: 'Hamdallaye', lat: 12.6394, lng: -8.0135,
        price: 1750, originalPrice: 2500, deal: true,
        organizer: 'Le Baobab', category: 'bonplan', reliability: 95, status: 'verified',
        source: 'https://example.org/bamako/bonplan-baobab',
        tags: ['restaurant', 'promo'],
      }),
      ev({
        id: 'bonplan-cine-mali',
        title: '2 places pour 1 au Ciné Mali',
        description:
          'Deux entrées pour le prix d’une le samedi après-midi. Valable sur toutes les séances de 14 h et 16 h, retrait au guichet.',
        day: 5, h: 14, duration: 3,
        venue: 'Ciné Mali, Quartier du fleuve',
        hood: 'Quartier du fleuve', lat: 12.6311, lng: -8.0044,
        price: 3500, originalPrice: 7000, deal: true,
        organizer: 'Ciné Mali', category: 'bonplan', reliability: 70, status: 'ai_suggested',
        source: 'https://example.org/bamako/bonplan-cinema',
        tags: ['cinéma', 'promo'],
      }),
      ev({
        id: 'bonplan-grillade',
        title: 'Brochettes + boisson à 2 500 FCFA',
        description:
          'Formule brochettes et boisson au Faso Grill tous les soirs de 18 h à 21 h. Mentionnez le code BAMAHUB.',
        day: 1, h: 18, duration: 3,
        venue: 'Faso Grill, ACI 2000',
        hood: 'ACI 2000', lat: 12.6372, lng: -8.0205,
        price: 2500, originalPrice: 3500, deal: true,
        organizer: 'Faso Grill', category: 'bonplan', reliability: 84, status: 'verified',
        source: 'https://example.org/bamako/bonplan-faso',
        tags: ['grillades', 'promo'],
      }),
      ev({
        id: 'concert-des-mamans',
        title: 'Concert des mamans',
        description:
          'Chorales de femmes de Bamako et invitées de Ségou pour une soirée de chants et de percussions.',
        day: 19, h: 19, duration: 2.5,
        venue: 'Palais de la Culture Amadou Hampâté Bâ',
        hood: 'Hamdallaye', lat: 12.6421, lng: -8.0117,
        price: 2000, organizer: 'Chorales du District',
        category: 'concert', reliability: 92, status: 'verified',
        source: 'https://example.org/bamako/concert-mamans',
        tags: ['chorale'],
      }),
      ev({
        id: 'marche-artisanal-niamakoro',
        title: 'Marché artisanal de Niamakoro',
        description:
          'Bronze, bogolan, vannerie et bijoux : rencontre directe avec les artisans de Niamakoro.',
        day: 20, h: 9, duration: 6,
        venue: 'Place centrale de Niamakoro',
        hood: 'Niamakoro', lat: 12.5934, lng: -8.0051,
        price: 0, organizer: 'Fédération des artisans',
        category: 'marche', reliability: 72, status: 'ai_suggested',
        source: 'https://example.org/bamako/marche-niamakoro',
        tags: ['gratuit', 'artisanat'],
      }),
      ev({
        id: 'nuit-du-conte',
        title: 'Nuit du conte',
        description:
          'Contes bamanan racontés à la lueur des lampes, ateliers de slam et restitution des enfants des ateliers. Entrée libre.',
        day: 26, h: 18, duration: 3,
        venue: 'Maison des Jeunes de Bamako',
        hood: 'Hamdallaye', lat: 12.6408, lng: -8.0086,
        price: 0, organizer: 'Griot Express',
        category: 'theatre', reliability: 89, status: 'verified',
        source: 'https://example.org/bamako/nuit-conte',
        tags: ['gratuit', 'conte'],
      }),
      // Deux événements passés : la purge doit les retirer automatiquement.
      ev({
        id: 'passe-festival-segou',
        title: 'Soirée du festival de Ségou (passée)',
        description: 'Événement de contrôle : il ne doit jamais apparaître dans la liste.',
        day: -2, h: 20, duration: 2,
        venue: 'Palais de la Culture', hood: 'Hamdallaye', lat: 12.6421, lng: -8.0117,
        price: 0, organizer: 'Contrôle', category: 'festival', reliability: 90, status: 'verified',
      }),
      ev({
        id: 'passe-brocante-aci',
        title: 'Brocante ACI (passée)',
        description: 'Événement de contrôle : la purge doit le supprimer.',
        day: -9, h: 9, duration: 6,
        venue: 'ACI 2000', hood: 'ACI 2000', lat: 12.6414, lng: -8.0165,
        price: 0, organizer: 'Contrôle', category: 'marche', reliability: 80, status: 'ai_suggested',
      }),
    ];
  }

  /* ------------------------------------------------------------------------
     4. Stockage local et état
     ------------------------------------------------------------------------ */

  function readJSON(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      const value = JSON.parse(raw);
      return value ?? fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function deviceId() {
    let id = readJSON(STORAGE.device, '');
    if (!id) {
      id = `dev-${Math.random().toString(36).slice(2, 10)}`;
      writeJSON(STORAGE.device, id);
    }
    return id;
  }

  const sameId = (a, b) => String(a) === String(b);

  /** Une URL n’est acceptée que si elle utilise http(s) : jamais de `javascript:`. */
  const safeHttpUrl = (value) => {
    const text = String(value || '').trim();
    return /^https?:\/\//i.test(text) ? text : '';
  };

  const isCoordinate = (value) =>
    value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

  /** Normalise un événement venu de l’API ou du formulaire. */
  function normalizeEvent(raw = {}) {
    const start = asDate(raw.startsAt || raw.starts_at || raw.start);
    const end = asDate(raw.endsAt || raw.ends_at || raw.end) || (start ? new Date(start.getTime() + 2 * 3600 * 1000) : null);
    if (!start || !end) return null;
    const category = CATEGORIES.some((cat) => cat.id === raw.category) ? raw.category : 'bonplan';
    // Les lignes renvoyées par l’API sont en snake_case (`price_fcfa`).
    const rawPrice = raw.price ?? raw.price_fcfa ?? raw.priceFcfa;
    const price = Number.isFinite(Number(rawPrice)) ? Math.max(0, Math.round(Number(rawPrice))) : 0;
    const reliability = Math.max(0, Math.min(100, Math.round(Number(raw.reliability) || 0)));
    const status = raw.status === 'verified' ? 'verified' : raw.status === 'pending' ? 'pending' : 'ai_suggested';
    return {
      id: String(raw.id || '').trim(),
      title: String(raw.title || '').trim().slice(0, 140),
      description: String(raw.description || '').trim().slice(0, 1200),
      startsAt: toISO(start),
      endsAt: toISO(end),
      venue: String(raw.venue || '').trim().slice(0, 160),
      neighborhood: String(raw.neighborhood || '').trim().slice(0, 80),
      lat: isCoordinate(raw.lat) ? Number(raw.lat) : null,
      lng: isCoordinate(raw.lng) ? Number(raw.lng) : null,
      price,
      originalPrice:
        Number.isFinite(Number(raw.originalPrice ?? raw.original_price_fcfa)) && Number(raw.originalPrice ?? raw.original_price_fcfa) > 0
          ? Number(raw.originalPrice ?? raw.original_price_fcfa)
          : null,
      organizer: String(raw.organizer || '').trim().slice(0, 120),
      sourceUrl: safeHttpUrl(raw.sourceUrl || raw.source_url).slice(0, 500),
      category,
      reliability,
      status,
      sourceKind: ['ai', 'poster', 'organizer', 'seed'].includes(raw.sourceKind || raw.source_kind)
        ? raw.sourceKind || raw.source_kind
        : 'ai',
      deal: Boolean(raw.deal) || category === 'bonplan',
      image: safeHttpUrl(raw.image || raw.image_url).slice(0, 500),
      createdAt: raw.createdAt || raw.created_at || toISO(new Date()),
      updatedAt: raw.updatedAt || raw.updated_at || toISO(new Date()),
      contact: String(raw.contact || '').trim().slice(0, 160),
      tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 8).map((tag) => String(tag).slice(0, 30)) : [],
    };
  }

  const state = {
    mode: 'demo', // demo | live
    ready: false,
    events: [],
    local: [],
    submissions: [],
    reports: [],
    draft: null,
    lastSync: null,
    error: '',
    apiBase: '/api',
    sessionId: '',
  };

  function loadLocal() {
    const local = readJSON(STORAGE.local, []);
    state.local = Array.isArray(local) ? local.map(normalizeEvent).filter(Boolean) : [];
    const submissions = readJSON(STORAGE.submissions, []);
    state.submissions = Array.isArray(submissions) ? submissions.filter((item) => item && item.payload) : [];
    const reports = readJSON(STORAGE.reports, []);
    state.reports = Array.isArray(reports) ? reports : [];
    state.sessionId = deviceId();
  }

  const isPast = (event, now = new Date()) => asDate(event.endsAt)?.getTime() < now.getTime() - 6 * 3600 * 1000;

  /** Purge : les événements terminés ne sont jamais servis. */
  function purge(list, now = new Date()) {
    return list.filter((event) => event && !isPast(event, now) && asDate(event.startsAt));
  }

  /** Tous les événements visibles (les validations locales priment). */
  function allEvents() {
    const merged = new Map();
    state.events.forEach((event) => merged.set(event.id, event));
    state.local.forEach((event) => merged.set(event.id, event));
    return [...merged.values()];
  }

  /* ------------------------------------------------------------------------
     5. Accès API (facultatif) et initialisation
     ------------------------------------------------------------------------ */

  const configured = () =>
    typeof window.fetch === 'function' && /^https?:$/.test(window.location.protocol);

  function apiUrl(path) {
    return `${state.apiBase}${path}`;
  }

  async function request(path, options = {}, timeout = 8000) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
    try {
      const response = await fetch(apiUrl(path), {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
        signal: controller?.signal,
      });
      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (error) {
        data = null;
      }
      if (!response.ok) {
        const error = new Error(data?.message || `HTTP ${response.status}`);
        error.status = response.status;
        error.code = data?.error || 'http_error';
        error.retryAfter = Number(response.headers.get('Retry-After') || data?.retryAfter || 0);
        error.payload = data;
        throw error;
      }
      return data;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function adoptRemote(list) {
    const events = (Array.isArray(list) ? list : []).map(normalizeEvent).filter(Boolean);
    if (!events.length) return false;
    state.events = events;
    state.mode = 'live';
    return true;
  }

  /**
   * Initialise le module. La démo est disponible immédiatement (rendu
   * synchrone) ; si l’API répond, elle remplace les données sans bloquer.
   */
  async function init(options = {}) {
    loadLocal();
    if (options.apiBase) state.apiBase = options.apiBase;
    state.events = seed();
    state.ready = true;

    if (!configured() || options.demoOnly) {
      state.mode = 'demo';
      state.lastSync = toISO(new Date());
      return getState();
    }

    try {
      const data = await request('/events?limit=60&probe=1', { method: 'GET' }, 6000);
      if (adoptRemote(data?.events)) {
        state.lastSync = data.generatedAt || toISO(new Date());
      } else if (data && data.ok !== false) {
        // Backend joignable mais base encore vide : on reste en live, sans
        // afficher les données d’exemple comme si elles venaient du serveur.
        state.events = [];
        state.mode = 'live';
        state.lastSync = data.generatedAt || toISO(new Date());
      }
    } catch (error) {
      // API absente ou non configurée : on reste en démo, sans bruit console.
      state.mode = 'demo';
      state.error = error?.status === 503 ? 'not_configured' : 'offline';
    }
    state.lastSync = state.lastSync || toISO(new Date());
    dispatchReady();
    return getState();
  }

  function dispatchReady() {
    try {
      window.dispatchEvent(new CustomEvent('bamahub:events-ready', { detail: getState() }));
    } catch (error) {
      /* CustomEvent indisponible : sans conséquence. */
    }
  }

  /* ------------------------------------------------------------------------
     6. Filtres et intentions
     ------------------------------------------------------------------------ */

  function nextWeekend(now = new Date()) {
    const day = bamakoWeekday(now); // 0 = dimanche
    const toSaturday = (6 - day + 7) % 7;
    const saturday = startOfBamakoDay(new Date(now.getTime() + (toSaturday || 0) * DAY_MS));
    // Si l’on est dimanche, le week-end a commencé la veille.
    const start = day === 0 ? startOfBamakoDay(new Date(now.getTime() - DAY_MS)) : saturday;
    return { from: start, to: new Date(start.getTime() + 2 * DAY_MS - 1) };
  }

  function rangeBounds(range, now = new Date()) {
    const todayStart = startOfBamakoDay(now);
    switch (range) {
      case 'today':
        return { from: todayStart, to: endOfBamakoDay(now) };
      case 'tomorrow':
        return { from: new Date(todayStart.getTime() + DAY_MS), to: new Date(todayStart.getTime() + 2 * DAY_MS - 1) };
      case 'tonight': {
        const today17 = new Date(todayStart.getTime() + 17 * 3600 * 1000);
        return { from: new Date(Math.max(today17.getTime(), now.getTime() - 2 * 3600 * 1000)), to: endOfBamakoDay(now) };
      }
      case 'weekend':
        return nextWeekend(now);
      case 'week':
        return { from: todayStart, to: new Date(todayStart.getTime() + 7 * DAY_MS - 1) };
      case 'month':
        return { from: todayStart, to: new Date(todayStart.getTime() + 31 * DAY_MS - 1) };
      default:
        return { from: todayStart, to: new Date(todayStart.getTime() + 120 * DAY_MS) };
    }
  }

  function matchesIntent(event, intent = {}) {
    const start = asDate(event.startsAt);
    if (!start) return false;
    const bounds = intent.bounds || (intent.range ? rangeBounds(intent.range) : null);
    if (bounds && (start < bounds.from || start > bounds.to)) return false;
    if (intent.free && event.price > 0) return false;
    if (intent.deal && !event.deal) return false;
    if (intent.categories?.length && !intent.categories.includes(event.category)) return false;
    if (intent.neighborhood && event.neighborhood !== intent.neighborhood) return false;
    if (intent.maxPrice && event.price > intent.maxPrice) return false;
    if (intent.q) {
      const needle = normalize(intent.q);
      const haystack = normalize(
        [event.title, event.description, event.venue, event.neighborhood, event.organizer, event.category, ...(event.tags || [])].join(' ')
      );
      if (!needle.split(/\s+/).every((token) => haystack.includes(token))) return false;
    }
    return true;
  }

  /** Applique une intention déjà analysée à tous les événements. */
  function query(intent = {}, now = new Date()) {
    return purge(allEvents(), now)
      .filter((event) => matchesIntent(event, intent))
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  }

  function list(filters = {}) {
    const now = filters.now ? new Date(filters.now) : new Date();
    const intent = {
      range: filters.bounds || filters.day ? '' : filters.range || '',
      free: Boolean(filters.free),
      deal: Boolean(filters.deal),
      categories: filters.categories || (filters.category ? [filters.category] : []),
      neighborhood: filters.neighborhood || '',
      maxPrice: Number(filters.maxPrice) || 0,
      q: filters.q || '',
    };
    if (filters.bounds) {
      intent.bounds = filters.bounds;
    } else if (filters.day) {
      const day = new Date(`${filters.day}T00:00:00.000Z`);
      intent.bounds = { from: day, to: new Date(day.getTime() + DAY_MS - 1) };
    }
    return query(intent, now);
  }

  function get(id) {
    return allEvents()
      .map(normalizeEvent)
      .filter(Boolean)
      .find((event) => sameId(event.id, id)) || null;
  }

  /** Produit le libellé de dates utilisé par les cartes et le chat. */
  function dateLabel(event, lang = 'fr') {
    const start = asDate(event.startsAt);
    const end = asDate(event.endsAt);
    if (!start) return '';
    const day = humanDate(start, lang);
    const time = formatTime(start, lang);
    if (!end) return `${day} · ${time}`;
    const sameDay = dateKey(start) === dateKey(end);
    if (sameDay) return `${day} · ${time} – ${formatTime(end, lang)}`;
    return `${day} · ${time} → ${humanDate(end, lang)}`;
  }

  const priceLabel = (event, lang = 'fr') => {
    if (event.price === 0) return lang === 'bm' ? 'Fu' : 'Gratuit';
    const value = new Intl.NumberFormat('fr-FR').format(event.price);
    return `${value} FCFA`;
  };

  const reliabilityTier = (value) => (value >= 85 ? 'high' : value >= 70 ? 'mid' : 'low');

  /* ------------------------------------------------------------------------
     7. Analyse des questions du chat
     ------------------------------------------------------------------------ */

  const CATEGORY_KEYWORDS = {
    concert: ['concert', 'musique', 'kora', 'jazz', 'dɔnkili'],
    festival: ['festival', 'fête', 'fɛti'],
    expo: ['expo', 'exposition', 'musée', 'photo', 'jirali'],
    theatre: ['théâtre', 'theatre', 'conte', 'pièce', 'spectacle'],
    sport: ['sport', 'course', 'football', 'match', 'running'],
    marche: ['marché', 'marche', 'brocante', 'artisan', 'sugu'],
    conference: ['conférence', 'conference', 'débat', 'salon', 'atelier de discussion', 'kunnafoni'],
    cinema: ['cinéma', 'cinema', 'film', 'projection', 'sinema'],
    atelier: ['atelier', 'cours', 'cuisine', 'apprendre'],
    soiree: ['soirée', 'soiree', 'danser', 'danse', 'dj', 'boîte', 'club'],
    bonplan: ['bon plan', 'promo', 'réduction', 'reduction', 'pas cher', 'petit budget', 'coupon'],
  };

  const HOODS = ['Hamdallaye', 'ACI 2000', 'Badalabougou', 'Kalaban Coura', 'Magnambougou', 'Quartier du fleuve', 'Sotuba', 'Djicoroni', 'Niamakoro', 'Yirimadio', 'Sabalibougou', 'Lafiabougou', 'Banankabougou'];

  const WEEKDAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  /** Extrait une intention depuis une question libre (FR, avec mots BM). */
  function parseIntent(question = '', now = new Date()) {
    const text = normalize(question);
    const intent = { range: '', free: false, deal: false, categories: [], neighborhood: '', q: '', maxPrice: 0, bounds: null };

    if (/\bce soir\b|\bce soir a bamako\b|\bce soir\b|tonight|\bbi su\b/.test(text)) {
      intent.range = 'tonight';
    } else if (/\baujourd'?hui\b|\bce matin\b|\bcet apres-midi\b|\bbi\b/.test(text)) {
      intent.range = 'today';
    } else if (/\bdemain\b|\bsini\b/.test(text)) {
      intent.range = 'tomorrow';
    } else if (/week-?end/.test(text)) {
      intent.range = 'weekend';
    } else if (/\b(cette semaine|prochaine semaine|semaine)\b/.test(text)) {
      intent.range = 'week';
    } else {
      const weekdays = WEEKDAY_NAMES.map((name, index) => ({
        index,
        name,
        match: new RegExp(`\\b${name}\\b`).test(text) || new RegExp(`\\b${name.replace('é', 'e')}\\b`).test(text),
      })).filter((entry) => entry.match);
      if (weekdays.length) {
        let target = weekdays[0].index;
        const today = bamakoWeekday(now);
        let delta = (target - today + 7) % 7;
        if (delta === 0) delta = 7; // « samedi » un samedi = samedi prochain
        const day = new Date(startOfBamakoDay(now).getTime() + delta * DAY_MS);
        intent.range = 'day';
        intent.bounds = { from: day, to: new Date(day.getTime() + DAY_MS - 1) };
      }
    }

    if (/\bgratuit|\bfree\b|\bfu\b|\bsans payer\b/.test(text)) intent.free = true;
    if (/bon plan|promo|reduction|remise|pas cher|petit budget|moins de/.test(text)) {
      intent.deal = true;
      intent.categories.push('bonplan');
    }

    Object.entries(CATEGORY_KEYWORDS).forEach(([category, words]) => {
      if (words.some((word) => text.includes(normalize(word))) && !intent.categories.includes(category)) {
        intent.categories.push(category);
      }
    });

    HOODS.forEach((hood) => {
      if (text.includes(normalize(hood))) intent.neighborhood = hood;
    });

    const maxPrice = text.match(/(?:moins de|max(?:imum)?|sous)\s*(\d[\d\s.]{2,})\s*(?:fcfa|f cfa|francs?)?/);
    if (maxPrice) intent.maxPrice = Number(maxPrice[1].replace(/[\s.]/g, '')) || 0;

    // Reste de la question, une fois les mots-clés retirés, pour la recherche libre.
    const stop = new Set(
      ('que faire quoi ou aller voir sortir sortie ce soir aujourd hui demain week end cette semaine prochaine samedi dimanche lundi mardi mercredi jeudi vendredi gratuit bon plan promo pas cher bamako pour les des du de la le un une et a en avec il y a des evenements evenement events event' +
        ' concert expo exposition musee film cinema theatre sport marche conference atelier soiree festival bonplan question s il vous plait stp').split(/\s+/)
    );
    const words = text
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stop.has(word));
    if (words.length) intent.q = words.slice(0, 4).join(' ');

    return intent;
  }

  function intentLabel(intent, lang = 'fr') {
    if (intent.bounds && intent.range === 'day') {
      return formatDate(intent.bounds.from, { lang });
    }
    const labels = {
      tonight: { fr: 'ce soir', bm: 'bi su' },
      today: { fr: 'aujourd’hui', bm: 'bi' },
      tomorrow: { fr: 'demain', bm: 'sini' },
      weekend: { fr: 'ce week-end', bm: 'nin dɔgɔkun' },
      week: { fr: 'cette semaine', bm: 'nin dɔgɔkun' },
      month: { fr: 'ce mois', bm: 'nin kalo' },
    };
    return labels[intent.range]?.[lang] || (lang === 'bm' ? 'sisan' : 'bientôt');
  }

  /** Réponse locale (mode démo ou repli hors-ligne). */
  function answerLocally(question, lang = 'fr', now = new Date()) {
    const intent = parseIntent(question, now);
    const events = query(
      {
        ...intent,
        categories: intent.categories.filter((category) => category !== 'bonplan'),
      },
      now
    )
      .slice(0, 6);

    const when = intentLabel(intent, lang);
    const extras = [
      intent.free ? (lang === 'bm' ? 'fu' : 'gratuits') : '',
      intent.deal ? (lang === 'bm' ? 'sɔngɔ ɲumanw' : 'bons plans') : '',
      intent.neighborhood || '',
    ].filter(Boolean);

    let answer;
    if (!events.length) {
      answer =
        lang === 'bm'
          ? `N ma fɛn sɔrɔ ${when}${extras.length ? ` (${extras.join(', ')})` : ''}. I bɛ se ka ɲini cogoya wɛrɛ la : « iwɛnɛw », « fɛtiw » walima « fu »`
          : `Je n’ai rien trouvé ${when}${extras.length ? ` (${extras.join(', ')})` : ''}. Essayez une autre date, « gratuit », « concert » ou « ce week-end ».`;
    } else {
      const names = events.map((event) => `${event.title} (${humanDate(event.startsAt, lang)})`).join(' ; ');
      answer =
        lang === 'bm'
          ? `A bɛ yen ${events.length} ko ${when} Bamako : ${names}. I bɛ se ka karti kan digi walasa ka kunnafoniw sɔrɔ.`
          : `J’ai ${events.length} idée${events.length > 1 ? 's' : ''} ${when} à Bamako : ${names}. Ouvrez une carte pour les détails, l’itinéraire ou l’ajout à votre agenda.`;
      if (intent.free) answer += lang === 'bm' ? ' Bɛɛ fu.' : ' Toutes les propositions sont gratuites.';
      if (intent.deal) answer += lang === 'bm' ? ' Sɔngɔ ɲumanw bɛ kɔnɔ.' : ' Les bons plans sont signalés par un badge.';
    }

    return {
      ok: true,
      answer,
      events,
      intent,
      mode: state.mode,
      source: 'base',
    };
  }

  /* ------------------------------------------------------------------------
     8. Limitation de débit (côté client, en complément du serveur)
     ------------------------------------------------------------------------ */

  function limitState(kind, now = Date.now()) {
    const config = LIMITS[kind] || LIMITS.chat;
    const all = readJSON(STORAGE.limits, {});
    const stamps = Array.isArray(all[kind]) ? all[kind].filter((stamp) => now - stamp < config.windowMs) : [];
    const remaining = Math.max(0, config.max - stamps.length);
    const retryAfter = stamps.length >= config.max ? Math.ceil((config.windowMs - (now - stamps[0])) / 1000) : 0;
    return { config, stamps, remaining, retryAfter, allowed: remaining > 0 };
  }

  function consumeLimit(kind, now = Date.now()) {
    const info = limitState(kind, now);
    if (!info.allowed) {
      return { ok: false, remaining: 0, retryAfter: Math.max(1, info.retryAfter), max: info.config.max };
    }
    const all = readJSON(STORAGE.limits, {});
    all[kind] = [...info.stamps, now];
    writeJSON(STORAGE.limits, all);
    return { ok: true, remaining: info.remaining - 1, max: info.config.max, retryAfter: 0 };
  }

  const retryLabel = (seconds) => {
    if (seconds >= 3600) return `${Math.ceil(seconds / 3600)} h`;
    if (seconds >= 60) return `${Math.ceil(seconds / 60)} min`;
    return `${Math.max(1, Math.ceil(seconds))} s`;
  };

  const rateLimitError = (kind, retryAfter, lang = 'fr') => {
    const config = LIMITS[kind] || LIMITS.chat;
    return {
      code: 'rate_limited',
      retryAfter,
      remaining: 0,
      message:
        lang === 'bm'
          ? `I ka ${config.max} ${config.label} baara bi. I ka kunnafoni ${retryLabel(retryAfter)}.`
          : `Limite atteinte : ${config.max} ${config.label} par heure. Réessayez dans ${retryLabel(retryAfter)}.`,
    };
  };

  /* ------------------------------------------------------------------------
     9. Chat
     ------------------------------------------------------------------------ */

  async function chat(question, { lang = 'fr', now = new Date() } = {}) {
    const clean = String(question || '').trim().slice(0, 400);
    if (!clean) {
      return { ok: false, error: { code: 'empty', message: lang === 'bm' ? 'I ka ɲininkali sɛbɛn.' : 'Posez une question pour commencer.' } };
    }

    const quota = consumeLimit('chat');
    if (!quota.ok) {
      return { ok: false, error: rateLimitError('chat', quota.retryAfter, lang), remaining: 0 };
    }

    if (state.mode === 'live') {
      try {
        const data = await request('/chat', {
          method: 'POST',
          body: JSON.stringify({
            question: clean,
            lang,
            sessionId: state.sessionId,
            clientTime: toISO(now),
          }),
        });
        if (data?.ok === false) {
          return { ok: false, error: data.error || { code: 'error', message: tFallback('error', lang) }, remaining: data.remaining ?? quota.remaining };
        }
        return {
          ok: true,
          answer: String(data?.answer || ''),
          events: (data?.events || []).map(normalizeEvent).filter(Boolean),
          intent: data?.intent || parseIntent(clean, now),
          mode: 'live',
          source: 'base',
          remaining: Number.isFinite(data?.remaining) ? data.remaining : quota.remaining,
          degraded: Boolean(data?.degraded),
        };
      } catch (error) {
        if (error.status === 429) {
          return { ok: false, error: rateLimitError('chat', error.retryAfter || 300, lang), remaining: 0 };
        }
        // Repli local : le chat continue de répondre depuis la base embarquée.
        const local = answerLocally(clean, lang, now);
        return { ...local, remaining: quota.remaining, degraded: true, notice: 'mode-demo' };
      }
    }

    return { ...answerLocally(clean, lang, now), remaining: quota.remaining };
  }

  const tFallback = (kind, lang) => {
    if (kind === 'error') {
      return lang === 'bm' ? 'Fili dɔ kɛra. I ka a kɛ kokura.' : 'Une erreur est survenue. Réessayez dans un instant.';
    }
    return lang === 'bm' ? 'A man se.' : 'Action impossible.';
  };

  /* ------------------------------------------------------------------------
     10. Import d’affiche (Gemini côté serveur, heuristique en démo)
     ------------------------------------------------------------------------ */

  const MONTH_LOOKUP = MONTHS_FR.map((month) => normalize(month));

  /**
   * Extraction locale depuis le texte d’une affiche collée. Volontairement
   * simple et transparente : elle sert de repli quand Gemini n’est pas
   * configuré et ne prétend pas remplacer le modèle.
   */
  function heuristicDraft({ text = '', link = '', imageName = '' } = {}, now = new Date()) {
    const raw = String(text || '').slice(0, 4000);
    const lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const flat = raw.replace(/\s+/g, ' ');

    let title = lines[0] || '';
    title = title.replace(/^(affiche|flyer|événement|evenement)\s*[:\-–]\s*/i, '').trim();
    if (!title && link) {
      const slug = link.split('?')[0].split('/').filter(Boolean).pop() || '';
      title = slug
        .replace(/\.(html?|php)$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
        .slice(0, 90);
    }
    if (!title && imageName) {
      title = imageName
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
        .slice(0, 90);
    }

    // Date : 24/10/2026, 24-10, « samedi 24 octobre ».
    let day = null;
    const numeric = flat.match(/(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?/);
    if (numeric) {
      const dd = Number(numeric[1]);
      const mm = Number(numeric[2]);
      let yy = numeric[3] ? Number(numeric[3]) : bamakoToday(now).y;
      if (yy < 100) yy += 2000;
      if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) day = new Date(Date.UTC(yy, mm - 1, dd, 0, 0, 0));
    }
    if (!day) {
      const named = flat.match(/(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)/i);
      if (named) {
        const month = MONTH_LOOKUP.indexOf(normalize(named[2]));
        if (month >= 0) {
          let yy = bamakoToday(now).y;
          const candidate = new Date(Date.UTC(yy, month, Number(named[1]), 0, 0, 0));
          if (candidate.getTime() < now.getTime() - DAY_MS) candidate.setUTCFullYear(yy + 1);
          day = candidate;
        }
      }
    }
    if (!day) day = startOfBamakoDay(now);

    const time = flat.match(/(\d{1,2})\s*[h:]\s*(\d{0,2})/);
    const hours = time ? Math.min(23, Number(time[1])) : 19;
    const minutes = time && time[2] ? Math.min(59, Number(time[2])) : 0;
    const start = new Date(day.getTime() + hours * 3600 * 1000 + minutes * 60 * 1000);

    // Prix : « 5 000 FCFA », « 5.000 F », « gratuit ».
    let price = 0;
    const priceMatch = flat.match(/(\d[\d\s.]{2,})\s*(?:fcfa|f\s*cfa|francs?|f)\b/i);
    if (priceMatch) price = Number(priceMatch[1].replace(/[\s.]/g, '')) || 0;
    if (/gratuit|entrée libre|entree libre|free/i.test(flat)) price = 0;
    if (!Number.isFinite(price) || price > 5000000) price = 0;

    let category = 'concert';
    Object.entries(CATEGORY_KEYWORDS).forEach(([id, words]) => {
      if (words.some((word) => normalize(flat).includes(normalize(word)))) category = id;
    });
    if (price === 0 && category === 'bonplan') category = 'marche';

    const hood = HOODS.find((name) => normalize(flat).includes(normalize(name))) || '';
    const venueLine =
      lines.find((line) => /(palais|stade|musée|musee|maison des jeunes|place|institut|centre|hôtel|hotel|restaurant|marché|marche|cinéma|cinema|espace)/i.test(line)) || '';
    const organizerMatch = flat.match(/(?:organis(?:é|e)|par|organisateur)\s*[:\-]?\s*([A-ZÉÀÂÎÔÛÇ][\w'’\- ]{2,50})/);
    const organizer = organizerMatch ? organizerMatch[1].trim() : '';

    const filled = [title, hood, venueLine, priceMatch, time, organizer].filter(Boolean).length;
    const reliability = Math.min(88, 42 + filled * 7);

    return normalizeEvent({
      id: '',
      title: title || 'Nouvel événement',
      description: raw.slice(0, 600),
      startsAt: toISO(start),
      endsAt: toISO(new Date(start.getTime() + 2 * 3600 * 1000)),
      venue: venueLine || 'À confirmer',
      neighborhood: hood || 'Bamako',
      lat: null,
      lng: null,
      price: price,
      organizer: organizer || 'Organisateur à confirmer',
      sourceUrl: link || '',
      category,
      reliability,
      status: 'pending',
      sourceKind: 'poster',
      deal: category === 'bonplan',
    });
  }

  async function importDraft(payload = {}, { lang = 'fr' } = {}) {
    const quota = consumeLimit('import');
    if (!quota.ok) {
      return { ok: false, error: rateLimitError('import', quota.retryAfter, lang) };
    }

    const safe = {
      text: String(payload.text || '').slice(0, 4000),
      link: String(payload.link || '').slice(0, 500),
      imageName: String(payload.imageName || '').slice(0, 200),
      imageDataUrl: String(payload.imageDataUrl || ''),
    };
    const hasInput = safe.text.trim() || safe.link.trim() || safe.imageDataUrl;
    if (!hasInput) {
      return {
        ok: false,
        error: {
          code: 'empty',
          message: lang === 'bm' ? 'I ka foto walima lien bila.' : 'Ajoutez une photo, un lien ou le texte de l’affiche.',
        },
      };
    }

    if (state.mode === 'live') {
      try {
        const data = await request('/import-event', {
          method: 'POST',
          body: JSON.stringify({ ...safe, lang, sessionId: state.sessionId }),
        });
        const draft = normalizeEvent(data?.draft);
        if (!draft) throw new Error('draft invalide');
        return { ok: true, draft, mode: 'live', notice: data?.notice || '', confidence: data?.confidence ?? draft.reliability, remaining: quota.remaining };
      } catch (error) {
        if (error.status === 429) return { ok: false, error: rateLimitError('import', error.retryAfter || 300, lang) };
        // On continue avec l’extraction locale, clairement annoncée comme telle.
      }
    }

    const draft = heuristicDraft(safe);
    return {
      ok: true,
      draft,
      mode: 'demo',
      notice:
        lang === 'bm'
          ? 'Analyse locale (IA tɛ): i ka kelen-kelen ɲɛjira ka a bɔ.'
          : 'Analyse locale par mots-clés (sans IA). Vérifiez chaque champ avant de publier.',
      confidence: draft.reliability,
      remaining: quota.remaining,
    };
  }

  /* ------------------------------------------------------------------------
     11. Publication, validation et signalements
     ------------------------------------------------------------------------ */

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const PHONE_RE = /^\+?[\d\s().-]{6,20}$/;

  function validateEvent(payload = {}) {
    const errors = [];
    const title = String(payload.title || '').trim();
    if (title.length < 3) errors.push({ field: 'title', message: 'Le titre doit contenir au moins 3 caractères.' });
    if (!CATEGORIES.some((cat) => cat.id === payload.category)) errors.push({ field: 'category', message: 'Choisissez une catégorie.' });
    if (!payload.startsAt || Number.isNaN(new Date(payload.startsAt).getTime())) errors.push({ field: 'startsAt', message: 'Indiquez une date et une heure valides.' });
    if (!String(payload.venue || '').trim()) errors.push({ field: 'venue', message: 'Indiquez le lieu.' });
    if (!String(payload.neighborhood || '').trim()) errors.push({ field: 'neighborhood', message: 'Indiquez le quartier.' });
    if (!String(payload.organizer || '').trim()) errors.push({ field: 'organizer', message: 'Indiquez l’organisateur.' });
    if (payload.contact && !EMAIL_RE.test(payload.contact) && !PHONE_RE.test(String(payload.contact).trim())) {
      errors.push({ field: 'contact', message: 'Contact invalide : e-mail ou numéro de téléphone attendu.' });
    }
    const price = Number(payload.price);
    if (!Number.isFinite(price) || price < 0) errors.push({ field: 'price', message: 'Le prix doit être un nombre positif (0 = gratuit).' });
    const start = new Date(payload.startsAt);
    if (!Number.isNaN(start.getTime()) && start.getTime() < Date.now() - DAY_MS) {
      errors.push({ field: 'startsAt', message: 'La date est déjà passée.' });
    }
    return errors;
  }

  function eventFromPayload(payload, { status = 'pending', sourceKind = 'organizer', reliability = 50 } = {}) {
    const start = new Date(payload.startsAt);
    const end = payload.endsAt ? new Date(payload.endsAt) : new Date(start.getTime() + 2 * 3600 * 1000);
    return normalizeEvent({
      ...payload,
      id: payload.id || `org-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      startsAt: toISO(start),
      endsAt: toISO(end),
      status,
      sourceKind,
      reliability,
      deal: Boolean(payload.deal) || payload.category === 'bonplan',
      createdAt: toISO(new Date()),
      updatedAt: toISO(new Date()),
    });
  }

  async function submitEvent(payload, { lang = 'fr' } = {}) {
    const errors = validateEvent(payload);
    if (errors.length) return { ok: false, error: { code: 'invalid', errors, message: errors[0].message } };

    const quota = consumeLimit('submit');
    if (!quota.ok) return { ok: false, error: rateLimitError('submit', quota.retryAfter, lang) };

    const submission = {
      id: `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'pending',
      createdAt: toISO(new Date()),
      sourceKind: payload.sourceKind || 'organizer',
      mode: state.mode,
      payload: {
        title: String(payload.title).trim(),
        category: payload.category,
        description: String(payload.description || '').trim().slice(0, 1200),
        startsAt: payload.startsAt,
        endsAt: payload.endsAt || '',
        venue: String(payload.venue).trim(),
        neighborhood: payload.neighborhood,
        lat: payload.lat === '' || payload.lat === undefined ? null : Number(payload.lat),
        lng: payload.lng === '' || payload.lng === undefined ? null : Number(payload.lng),
        price: Number(payload.price) || 0,
        organizer: String(payload.organizer).trim(),
        contact: String(payload.contact || '').trim(),
        sourceUrl: String(payload.sourceUrl || '').trim(),
        image: String(payload.image || '').trim(),
        deal: Boolean(payload.deal),
      },
    };

    if (state.mode === 'live') {
      try {
        const data = await request('/submit-event', {
          method: 'POST',
          body: JSON.stringify({
            ...submission.payload,
            sourceKind: submission.sourceKind,
            lang,
            sessionId: state.sessionId,
            clientTime: toISO(new Date()),
          }),
        });
        const remote = {
          ...submission,
          id: data?.submission?.id || submission.id,
          status: data?.submission?.status || 'pending',
          mode: 'live',
        };
        state.submissions = [remote, ...state.submissions];
        writeJSON(STORAGE.submissions, state.submissions);
        return { ok: true, submission: remote, mode: 'live', remaining: data?.remaining ?? quota.remaining };
      } catch (error) {
        if (error.status === 429) return { ok: false, error: rateLimitError('submit', error.retryAfter || 3600, lang) };
        if (error.status === 400 && error.payload?.errors) {
          return { ok: false, error: { code: 'invalid', errors: error.payload.errors, message: error.message } };
        }
        // Stockage local : la proposition n’est pas perdue.
      }
    }

    state.submissions = [submission, ...state.submissions].slice(0, 80);
    writeJSON(STORAGE.submissions, state.submissions);
    return { ok: true, submission, mode: 'demo', remaining: quota.remaining };
  }

  async function reportEvent(eventId, reason = '', note = '', { lang = 'fr' } = {}) {
    if (!get(eventId)) return { ok: false, error: { code: 'missing', message: 'Événement introuvable.' } };
    if (state.reports.some((report) => sameId(report.eventId, eventId))) {
      return { ok: false, error: { code: 'already', message: lang === 'bm' ? 'I y’a fɔ kɔfɛ.' : 'Vous avez déjà signalé cet événement.' } };
    }
    const quota = consumeLimit('report');
    if (!quota.ok) return { ok: false, error: rateLimitError('report', quota.retryAfter, lang) };

    const report = {
      id: `rep-${Date.now().toString(36)}`,
      eventId: String(eventId),
      reason: String(reason || 'other').slice(0, 40),
      note: String(note || '').slice(0, 500),
      createdAt: toISO(new Date()),
    };

    if (state.mode === 'live') {
      try {
        await request('/report-event', { method: 'POST', body: JSON.stringify({ ...report, sessionId: state.sessionId }) });
      } catch (error) {
        if (error.status === 429) return { ok: false, error: rateLimitError('report', error.retryAfter || 300, lang) };
        // Le signalement local reste utile même si l’API échoue.
      }
    }

    state.reports = [report, ...state.reports].slice(0, 200);
    writeJSON(STORAGE.reports, state.reports);
    return { ok: true, report, mode: state.mode };
  }

  /* ---------------------------- Admin (démo) ------------------------------ */

  function adminToken() {
    return readJSON(STORAGE.admin, '');
  }

  function setAdminToken(token) {
    writeJSON(STORAGE.admin, String(token || '').trim());
  }

  async function reviewSubmission(id, action, patch = {}, { token = '' } = {}) {
    if (!['approve', 'reject'].includes(action)) return { ok: false, error: { code: 'action', message: 'Action inconnue.' } };
    const submission = state.submissions.find((item) => sameId(item.id, id));
    if (!submission) return { ok: false, error: { code: 'missing', message: 'Proposition introuvable.' } };

    if (state.mode === 'live' && token) {
      try {
        const data = await request('/admin-events', {
          method: 'POST',
          headers: { 'x-admin-token': token },
          body: JSON.stringify({ id, action, patch }),
        });
        submission.status = action === 'approve' ? 'approved' : 'rejected';
        writeJSON(STORAGE.submissions, state.submissions);
        const approved = normalizeEvent(data?.event);
        if (approved && action === 'approve') {
          approved.status = 'verified';
          state.local = [approved, ...state.local.filter((item) => item.id !== approved.id)];
          writeJSON(STORAGE.local, state.local);
        }
        return { ok: true, submission, event: approved, mode: 'live' };
      } catch (error) {
        return { ok: false, error: { code: error.code || 'error', message: error.message || 'Validation impossible.' } };
      }
    }

    // Mode démo : le jeton est pédagogique, il ne protège évidemment rien.
    if (String(token || '').trim() !== 'demo-admin') {
      return { ok: false, error: { code: 'unauthorized', message: 'Jeton administrateur requis (démo : demo-admin).' } };
    }

    submission.status = action === 'approve' ? 'approved' : 'rejected';
    submission.reviewedAt = toISO(new Date());

    if (action === 'approve') {
      const merged = { ...submission.payload, ...patch };
      const event = eventFromPayload(merged, {
        status: 'verified',
        sourceKind: submission.sourceKind || 'organizer',
        reliability: Number(patch.reliability) || (submission.sourceKind === 'ai' ? 78 : 88),
      });
      if (event) {
        state.local = [event, ...state.local.filter((item) => !sameId(item.id, event.id))];
        writeJSON(STORAGE.local, state.local);
      }
    }

    writeJSON(STORAGE.submissions, state.submissions);
    return { ok: true, submission, mode: 'demo' };
  }

  /**
   * File de validation lue sur le serveur (mode live) ou dans le stockage
   * local (mode démo). Le panneau admin utilise les deux de façon transparente.
   */
  async function adminQueue({ token = '' } = {}) {
    if (state.mode !== 'live') {
      return { ok: true, mode: 'demo', submissions: state.submissions.filter((item) => item.status === 'pending') };
    }
    if (!token) return { ok: false, mode: 'live', error: { code: 'unauthorized', message: 'Jeton administrateur requis.' } };
    try {
      const data = await request('/admin-events', { method: 'GET', headers: { 'x-admin-token': token } });
      const submissions = (data?.submissions || []).map((row) => ({
        id: row.id,
        status: row.status || 'pending',
        sourceKind: row.sourceKind || 'organizer',
        createdAt: row.createdAt || toISO(new Date()),
        payload: row.payload || {},
        draft: row.draft || null,
      }));
      return { ok: true, mode: 'live', submissions, reports: data?.reports || [] };
    } catch (error) {
      return { ok: false, mode: 'live', error: { code: error.code || 'error', message: error.message || 'File indisponible.' } };
    }
  }

  /** Validation rapide d’un événement « détecté par IA » (mode démo). */
  function verifyEvent(eventId, { reliability = 95 } = {}) {
    const event = get(eventId);
    if (!event) return null;
    const verified = {
      ...event,
      status: 'verified',
      reliability: Math.max(reliability, event.reliability || 0),
      updatedAt: toISO(new Date()),
    };
    state.local = [verified, ...state.local.filter((item) => !sameId(item.id, eventId))];
    writeJSON(STORAGE.local, state.local);
    return verified;
  }

  /* ------------------------------------------------------------------------
     12. Liens : agenda, WhatsApp, itinéraire
     ------------------------------------------------------------------------ */

  function escapeIcs(value = '') {
    return String(value)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  const icsStamp = (date) =>
    new Date(date)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');

  function buildIcs(event) {
    if (!event) return '';
    const start = asDate(event.startsAt);
    const end = asDate(event.endsAt) || new Date(start.getTime() + 2 * 3600 * 1000);
    if (!start) return '';
    const uid = `${event.id || 'evenement'}@bamahub.ml`;
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//BamaHub//Evenements//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${icsStamp(new Date())}`,
      `DTSTART:${icsStamp(start)}`,
      `DTEND:${icsStamp(end)}`,
      `SUMMARY:${escapeIcs(event.title)}`,
      `DESCRIPTION:${escapeIcs(`${event.description || ''}\n\nBamaHub — ${event.sourceUrl || 'https://bamahub.ml'}`)}`,
      `LOCATION:${escapeIcs([event.venue, event.neighborhood, 'Bamako, Mali'].filter(Boolean).join(', '))}`,
      `URL:${event.sourceUrl || 'https://bamahub.ml'}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ];
    return `${lines.join('\r\n')}\r\n`;
  }

  function googleCalendarUrl(event) {
    const start = asDate(event.startsAt);
    const end = asDate(event.endsAt) || new Date(start.getTime() + 2 * 3600 * 1000);
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      dates: `${start.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}/${end
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '')}`,
      details: event.description || 'Événement trouvé sur BamaHub',
      location: [event.venue, event.neighborhood, 'Bamako, Mali'].filter(Boolean).join(', '),
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function whatsappShare(event) {
    const start = asDate(event.startsAt);
    const text = [
      `📅 ${event.title}`,
      `${humanDate(start)} · ${formatTime(start)}`,
      [event.venue, event.neighborhood].filter(Boolean).join(' · '),
      event.price === 0 ? 'Gratuit' : `${new Intl.NumberFormat('fr-FR').format(event.price)} FCFA`,
      'Trouvé sur BamaHub',
    ]
      .filter(Boolean)
      .join('\n');
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  function mapsUrl(event) {
    if (Number.isFinite(event.lat) && Number.isFinite(event.lng)) {
      return `https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      [event.venue, event.neighborhood, 'Bamako, Mali'].filter(Boolean).join(', ')
    )}`;
  }

  function wazeUrl(event) {
    if (Number.isFinite(event.lat) && Number.isFinite(event.lng)) {
      return `https://www.waze.com/ul?ll=${event.lat}%2C${event.lng}&navigate=yes`;
    }
    return `https://www.waze.com/ul?q=${encodeURIComponent([event.venue, 'Bamako'].filter(Boolean).join(', '))}&navigate=yes`;
  }

  /* ------------------------------------------------------------------------
     13. API publique
     ------------------------------------------------------------------------ */

  function getState() {
    return {
      mode: state.mode,
      ready: state.ready,
      events: allEvents().length,
      local: state.local.length,
      submissions: state.submissions.length,
      pending: state.submissions.filter((item) => item.status === 'pending').length,
      lastSync: state.lastSync,
      error: state.error,
      limits: {
        chat: limitState('chat').remaining,
        import: limitState('import').remaining,
        submit: limitState('submit').remaining,
        report: limitState('report').remaining,
      },
    };
  }

  window.BamaHubEvents = {
    CATEGORIES,
    LIMITS,
    categoryOf,
    seed,
    init,
    getState,
    list,
    query,
    get,
    purge,
    normalizeEvent,
    dateKey,
    bamakoDate,
    humanDate,
    formatDate,
    formatTime,
    dateLabel,
    priceLabel,
    reliabilityTier,
    parseIntent,
    answerLocally,
    chat,
    importDraft,
    heuristicDraft,
    validateEvent,
    submitEvent,
    reportEvent,
    submissions: () => state.submissions.slice(),
    reports: () => state.reports.slice(),
    reviewSubmission,
    adminQueue,
    verifyEvent,
    adminToken,
    setAdminToken,
    limitState,
    buildIcs,
    googleCalendarUrl,
    whatsappShare,
    mapsUrl,
    wazeUrl,
    sessionId: () => state.sessionId,
  };
})();
