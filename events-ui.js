/* ============================================================================
   BamaHub — Interface « Événements & Bons plans IA »
   ----------------------------------------------------------------------------
   • Page autonome `#/evenements` : chat, filtres, Liste / Calendrier / Carte,
     fiche détaillée, import d’affiche, publication organisateur, validation.
   • Section d’accueil « Ce soir à Bamako ».
   • Aucune dépendance nouvelle : Leaflet est déjà chargé par index.html.
   • Toutes les chaînes passent par le dictionnaire local ci-dessous et sont
     rendues dans la langue active (français / bambara) ; la page se redessine
     automatiquement au changement de langue.
   • Les données viennent de `window.BamaHubEvents` qui bascule seul entre le
     backend Supabase et le mode démonstration.
   ========================================================================== */

(function () {
  'use strict';

  const EV = () => window.BamaHubEvents;
  const I18N = () => window.BamaHubI18n;
  const getLang = () => (I18N()?.getLang() === 'bm' ? 'bm' : 'fr');
  const tGlobal = (key) => (I18N() ? I18N().t(key) : key);

  /* ==========================================================================
     1. Textes (français / bambara)
     ========================================================================== */

  const STRINGS = {
    fr: {
      'nav.events': 'Événements',
      'page.eyebrow': 'Agenda intelligent · Bamako',
      'page.title': 'Événements & bons plans',
      'page.sub': 'Concerts, expos, marchés et promos à Bamako, vérifiés et mis à jour deux fois par jour.',
      'page.note': 'Les fiches marquées « Détecté par IA » attendent une confirmation. Signalez toute erreur, la base est corrigée par l’équipe.',
      'mode.live': 'Connecté à la base',
      'mode.demo': 'Démonstration · données d’exemple',
      'mode.demoHelp': 'Le backend n’est pas configuré dans cet aperçu. Les mêmes écrans fonctionnent avec Supabase une fois les variables d’environnement renseignées.',
      'stat.events': '{n} événements à venir',
      'stat.updated': 'Mis à jour {when}',
      'chat.title': 'Demandez à l’assistant',
      'chat.sub': 'Il répond uniquement depuis la base : aucune invention, aucun appel IA à chaque visite.',
      'chat.placeholder': 'Ex. : Que faire samedi ? Un concert gratuit ce soir ?',
      'chat.send': 'Demander',
      'chat.thinking': 'Recherche dans l’agenda…',
      'chat.remaining': '{n} questions restantes cette heure',
      'chat.source': 'Réponse construite depuis {n} événement(s) de la base.',
      'chat.empty': 'Aucun événement ne correspond. Essayez « ce week-end », « gratuit » ou le nom d’un quartier.',
      'chat.error': 'L’assistant est momentanément indisponible.',
      'chat.s1': 'Que faire samedi ?',
      'chat.s2': 'Un concert gratuit ce soir',
      'chat.s3': 'Bon plan pas cher',
      'chat.s4': 'Événements à Badalabougou',
      'chat.demoAnswer': 'Mode démonstration : réponse calculée localement sur les données d’exemple.',
      'filters.all': 'Tous',
      'filters.today': 'Aujourd’hui',
      'filters.weekend': 'Ce week-end',
      'filters.free': 'Gratuit',
      'filters.deal': 'Bon plan',
      'filters.tonight': 'Ce soir',
      'filters.week': '7 jours',
      'filters.cat': 'Toutes catégories',
      'filters.hood': 'Tous les quartiers',
      'filters.search': 'Rechercher un événement, un lieu…',
      'filters.reset': 'Réinitialiser',
      'filters.count': '{n} résultat(s)',
      'view.list': 'Liste',
      'view.calendar': 'Calendrier',
      'view.map': 'Carte',
      'card.free': 'Gratuit',
      'card.deal': 'Bon plan',
      'card.details': 'Détails',
      'card.agenda': 'Agenda',
      'card.share': 'WhatsApp',
      'card.route': 'Itinéraire',
      'card.ai': 'Détecté par IA, à confirmer',
      'card.verified': 'Vérifié',
      'card.reliability': 'Fiabilité {n}/100',
      'detail.close': 'Fermer',
      'detail.about': 'À propos',
      'detail.when': 'Quand',
      'detail.where': 'Lieu',
      'detail.price': 'Tarif',
      'detail.organizer': 'Organisateur',
      'detail.source': 'Source',
      'detail.sourceLink': 'Voir la source',
      'detail.report': 'Signaler',
      'detail.reported': 'Signalement envoyé. Merci !',
      'detail.verify': 'Vérifier cette fiche',
      'detail.verified': 'Fiche vérifiée.',
      'detail.reason': 'Motif du signalement',
      'detail.reason.date': 'Mauvaise date',
      'detail.reason.place': 'Mauvais lieu',
      'detail.reason.cancel': 'Événement annulé',
      'detail.reason.fake': 'Annonce douteuse',
      'detail.reason.other': 'Autre',
      'detail.send': 'Envoyer',
      'detail.cancel': 'Annuler',
      'detail.missing': 'Fiche incomplète : à confirmer avant de vous déplacer.',
      'calendar.prev': 'Mois précédent',
      'calendar.next': 'Mois suivant',
      'calendar.today': 'Aujourd’hui',
      'calendar.more': '+{n} autres',
      'calendar.empty': 'Aucun événement ce jour.',
      'calendar.pick': 'Choisissez un jour pour voir le programme.',
      'map.fallback': 'La carte n’a pas pu être chargée. La vue Liste reste disponible.',
      'map.hint': 'Cliquez sur une épingle pour ouvrir l’événement.',
      'import.title': 'Importer une affiche',
      'import.sub': 'Photo ou lien : l’IA pré-remplit la fiche, vous vérifiez, l’équipe valide.',
      'import.file': 'Choisir une photo',
      'import.link': 'Lien de l’annonce (facultatif)',
      'import.text': 'Texte de l’affiche (facultatif)',
      'import.run': 'Analyser l’affiche',
      'import.analyzing': 'Lecture de l’affiche…',
      'import.fill': 'Pré-remplir le formulaire',
      'import.notice': 'Fiche pré-remplie. Relisez chaque champ, l’IA peut se tromper.',
      'import.formats': 'JPEG, PNG ou WebP · 4,5 Mo maximum',
      'import.demo': 'Mode démonstration : extraction locale simplifiée, sans appel IA.',
      'import.remaining': '{n} import(s) restant(s) cette heure',
      'import.missing': 'Champs à compléter : {list}',
      'import.none': 'Ajoutez une photo, un lien ou le texte de l’affiche.',
      'publish.title': 'Publier mon événement',
      'publish.sub': 'Gratuit. Chaque proposition est relue avant publication.',
      'publish.titleField': 'Titre de l’événement',
      'publish.category': 'Catégorie',
      'publish.description': 'Description',
      'publish.start': 'Début',
      'publish.end': 'Fin',
      'publish.venue': 'Lieu précis',
      'publish.hood': 'Quartier',
      'publish.price': 'Prix en FCFA (0 = gratuit)',
      'publish.organizer': 'Organisateur',
      'publish.contact': 'Contact (téléphone ou e-mail)',
      'publish.source': 'Lien vers l’annonce',
      'publish.image': 'Image (URL, facultatif)',
      'publish.deal': 'C’est un bon plan / une promotion',
      'publish.submit': 'Envoyer pour validation',
      'publish.sending': 'Envoi…',
      'publish.ok': 'Proposition envoyée. Elle sera publiée après vérification.',
      'publish.pending': 'En attente de validation',
      'publish.required': 'Renseignez le titre, la date, le lieu et l’organisateur.',
      'publish.dateError': 'La date de fin doit suivre la date de début.',
      'publish.quota': 'Limite de publications atteinte. Réessayez plus tard.',
      'admin.title': 'Validation des propositions',
      'admin.sub': 'Espace réservé à l’équipe. En production, protégez-le par Netlify Identity ou Supabase Auth.',
      'admin.token': 'Jeton administrateur',
      'admin.tokenHint': 'Démonstration : demo-admin',
      'admin.connect': 'Ouvrir la file',
      'admin.empty': 'Aucune proposition en attente.',
      'admin.approve': 'Publier',
      'admin.reject': 'Refuser',
      'admin.approved': 'Événement publié.',
      'admin.rejected': 'Proposition refusée.',
      'admin.badToken': 'Jeton refusé.',
      'admin.submitted': 'Soumis le {date}',
      'home.eyebrow': 'Agenda',
      'home.title': 'Ce soir à Bamako',
      'home.sub': 'Trois idées pour sortir, vérifiées et sourcées.',
      'home.all': 'Tout l’agenda',
      'home.empty': 'Rien de programmé ce soir. Jetez un œil au week-end.',
      'home.ics': 'Ajouter à mon agenda',
      'home.icsDone': 'Fichier agenda téléchargé.',
      'home.whatsapp': 'Partager sur WhatsApp',
      'home.route': 'Itinéraire',
      'home.shareText': 'Partagé depuis BamaHub',
      'quota.chat': 'Limite de questions atteinte.{when}',
      'quota.import': 'Limite d’imports atteinte.{when}',
      'quota.submit': 'Limite de publications atteinte.{when}',
      'quota.report': 'Limite de signalements atteinte.{when}',
      'quota.retry': ' Réessayez dans {when}.',
      'toast.copied': 'Lien copié.',
      'toast.error': 'Une erreur est survenue. Réessayez.',
      'unit.min': 'min',
      'unit.h': 'h',
      'footer.disclaimer': 'Données d’exemple en mode démonstration — aucun serveur n’est appelé.',
    },
    bm: {
      'nav.events': 'Fɛtiw',
      'page.eyebrow': 'Ladilikan kalansɛbɛn · Bamakɔ',
      'page.title': 'Fɛtiw ni sɔngɔ ɲumanw',
      'page.sub': 'Dɔnkiliw, jiraliw, suguw ni sɔngɔ ɲumanw Bamakɔ — ɲɛjirali ni kunnafoni labɛnnen.',
      'page.note': 'Fɛti min bɛ « IA y’a ye » bɔ, o bɛ makɔnɔ kɔ. I ye fili kuraden, an b’a labɛn.',
      'mode.live': 'Bɔkunnafoni tɔgɔ',
      'mode.demo': 'Dɛmɔ · kunnafoni mimɛn bɛ jiri la',
      'mode.demoHelp': 'Server tɛ baara kɛ yan. A bɛ baara kɛ Supabase la ni aw y’a sababu kɛ.',
      'stat.events': '{n} fɛti nata',
      'stat.updated': 'Labɛnnen {when}',
      'chat.title': 'Ɲininkali kɛ ladililala',
      'chat.sub': 'A b’a fɔ bɔkunnafoni kɔrɔ: a tɛ kunnafoni kuruden bɔ.',
      'chat.placeholder': 'ɲɔgɔn: Mun bɛ kɛ sibiridon? Dɔnkili fu bi su?',
      'chat.send': 'Ɲininkali',
      'chat.thinking': 'Bɛ ɲini agenda kɔnɔ…',
      'chat.remaining': 'ɲininkali {n} ye kɛnɛ bi',
      'chat.source': 'Jaabi bɔ fɛti {n} kɔnɔ.',
      'chat.empty': 'Fɛti tɛ yen. I bɛ « dɔgɔkun » walisa « fu » walisa dugu tɔgɔ sɛbɛn.',
      'chat.error': 'Ladililala tɛ se ka baara kɛ sisan.',
      'chat.s1': 'Mun bɛ kɛ sibiridon?',
      'chat.s2': 'Dɔnkili fu bi su',
      'chat.s3': 'Sɔngɔ ɲuman',
      'chat.s4': 'Fɛtiw Badalabougou',
      'chat.demoAnswer': 'Dɛmɔ: jaabi bɔ kunnafoni mimɛn bɛ jiri la.',
      'filters.all': 'Bɛɛ',
      'filters.today': 'Bi',
      'filters.weekend': 'Dɔgɔkun',
      'filters.free': 'Fu',
      'filters.deal': 'Sɔngɔ ɲuman',
      'filters.tonight': 'Bi su',
      'filters.week': 'Tile 7',
      'filters.cat': 'Cogoya bɛɛ',
      'filters.hood': 'Dugu bɛɛ',
      'filters.search': 'Ɲini fɛti…',
      'filters.reset': 'A bila',
      'filters.count': 'Jaabi {n}',
      'view.list': 'Lisiti',
      'view.calendar': 'Kalande',
      'view.map': 'Karata',
      'card.free': 'Fu',
      'card.deal': 'Sɔngɔ ɲuman',
      'card.details': 'Kuna',
      'card.agenda': 'Alibɛ',
      'card.share': 'WhatsApp',
      'card.route': 'Sira',
      'card.ai': 'IA y’a ye, ka sɛgɛsɛgɛ',
      'card.verified': 'Sɛbɛnna',
      'card.reliability': 'Sɔgɔsɔgɔ {n}/100',
      'detail.close': 'Datugu',
      'detail.about': 'A kuna',
      'detail.when': 'Tuma',
      'detail.where': 'Yɔrɔ',
      'detail.price': 'Sɔngɔ',
      'detail.organizer': 'Labɛnbaga',
      'detail.source': 'Bɔyɔrɔ',
      'detail.sourceLink': 'Bɔyɔrɔ lajɛ',
      'detail.report': 'Fili',
      'detail.reported': 'Fili sɛbɛnna. Barika!',
      'detail.verify': 'Fɛti sɛgɛsɛgɛ',
      'detail.verified': 'Fɛti sɛgɛsɛgɛra.',
      'detail.reason': 'Fili sababu',
      'detail.reason.date': 'Tuma tɛ ɲɔgɔn',
      'detail.reason.place': 'Yɔrɔ tɛ ɲɔgɔn',
      'detail.reason.cancel': 'Fɛti bila',
      'detail.reason.fake': 'Kunnafoni gɛlɛn',
      'detail.reason.other': 'Dɔ wɛrɛ',
      'detail.send': 'A ci',
      'detail.cancel': 'A bila',
      'detail.missing': 'Fiche man dafa: i k’a sɛgɛsɛgɛ fɔlɔ.',
      'calendar.prev': 'Kalo tɛmɛnen',
      'calendar.next': 'Kalo nata',
      'calendar.today': 'Bi',
      'calendar.more': '+{n} wɛrɛ',
      'calendar.empty': 'Fɛti tɛ yen bi.',
      'calendar.pick': 'Don sugandi walisa i ye agenda ye.',
      'map.fallback': 'Karata man se ka jira. Lisiti bɛ yen.',
      'map.hint': 'I ye pin digi walisa fɛti da.',
      'import.title': 'Affiche don',
      'import.sub': 'Foto walisa jɔ: IA b’a labɛn, i b’a sɛgɛsɛgɛ, an b’a sɛbɛn.',
      'import.file': 'Foto sugandi',
      'import.link': 'Jɔ (fakultatif)',
      'import.text': 'Affiche sɛbɛn (fakultatif)',
      'import.run': 'Affiche lajɛ',
      'import.analyzing': 'Affiche kalan…',
      'import.fill': 'Formulaire dafa',
      'import.notice': 'Fiche dafara. I ye a lajɛ: IA bɛ fili.',
      'import.formats': 'JPEG, PNG walima WebP · 4,5 Mo',
      'import.demo': 'Dɛmɔ: ekstraksiyɔn lokal, IA tɛ wele.',
      'import.remaining': 'Import {n} ye kɛnɛ bi',
      'import.missing': 'Champs: {list}',
      'import.none': 'Foto, jɔ walisa sɛbɛn don.',
      'publish.title': 'N ka fɛti bɔ',
      'publish.sub': 'Fu. An b’a lajɛ fɔlɔ ka a bɔ.',
      'publish.titleField': 'Fɛti tɔgɔ',
      'publish.category': 'Cogoya',
      'publish.description': 'Kunnafoni',
      'publish.start': 'Bɛrɛ',
      'publish.end': 'Banni',
      'publish.venue': 'Yɔrɔ',
      'publish.hood': 'Dugu',
      'publish.price': 'Sɔngɔ FCFA (0 = fu)',
      'publish.organizer': 'Labɛnbaga',
      'publish.contact': 'Telefɔni walisa e-mail',
      'publish.source': 'Jɔ',
      'publish.image': 'Foto jɔ (fakultatif)',
      'publish.deal': 'Sɔngɔ ɲuman / promo',
      'publish.submit': 'A ci ka sɛgɛsɛgɛ',
      'publish.sending': 'Bɛ ci…',
      'publish.ok': 'A ci. An b’a sɛgɛsɛgɛ kɔ ka a bɔ.',
      'publish.pending': 'Makɔnɔ la',
      'publish.required': 'Tɔgɔ, tuma, yɔrɔ ni labɛnbaga sɛbɛn.',
      'publish.dateError': 'Banni tile ka kan ka tɛmɛ bɛrɛ tile kɔ.',
      'publish.quota': 'I ka hakɛ dafara. I ka kunnafoni kɔfɛ.',
      'admin.title': 'Propositionw sɛgɛsɛgɛ',
      'admin.sub': 'Team yɔrɔ. Production kɔnɔ, Netlify Identity walisa Supabase Auth b’a kɔlɔsi.',
      'admin.token': 'Admin jeton',
      'admin.tokenHint': 'Dɛmɔ: demo-admin',
      'admin.connect': 'File da',
      'admin.empty': 'Proposition tɛ yen.',
      'admin.approve': 'A bɔ',
      'admin.reject': 'A bila',
      'admin.approved': 'Fɛti bɔra.',
      'admin.rejected': 'Proposition bilala.',
      'admin.badToken': 'Jeton man ɲɛ.',
      'admin.submitted': 'A ci {date}',
      'home.eyebrow': 'Agenda',
      'home.title': 'Bi su Bamakɔ',
      'home.sub': 'Safɛ 3 ka bɔ kɛnɛ, sɛgɛsɛgɛlen.',
      'home.all': 'Agenda bɛɛ',
      'home.empty': 'Bi su fɛti tɛ. Dɔgɔkun lajɛ.',
      'home.ics': 'N ka alibɛ',
      'home.icsDone': 'Alibɛ fichye jiginna.',
      'home.whatsapp': 'WhatsApp',
      'home.route': 'Sira',
      'home.shareText': 'BamaHub bɔ',
      'quota.chat': 'Ɲininkali hakɛ dafara.{when}',
      'quota.import': 'Import hakɛ dafara.{when}',
      'quota.submit': 'Publication hakɛ dafara.{when}',
      'quota.report': 'Fili hakɛ dafara.{when}',
      'quota.retry': ' I ka kɔfɛ {when}.',
      'toast.copied': 'Jɔ kopi.',
      'toast.error': 'Fili dɔ kɛra. I ka kɔfɛ.',
      'unit.min': 'min',
      'unit.h': 'h',
      'footer.disclaimer': 'Dɛmɔ data — server tɛ wele.',
    },
  };

  function te(key, vars) {
    const dict = STRINGS[getLang()] || STRINGS.fr;
    const raw = dict[key] ?? STRINGS.fr[key] ?? key;
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
    );
  }

  /* ==========================================================================
     2. Petits utilitaires
     ========================================================================== */

  const esc = (value = '') =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const asDate = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const catOf = (id) => (EV() ? EV().categoryOf(id) : { id, label: id, labelBm: id, color: '#2563eb', icon: '' });
  const catLabel = (id) => {
    const cat = catOf(id);
    return getLang() === 'bm' ? cat.labelBm || cat.label : cat.label;
  };
  const has = (event, key) => event && event[key] !== undefined && event[key] !== null && event[key] !== '';
  const safeUrl = (value) => (/^https?:\/\//i.test(String(value || '')) ? String(value) : '');

  const ICONS = {
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin: '<path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/>',
    sparkle: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/><path d="M19 16l.7 1.9L21.6 18.6l-1.9.7L19 21l-.7-1.7-1.9-.7 1.9-.7Z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.4-3.4"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    calendarView: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
    map: '<path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z"/><path d="M9 3v15M15 6v15"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    check: '<path d="m20 6-11 11-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
    route: '<circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h4a4 4 0 0 0 4-4V9"/>',
    alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    ticket: '<path d="M3 9a3 3 0 0 1 0 6v3h18v-3a3 3 0 0 1 0-6V6H3Z"/><path d="M13 6v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    whatsapp:
      '<path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3 21l1.9-4.8A8.5 8.5 0 1 1 20.5 11.6Z"/><path d="M8.5 8.6c.3 2.6 2.3 4.6 4.9 4.9l1.1-1.3-1.7-.9-.9.7a5.6 5.6 0 0 1-2-2l.7-.9-.9-1.7Z"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
    store: '<path d="M3 9h18l-2 11H5L3 9Z"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/>',
  };

  const icon = (name, size = 18) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  /* ==========================================================================
     3. État local de l’interface
     ========================================================================== */

  const ui = {
    view: 'list',
    range: 'all',
    free: false,
    deal: false,
    category: '',
    hood: '',
    q: '',
    day: '',
    month: null, // { y, m }
    chat: { messages: [], busy: false, remaining: null },
    draft: null,
    import: { busy: false, notice: '', missing: [] },
    admin: { token: '', open: false, remote: [], error: '' },
    map: null,
    markers: null,
    lastFocus: null,
    pendingOpen: '',
    lastDeepLink: '',
  };

  const currentMonth = () => {
    if (ui.month) return ui.month;
    const now = new Date();
    ui.month = { y: now.getUTCFullYear(), m: now.getUTCMonth() };
    return ui.month;
  };

  const resetFilters = () => {
    ui.range = 'all';
    ui.free = false;
    ui.deal = false;
    ui.category = '';
    ui.hood = '';
    ui.q = '';
    ui.day = '';
  };

  /* ==========================================================================
     4. Lecture des événements
     ========================================================================== */

  function activeFilters() {
    return {
      range: ui.day ? '' : ui.range === 'all' ? '' : ui.range,
      free: ui.free,
      deal: ui.deal,
      categories: ui.category ? [ui.category] : [],
      neighborhood: ui.hood,
      q: ui.q,
      day: ui.day || undefined,
    };
  }

  function visibleEvents() {
    if (!EV()) return [];
    try {
      return EV().list(activeFilters());
    } catch (error) {
      console.error('[events-ui] list', error);
      return [];
    }
  }

  function tonightEvents(limit = 3) {
    if (!EV()) return [];
    try {
      return EV().list({ range: 'tonight' }).slice(0, limit);
    } catch (error) {
      return [];
    }
  }

  /* ==========================================================================
     5. Fragments d’interface
     ========================================================================== */

  function statusChip(eventOrTier) {
    const isTier = typeof eventOrTier === 'string';
    const status = isTier ? '' : eventOrTier?.status;
    const tier = isTier ? eventOrTier : EV().reliabilityTier(eventOrTier?.reliability || 0);
    if (status === 'verified') {
      return `<span class="ev-badge is-high">${icon('shield', 13)} ${esc(te('card.verified'))}</span>`;
    }
    if (status === 'pending') {
      return `<span class="ev-badge is-low">${icon('clock', 13)} ${esc(te('publish.pending'))}</span>`;
    }
    // Détecté par IA : le libellé reste explicite même si le score est élevé.
    return `<span class="ev-badge ${tier === 'low' ? 'is-low' : 'is-mid'}">${icon('sparkle', 13)} ${esc(te('card.ai'))}</span>`;
  }

  function reliabilityBar(value) {
    const tier = EV() ? EV().reliabilityTier(value) : 'mid';
    return `
      <div class="ev-trust" title="${esc(te('card.reliability', { n: value }))}">
        <span class="ev-trust-bar"><span class="ev-trust-fill is-${tier}" style="width:${Math.max(6, Math.min(100, value))}%"></span></span>
        <span class="ev-trust-value">${Math.round(value)}</span>
      </div>`;
  }

  function eventCard(event, { compact = false } = {}) {
    const cat = catOf(event.category);
    const start = asDate(event.startsAt);
    const tier = EV().reliabilityTier(event.reliability || 0);
    const dayNumber = start ? String(start.getUTCDate()).padStart(2, '0') : '--';
    // Nom du mois localisé (les mois bambara viennent de la couche de données).
    const monthShort = start
      ? EV()
          .formatDate(start, { lang: getLang(), weekday: false })
          .replace(/^\d+\s*/, '')
      : '';
    const time = start ? EV().formatTime(start, getLang()) : '';

    return `
      <article class="ev-card${compact ? ' is-compact' : ''}" style="--cat:${cat.color}">
        <div class="ev-card-date" aria-hidden="true">
          <span class="ev-card-day">${dayNumber}</span>
          <span class="ev-card-month">${esc(monthShort)}</span>
          <span class="ev-card-time">${esc(time)}</span>
        </div>
        <div class="ev-card-main">
          <div class="ev-card-top">
            <span class="ev-cat">${icon('sparkle', 12)}<span class="ev-cat-dot" style="background:${cat.color}"></span>${esc(catLabel(event.category))}</span>
            <div class="ev-card-flags">
              ${statusChip(event)}
              ${event.price === 0 ? `<span class="ev-badge is-free">${esc(te('card.free'))}</span>` : ''}
              ${event.deal ? `<span class="ev-badge is-deal">${icon('ticket', 13)} ${esc(te('card.deal'))}</span>` : ''}
            </div>
          </div>
          <h3 class="ev-card-title">${esc(event.title)}</h3>
          <p class="ev-card-meta">
            <span>${icon('clock', 14)} ${esc(EV().dateLabel(event, getLang()))}</span>
            <span>${icon('pin', 14)} ${esc(event.venue || event.neighborhood)}</span>
            ${event.price > 0 ? `<span class="ev-price">${esc(EV().priceLabel(event, getLang()))}</span>` : ''}
          </p>
          ${compact ? '' : `<p class="ev-card-desc">${esc((event.description || '').slice(0, 165))}${(event.description || '').length > 165 ? '…' : ''}</p>`}
          <div class="ev-card-actions">
            <button type="button" class="btn btn-soft btn-sm" data-ev-open="${esc(event.id)}">${icon('calendar', 15)} ${esc(te('card.details'))}</button>
            <button type="button" class="btn btn-ghost btn-sm" data-ev-ics="${esc(event.id)}" aria-label="${esc(compact ? te('home.ics') : te('card.agenda'))} — ${esc(event.title)}">${icon('download', 15)} <span class="ev-hide-sm">${esc(compact ? te('home.ics') : te('card.agenda'))}</span></button>
            <a class="btn btn-ghost btn-sm" href="${esc(EV().whatsappShare(event))}" target="_blank" rel="noopener" aria-label="${esc(te('card.share'))} — ${esc(event.title)}">${icon('whatsapp', 15)} <span class="ev-hide-sm">WhatsApp</span></a>
            <a class="btn btn-ghost btn-sm" href="${esc(EV().mapsUrl(event))}" target="_blank" rel="noopener" aria-label="${esc(te('card.route'))} — ${esc(event.title)}">${icon('route', 15)} <span class="ev-hide-sm">${esc(te('card.route'))}</span></a>
            ${reliabilityBar(event.reliability || 0)}
          </div>
        </div>
      </article>`;
  }

  function emptyState(message, { iconName = 'calendar', action = '' } = {}) {
    return `<div class="ev-empty">
      <span class="ev-empty-icon">${icon(iconName, 26)}</span>
      <p>${esc(message)}</p>
      ${action}
    </div>`;
  }

  /* ==========================================================================
     6. Page Événements
     ========================================================================== */

  function pageTemplate() {
    const state = EV() ? EV().getState() : { mode: 'demo', events: 0, lastSync: null };
    const all = visibleEvents();
    const live = state.mode === 'live';
    const updated = state.lastSync
      ? `${EV().humanDate(state.lastSync, getLang())} · ${EV().formatTime(state.lastSync, getLang())}`
      : '—';

    return `
      <section class="events-page" data-events-page>
        <header class="ev-hero">
          <div class="ev-hero-text">
            <p class="eyebrow">${icon('sparkle', 14)} ${esc(te('page.eyebrow'))}</p>
            <h1>${esc(te('page.title'))}</h1>
            <p class="ev-hero-sub">${esc(te('page.sub'))}</p>
            <p class="ev-hero-note">${icon('shield', 14)} ${esc(te('page.note'))}</p>
            <p class="ev-hero-stats">
              <span class="ev-mode ${live ? 'is-live' : 'is-demo'}">${icon(live ? 'shield' : 'info', 14)} ${esc(te(live ? 'mode.live' : 'mode.demo'))}</span>
              <span>${esc(te('stat.events', { n: all.length }))}</span>
              <span>${esc(te('stat.updated', { when: updated }))}</span>
            </p>
          </div>
          <button type="button" class="btn btn-primary ev-hero-cta" data-ev-scroll="publish">
            ${icon('plus', 16)} ${esc(te('publish.title'))}
          </button>
        </header>

        ${live ? '' : `<p class="ev-note ev-demo-note">${icon('info', 15)} ${esc(te('mode.demoHelp'))}</p>`}

        ${chatTemplate()}

        <div class="ev-toolbar">
          <div class="ev-search">
            ${icon('search', 17)}
            <input type="search" id="ev-search" value="${esc(ui.q)}" placeholder="${esc(te('filters.search'))}" aria-label="${esc(te('filters.search'))}" autocomplete="off" />
          </div>
          <div class="ev-chips" role="group" aria-label="${esc(te('page.title'))}">
            ${chip('all', te('filters.all'))}
            ${chip('today', te('filters.today'))}
            ${chip('tonight', te('filters.tonight'))}
            ${chip('weekend', te('filters.weekend'))}
            ${chip('free', te('filters.free'))}
            ${chip('deal', te('filters.deal'))}
          </div>
          <div class="ev-selects">
            <select id="ev-cat" aria-label="${esc(te('filters.cat'))}">
              <option value="">${esc(te('filters.cat'))}</option>
              ${EV().CATEGORIES.map(
                (cat) =>
                  `<option value="${cat.id}"${ui.category === cat.id ? ' selected' : ''}>${esc(getLang() === 'bm' ? cat.labelBm : cat.label)}</option>`
              ).join('')}
            </select>
            <select id="ev-hood" aria-label="${esc(te('filters.hood'))}">
              <option value="">${esc(te('filters.hood'))}</option>
              ${['Hamdallaye', 'ACI 2000', 'Badalabougou', 'Kalaban Coura', 'Magnambougou', 'Quartier du fleuve', 'Sotuba', 'Djicoroni', 'Niamakoro', 'Yirimadio', 'Sabalibougou', 'Lafiabougou', 'Banankabougou']
                .map((name) => `<option value="${name}"${ui.hood === name ? ' selected' : ''}>${name}</option>`)
                .join('')}
            </select>
            <div class="ev-views" role="group" aria-label="${esc(te('view.list'))} / ${esc(te('view.calendar'))} / ${esc(te('view.map'))}">
              ${viewButton('list', te('view.list'), 'list')}
              ${viewButton('calendar', te('view.calendar'), 'calendarView')}
              ${viewButton('map', te('view.map'), 'map')}
            </div>
          </div>
          <p class="ev-results">${esc(te('filters.count', { n: all.length }))}</p>
        </div>

        <div class="ev-body">
          ${ui.view === 'list' ? listView(all) : ui.view === 'calendar' ? calendarView(all) : mapView(all)}
        </div>

        <div class="ev-tools">
          ${publishPanel()}
          ${importPanel()}
          ${adminPanel()}
        </div>
      </section>

      <div class="ev-modal" id="ev-modal" hidden>
        <div class="ev-modal-backdrop" data-ev-close></div>
        <div class="ev-modal-card" role="dialog" aria-modal="true" aria-labelledby="ev-modal-title"></div>
      </div>`;
  }

  function chip(value, label) {
    const isRange = ['today', 'tonight', 'weekend', 'week'].includes(value);
    const active = value === 'free' ? ui.free : value === 'deal' ? ui.deal : isRange ? ui.range === value : ui.range === 'all' && !ui.free && !ui.deal;
    return `<button type="button" class="ev-chip${active ? ' is-active' : ''}" data-ev-filter="${value}" aria-pressed="${active}">${esc(label)}</button>`;
  }

  function viewButton(view, label, iconName) {
    const active = ui.view === view;
    return `<button type="button" class="ev-view${active ? ' is-active' : ''}" data-ev-view="${view}" aria-pressed="${active}">${icon(iconName, 16)} <span>${esc(label)}</span></button>`;
  }

  function listView(events) {
    if (!events.length) {
      return emptyState(
        te('calendar.empty'),
        { iconName: 'search', action: `<button type="button" class="btn btn-ghost btn-sm" data-ev-reset>${esc(te('filters.reset'))}</button>` }
      );
    }
    if (ui.day) {
      return `
        <div class="ev-day-head">
          <h2>${esc(EV().humanDate(`${ui.day}T12:00:00.000Z`, getLang()))}</h2>
          <button type="button" class="btn btn-ghost btn-sm" data-ev-reset>${icon('x', 14)} ${esc(te('filters.reset'))}</button>
        </div>
        <div class="ev-list">${events.map((event) => eventCard(event)).join('')}</div>`;
    }
    return `<div class="ev-list">${events.map((event) => eventCard(event)).join('')}</div>`;
  }

  function calendarView(events) {
    const { y, m } = currentMonth();
    const first = new Date(Date.UTC(y, m, 1));
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const offset = (first.getUTCDay() + 6) % 7; // lundi en première colonne
    const todayKey = EV().dateKey(new Date());

    const byDay = new Map();
    events.forEach((event) => {
      const key = EV().dateKey(event.startsAt);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(event);
    });

    // Mois localisé avec les noms bambara déjà utilisés par la couche de
    // données (pas de doublon de vocabulaire).
    const monthTitle = `${EV()
      .formatDate(first, { lang: getLang(), weekday: false })
      .replace(/^\d+\s*/, '')} ${y}`;
    const weekdayLabels = getLang() === 'bm'
      ? ['ntɛ', 'tar', 'ara', 'ala', 'jum', 'sib', 'kar']
      : ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

    const cells = [];
    for (let i = 0; i < offset; i += 1) cells.push('<span class="ev-cal-cell is-out" aria-hidden="true"></span>');
    for (let d = 1; d <= daysInMonth; d += 1) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const list = byDay.get(key) || [];
      const isToday = key === todayKey;
      const selected = key === ui.day;
      cells.push(`
        <button type="button" class="ev-cal-cell${isToday ? ' is-today' : ''}${selected ? ' is-selected' : ''}${list.length ? ' has-events' : ''}"
          data-ev-day="${key}" aria-label="${esc(`${d} ${monthTitle} — ${list.length}`)}" ${list.length ? '' : 'aria-disabled="false"'}>
          <span class="ev-cal-num">${d}</span>
          <span class="ev-cal-dots" aria-hidden="true">${list.slice(0, 3).map((event) => `<i style="background:${catOf(event.category).color}"></i>`).join('')}</span>
          ${list.length ? `<span class="ev-cal-count">${list.length > 3 ? te('calendar.more', { n: list.length - 3 }) : ''}</span>` : ''}
        </button>`);
    }

    const selectedList = ui.day ? events.filter((event) => EV().dateKey(event.startsAt) === ui.day) : [];

    return `
      <div class="ev-calendar">
        <div class="ev-cal-head">
          <button type="button" class="icon-btn" data-ev-month="-1" aria-label="${esc(te('calendar.prev'))}">${icon('chevronLeft', 18)}</button>
          <h2>${esc(monthTitle)}</h2>
          <button type="button" class="icon-btn" data-ev-month="1" aria-label="${esc(te('calendar.next'))}">${icon('chevronRight', 18)}</button>
        </div>
        <div class="ev-cal-weekdays" aria-hidden="true">${weekdayLabels.map((day) => `<span>${esc(day)}</span>`).join('')}</div>
        <div class="ev-cal-grid">${cells.join('')}</div>
        <div class="ev-cal-legend">
          ${EV().CATEGORIES.slice(0, 6).map((cat) => `<span><i style="background:${cat.color}"></i>${esc(getLang() === 'bm' ? cat.labelBm : cat.label)}</span>`).join('')}
        </div>
      </div>
      <div class="ev-day-panel">
        ${ui.day ? '' : `<p class="hint">${esc(te('calendar.pick'))}</p>`}
        ${selectedList.length ? selectedList.map((event) => eventCard(event)).join('') : ui.day ? emptyState(te('calendar.empty')) : ''}
      </div>`;
  }

  function mapView(events) {
    return `
      <div class="ev-map-wrap">
        <div id="ev-map" class="ev-map" role="application" aria-label="${esc(te('view.map'))}"></div>
        <p class="hint ev-map-hint">${icon('pin', 14)} ${esc(te('map.hint'))}</p>
        <div class="ev-map-list">${events.slice(0, 40).map((event) => eventCard(event, { compact: true })).join('')}</div>
      </div>`;
  }

  function chatTemplate() {
    const remaining = EV() ? EV().limitState('chat').remaining : 0;
    const messages = ui.chat.messages;
    return `
      <section class="ev-chat" aria-labelledby="ev-chat-title">
        <div class="ev-chat-head">
          <span class="ev-chat-icon">${icon('sparkle', 20)}</span>
          <div>
            <h2 id="ev-chat-title">${esc(te('chat.title'))}</h2>
            <p>${esc(te('chat.sub'))}</p>
          </div>
          <span class="ev-chat-remaining">${esc(te('chat.remaining', { n: remaining }))}</span>
        </div>
        <div class="ev-chat-log" role="log" aria-live="polite">
          ${
            messages.length
              ? messages
                  .map((message) =>
                    message.role === 'user'
                      ? `<div class="ev-msg is-user"><p>${esc(message.text)}</p></div>`
                      : `<div class="ev-msg is-bot${message.error ? ' is-error' : ''}">
                          <p>${esc(message.text)}</p>
                          ${message.note ? `<p class="ev-msg-note">${icon('info', 13)} ${esc(message.note)}</p>` : ''}
                          ${
                            message.events?.length
                              ? `<div class="ev-msg-events">${message.events
                                  .map(
                                    (event) => `<button type="button" class="ev-mini" data-ev-open="${esc(event.id)}">
                                      <span class="ev-mini-dot" style="background:${catOf(event.category).color}"></span>
                                      <span class="ev-mini-text"><strong>${esc(event.title)}</strong><small>${esc(EV().dateLabel(event, getLang()))} · ${esc(EV().priceLabel(event, getLang()))}</small></span>
                                    </button>`
                                  )
                                  .join('')}</div>`
                              : ''
                          }
                        </div>`
                  )
                  .join('')
              : `<div class="ev-chat-intro">
                  <p class="hint">${icon('info', 14)} ${esc(te('chat.sub'))}</p>
                  <div class="ev-suggestions">
                    ${['chat.s1', 'chat.s2', 'chat.s3', 'chat.s4'].map((key) => `<button type="button" class="ev-suggestion" data-ev-ask="${esc(te(key))}">${esc(te(key))}</button>`).join('')}
                  </div>
                </div>`
          }
          ${ui.chat.busy ? `<div class="ev-msg is-bot is-typing"><span></span><span></span><span></span><span class="sr-only">${esc(te('chat.thinking'))}</span></div>` : ''}
        </div>
        <form class="ev-chat-form" data-ev-chat-form>
          <input type="text" name="question" placeholder="${esc(te('chat.placeholder'))}" aria-label="${esc(te('chat.placeholder'))}" autocomplete="off" maxlength="400" />
          <button type="submit" class="btn btn-primary" ${ui.chat.busy ? 'disabled' : ''}>${icon('send', 16)} <span>${esc(te('chat.send'))}</span></button>
        </form>
      </section>`;
  }

  function formField(name, label, { type = 'text', value = '', required = false, min = '', step = '', placeholder = '', hint = '', options = null, textarea = false, wide = false } = {}) {
    const attrs = `id="ev-f-${name}" name="${name}"${required ? ' required' : ''}${min !== '' ? ` min="${esc(min)}"` : ''}${step !== '' ? ` step="${esc(step)}"` : ''}${placeholder ? ` placeholder="${esc(placeholder)}"` : ''}`;
    const control = options
      ? `<select ${attrs}>${options.map((option) => `<option value="${esc(option.value)}"${String(value) === String(option.value) ? ' selected' : ''}>${esc(option.label)}</option>`).join('')}</select>`
      : textarea
        ? `<textarea ${attrs} rows="3">${esc(value)}</textarea>`
        : `<input type="${type}" ${attrs} value="${esc(value)}" />`;
    return `<label class="ev-field${wide ? ' is-wide' : ''}">
      <span>${esc(label)}${required ? ' *' : ''}</span>
      ${control}
      ${hint ? `<small>${esc(hint)}</small>` : ''}
    </label>`;
  }

  function publishPanel() {
    const d = ui.draft || {};
    const categoryOptions = EV().CATEGORIES.map((cat) => ({
      value: cat.id,
      label: getLang() === 'bm' ? cat.labelBm : cat.label,
    }));
    const hoodOptions = ['Hamdallaye', 'ACI 2000', 'Badalabougou', 'Kalaban Coura', 'Magnambougou', 'Quartier du fleuve', 'Sotuba', 'Djicoroni', 'Niamakoro', 'Yirimadio', 'Sabalibougou', 'Lafiabougou', 'Banankabougou'].map((name) => ({ value: name, label: name }));

    return `
      <details class="ev-panel" id="ev-publish" ${d.title ? 'open' : ''}>
        <summary>
          <span class="ev-panel-icon">${icon('plus', 18)}</span>
          <span><strong>${esc(te('publish.title'))}</strong><small>${esc(te('publish.sub'))}</small></span>
          ${icon('chevronRight', 18)}
        </summary>
        <form class="ev-form" data-ev-publish-form novalidate>
          <div class="ev-form-grid">
            ${formField('title', te('publish.titleField'), { value: d.title || '', required: true, wide: true })}
            ${formField('category', te('publish.category'), { value: d.category || 'concert', options: categoryOptions })}
            ${formField('organizer', te('publish.organizer'), { value: d.organizer || '', required: true })}
            ${formField('startsAt', te('publish.start'), { type: 'datetime-local', value: d.startsAt ? d.startsAt.slice(0, 16) : '', required: true })}
            ${formField('endsAt', te('publish.end'), { type: 'datetime-local', value: d.endsAt ? d.endsAt.slice(0, 16) : '' })}
            ${formField('venue', te('publish.venue'), { value: d.venue || '', required: true })}
            ${formField('neighborhood', te('publish.hood'), { value: d.neighborhood || 'Bamako', options: hoodOptions })}
            ${formField('price', te('publish.price'), { type: 'number', value: d.price ?? 0, min: '0', step: '50' })}
            ${formField('contact', te('publish.contact'), { value: d.contact || '' })}
            ${formField('sourceUrl', te('publish.source'), { type: 'url', value: d.sourceUrl || '', placeholder: 'https://' })}
            ${formField('image', te('publish.image'), { type: 'url', value: d.image || '', placeholder: 'https://' })}
            ${formField('description', te('publish.description'), { value: d.description || '', textarea: true, wide: true })}
          </div>
          <label class="ev-check">
            <input type="checkbox" name="deal" ${d.deal ? 'checked' : ''} />
            <span>${esc(te('publish.deal'))}</span>
          </label>
          <div class="ev-form-actions">
            <button type="submit" class="btn btn-primary">${icon('send', 16)} ${esc(te('publish.submit'))}</button>
            <span class="ev-form-status" role="status"></span>
          </div>
        </form>
      </details>`;
  }

  function importPanel() {
    return `
      <details class="ev-panel" id="ev-import">
        <summary>
          <span class="ev-panel-icon is-accent">${icon('sparkle', 18)}</span>
          <span><strong>${esc(te('import.title'))}</strong><small>${esc(te('import.sub'))}</small></span>
          ${icon('chevronRight', 18)}
        </summary>
        <form class="ev-form" data-ev-import-form novalidate>
          <div class="ev-form-grid">
            <label class="ev-field is-wide ev-file">
              <span>${esc(te('import.file'))}</span>
              <input type="file" name="poster" accept="image/*" />
              <small>${esc(te('import.formats'))}</small>
            </label>
            ${formField('link', te('import.link'), { type: 'url', placeholder: 'https://' })}
            ${formField('text', te('import.text'), { textarea: true, wide: true })}
          </div>
          <div class="ev-form-actions">
            <button type="submit" class="btn btn-primary" ${ui.import.busy ? 'disabled' : ''}>${icon('sparkle', 16)} ${esc(te(ui.import.busy ? 'import.analyzing' : 'import.run'))}</button>
            <span class="ev-form-status" role="status">${esc(ui.import.notice || '')}</span>
          </div>
          ${ui.import.missing?.length ? `<p class="ev-note is-warn">${icon('alert', 14)} ${esc(te('import.missing', { list: ui.import.missing.join(', ') }))}</p>` : ''}
          ${EV() && EV().getState().mode === 'demo' ? `<p class="ev-note">${icon('info', 14)} ${esc(te('import.demo'))}</p>` : ''}
        </form>
      </details>`;
  }

  function adminPanel() {
    const token = ui.admin.token || (EV() ? EV().adminToken() : '');
    const pending = EV() ? EV().submissions().filter((item) => item.status === 'pending') : [];

    return `
      <details class="ev-panel" id="ev-admin" ${ui.admin.open ? 'open' : ''}>
        <summary>
          <span class="ev-panel-icon is-slate">${icon('shield', 18)}</span>
          <span><strong>${esc(te('admin.title'))}</strong><small>${esc(te('admin.sub'))}</small></span>
          ${icon('chevronRight', 18)}
        </summary>
        <form class="ev-admin-bar" data-ev-admin-form>
          <label class="ev-field">
            <span>${esc(te('admin.token'))}</span>
            <input type="password" name="token" value="${esc(token)}" placeholder="${esc(te('admin.tokenHint'))}" autocomplete="off" />
          </label>
          <button type="submit" class="btn btn-ghost">${icon('shield', 15)} ${esc(te('admin.connect'))}</button>
          <span class="ev-form-status" role="status"></span>
        </form>
        ${ui.admin.error ? `<p class="ev-note is-warn" style="margin:0 1.05rem 0.8rem">${icon('alert', 14)} ${esc(ui.admin.error)}</p>` : ''}
        <div class="ev-admin-list">
          ${
            pending.length
              ? pending
                  .map(
                    (item) => `
                    <article class="ev-admin-item" data-sub="${esc(item.id)}">
                      <div>
                        <strong>${esc(item.payload.title)}</strong>
                        <small>${esc(te('admin.submitted', { date: EV().humanDate(item.createdAt, getLang()) }))} · ${esc(item.payload.venue || '')}</small>
                      </div>
                      <div class="ev-admin-actions">
                        <button type="button" class="btn btn-primary btn-sm" data-ev-review="${esc(item.id)}" data-ev-action="approve">${icon('check', 14)} ${esc(te('admin.approve'))}</button>
                        <button type="button" class="btn btn-danger-soft btn-sm" data-ev-review="${esc(item.id)}" data-ev-action="reject">${icon('x', 14)} ${esc(te('admin.reject'))}</button>
                      </div>
                    </article>`
                  )
                  .join('')
              : emptyState(te('admin.empty'), { iconName: 'shield' })
          }
        </div>
      </details>`;
  }

  /* ==========================================================================
     7. Rendu et cycle de vie
     ========================================================================== */

  let mounted = false;

  function destroyMap() {
    if (ui.map) {
      try {
        ui.map.remove();
      } catch (error) {
        /* déjà détachée */
      }
    }
    ui.map = null;
    ui.markers = null;
  }

  function render(main) {
    if (!main) return;
    destroyMap();
    main.innerHTML = pageTemplate();
    mounted = true;
    bindPage(main);
    if (ui.view === 'map') mountMap();

    // Lien profond : carte de l’accueil (`ui.pendingOpen`) ou URL
    // `#/evenements?id=…`. On ne l’ouvre qu’une fois par identifiant.
    const routeId = new URLSearchParams((location.hash.split('?')[1] || '')).get('id') || '';
    const wanted = ui.pendingOpen || routeId;
    ui.pendingOpen = '';
    if (wanted && wanted !== ui.lastDeepLink) {
      setTimeout(() => {
        // Si les données ne sont pas encore chargées (premier rendu avant
        // `init`), on ne mémorise rien : le rendu suivant réessaiera.
        if (!EV().get(wanted)) return;
        ui.lastDeepLink = wanted;
        openDetail(wanted);
      }, 80);
    }
  }

  function rerenderBody() {
    const main = document.getElementById('main');
    if (!mounted || !main || !$('[data-events-page]', main)) return;
    const body = $('.ev-body', main);
    const all = visibleEvents();
    const toolbarCount = $('.ev-results', main);
    if (toolbarCount) toolbarCount.textContent = te('filters.count', { n: all.length });
    if (!body) return;
    destroyMap();
    body.innerHTML = ui.view === 'list' ? listView(all) : ui.view === 'calendar' ? calendarView(all) : mapView(all);
    if (ui.view === 'map') mountMap();
    $$('.ev-chip', main).forEach((button) => {
      const value = button.dataset.evFilter;
      const isRange = ['today', 'tonight', 'weekend', 'week'].includes(value);
      const active = value === 'free' ? ui.free : value === 'deal' ? ui.deal : isRange ? ui.range === value : ui.range === 'all' && !ui.free && !ui.deal;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $$('.ev-view', main).forEach((button) => {
      const active = button.dataset.evView === ui.view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function mountMap() {
    const container = document.getElementById('ev-map');
    if (!container) return;
    const events = visibleEvents().filter((event) => Number.isFinite(event.lat) && Number.isFinite(event.lng));
    if (!window.L || typeof window.L.map !== 'function') {
      container.innerHTML = `<div class="map-fallback">${icon('map', 22)}<p>${esc(te('map.fallback'))}</p></div>`;
      return;
    }

    const map = window.L.map(container, {
      center: [12.6392, -8.0029],
      zoom: 12,
      scrollWheelZoom: false,
      minZoom: 4,
      maxZoom: 19,
    });
    ui.map = map;

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    window.L.control.zoom({ zoomInTitle: tGlobal('map.zoomIn'), zoomOutTitle: tGlobal('map.zoomOut') }).addTo(map);

    const markers = window.L.markerClusterGroup
      ? window.L.markerClusterGroup({ showCoverageOnHover: false, disableClusteringAtZoom: 17, maxClusterRadius: 52 })
      : window.L.layerGroup();
    ui.markers = markers;

    events.forEach((event) => {
      const cat = catOf(event.category);
      const pin = window.L.divIcon({
        className: 'bh-pin-wrap',
        html: `<span class="bh-pin" style="--cat:${cat.color}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${cat.icon}</svg></span>`,
        iconSize: [30, 38],
        iconAnchor: [15, 36],
        popupAnchor: [0, -30],
      });
      const marker = window.L.marker([event.lat, event.lng], { icon: pin, title: event.title });
      marker.bindPopup(`
        <div class="map-popup ev-popup">
          <p class="map-popup-cat" style="color:${cat.color}">${esc(catLabel(event.category))}</p>
          <h3>${esc(event.title)}</h3>
          <p class="map-popup-meta">${icon('calendar', 13)} ${esc(EV().dateLabel(event, getLang()))}</p>
          <p class="map-popup-meta">${icon('pin', 13)} ${esc(event.venue || event.neighborhood)}</p>
          <div class="map-popup-actions">
            <button type="button" class="btn btn-primary btn-sm" data-ev-open="${esc(event.id)}">${esc(te('card.details'))}</button>
            <a class="map-link" href="${esc(EV().mapsUrl(event))}" target="_blank" rel="noopener">${esc(te('card.route'))}</a>
          </div>
        </div>`);
      markers.addLayer(marker);
    });

    if (markers.getBounds && markers.getLayers().length) {
      try {
        map.fitBounds(markers.getBounds().pad(0.15), { maxZoom: 14 });
      } catch (error) {
        /* une seule épingle : garder le centre par défaut */
      }
    }
    map.addLayer(markers);
  }

  /* ==========================================================================
     8. Fiche détaillée
     ========================================================================== */

  function openDetail(id) {
    const event = EV() && EV().get(id);
    if (!event) return;
    const modal = document.getElementById('ev-modal');
    if (!modal) return;
    const card = $('.ev-modal-card', modal);
    const cat = catOf(event.category);
    const tier = EV().reliabilityTier(event.reliability || 0);
    const reported = (EV().reports() || []).some((report) => String(report.eventId) === String(event.id));
    const reasons = [
      ['wrong-date', te('detail.reason.date')],
      ['wrong-place', te('detail.reason.place')],
      ['cancelled', te('detail.reason.cancel')],
      ['fake', te('detail.reason.fake')],
      ['other', te('detail.reason.other')],
    ];

    card.innerHTML = `
      <button type="button" class="ev-modal-close" data-ev-close aria-label="${esc(te('detail.close'))}">${icon('x', 20)}</button>
      <div class="ev-detail-hero" style="--cat:${cat.color}">
        <span class="ev-detail-icon">${icon('sparkle', 24)}</span>
        <div>
          <p class="ev-detail-cat">${esc(catLabel(event.category))}</p>
          <h2 id="ev-modal-title">${esc(event.title)}</h2>
          <div class="ev-card-flags">${statusChip(event)}${event.price === 0 ? `<span class="ev-badge is-free">${esc(te('card.free'))}</span>` : ''}${event.deal ? `<span class="ev-badge is-deal">${esc(te('card.deal'))}</span>` : ''}</div>
        </div>
      </div>
      <div class="ev-detail-body">
        <p class="ev-detail-desc">${esc(event.description || '')}</p>
        <dl class="ev-detail-grid">
          <div><dt>${icon('clock', 14)} ${esc(te('detail.when'))}</dt><dd>${esc(EV().dateLabel(event, getLang()))}</dd></div>
          <div><dt>${icon('pin', 14)} ${esc(te('detail.where'))}</dt><dd>${esc(event.venue || '—')}${event.neighborhood ? ` · ${esc(event.neighborhood)}` : ''}</dd></div>
          <div><dt>${icon('ticket', 14)} ${esc(te('detail.price'))}</dt><dd>${esc(EV().priceLabel(event, getLang()))}${event.originalPrice ? ` <s>${esc(new Intl.NumberFormat('fr-FR').format(event.originalPrice))} FCFA</s>` : ''}</dd></div>
          <div><dt>${icon('store', 14)} ${esc(te('detail.organizer'))}</dt><dd>${esc(event.organizer || '—')}</dd></div>
          <div><dt>${icon('shield', 14)} ${esc(te('card.reliability', { n: event.reliability || 0 }))}</dt><dd>${reliabilityBar(event.reliability || 0)}</dd></div>
        </dl>
        ${tier !== 'high' ? `<p class="ev-note is-warn">${icon('alert', 14)} ${esc(te('detail.missing'))}</p>` : ''}
        <div class="ev-detail-actions">
          <button type="button" class="btn btn-primary" data-ev-ics="${esc(event.id)}">${icon('download', 16)} ${esc(te('card.agenda'))}</button>
          <a class="btn btn-ghost" href="${esc(EV().whatsappShare(event))}" target="_blank" rel="noopener">${icon('whatsapp', 16)} ${esc(te('card.share'))}</a>
          <a class="btn btn-ghost" href="${esc(EV().mapsUrl(event))}" target="_blank" rel="noopener">${icon('route', 16)} Google Maps</a>
          <a class="btn btn-ghost" href="${esc(EV().wazeUrl(event))}" target="_blank" rel="noopener">${icon('route', 16)} Waze</a>
          ${safeUrl(event.sourceUrl) ? `<a class="btn btn-ghost" href="${esc(safeUrl(event.sourceUrl))}" target="_blank" rel="noopener nofollow">${icon('external', 15)} ${esc(te('detail.sourceLink'))}</a>` : ''}
        </div>
        <div class="ev-detail-foot">
          ${
            reported
              ? `<p class="ev-note is-ok">${icon('check', 14)} ${esc(te('detail.reported'))}</p>`
              : `<details class="ev-report">
                  <summary>${icon('alert', 14)} ${esc(te('detail.report'))}</summary>
                  <form class="ev-report-form" data-ev-report-form data-event-id="${esc(event.id)}">
                    <label class="ev-field">
                      <span>${esc(te('detail.reason'))}</span>
                      <select name="reason">${reasons.map(([value, label]) => `<option value="${value}">${esc(label)}</option>`).join('')}</select>
                    </label>
                    <button type="submit" class="btn btn-danger-soft btn-sm">${icon('send', 14)} ${esc(te('detail.send'))}</button>
                    <span class="ev-form-status" role="status"></span>
                  </form>
                </details>`
          }
        </div>
      </div>`;

    ui.lastFocus = document.activeElement;
    modal.hidden = false;
    modal.classList.add('is-open');
    document.body.classList.add('has-modal');
    card.querySelector('[data-ev-close]')?.focus();
    bindModal(card);
  }

  function closeDetail() {
    const modal = document.getElementById('ev-modal');
    if (!modal || modal.hidden) return;
    modal.classList.remove('is-open');
    modal.hidden = true;
    document.body.classList.remove('has-modal');
    if (ui.lastFocus instanceof HTMLElement) ui.lastFocus.focus({ preventScroll: true });
  }

  function bindModal(card) {
    card.onclick = (event) => {
      if (event.target.closest('[data-ev-close]')) {
        closeDetail();
        return;
      }
      const ics = event.target.closest('[data-ev-ics]');
      if (ics) downloadIcs(ics.dataset.evIcs);
    };

    // Propriété (et non addEventListener) : `card` est réutilisé à chaque
    // ouverture, un écouteur cumulatif enverrait plusieurs signalements.
    card.onsubmit = async (event) => {
      const form = event.target.closest('[data-ev-report-form]');
      if (!form) return;
      event.preventDefault();
      const status = $('.ev-form-status', form);
      const eventId = form.dataset.eventId;
      const reason = form.querySelector('select[name="reason"]')?.value || 'other';
      const result = await EV().reportEvent(eventId, reason, '', { lang: getLang() });
      if (result.ok) {
        if (status) {
          status.textContent = te('detail.reported');
          status.classList.add('is-ok');
        }
        form.querySelector('button')?.setAttribute('disabled', 'disabled');
        toast(te('detail.reported'));
      } else {
        if (status) status.textContent = result.error?.message || te('toast.error');
        toast(result.error?.message || te('toast.error'), 'error');
      }
    };
  }

  /* ==========================================================================
     9. Actions (agenda, partage, chat, formulaires)
     ========================================================================== */

  function downloadIcs(id) {
    const event = EV() && EV().get(id);
    if (!event) return;
    const blob = new Blob([EV().buildIcs(event)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${String(event.id || 'evenement').replace(/[^\w-]/g, '-')}.ics`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(te('home.icsDone'));
  }

  function toast(message, variant = 'ok') {
    const region = document.getElementById('toast-region');
    if (!region) return;
    const item = document.createElement('div');
    item.className = `toast${variant === 'error' ? ' is-error' : ''}`;
    item.innerHTML = `
      <span class="toast-icon">${icon(variant === 'error' ? 'alert' : 'check', 18)}</span>
      <span class="toast-message">${esc(message)}</span>
      <button type="button" class="toast-close" aria-label="${esc(te('detail.close'))}">${icon('x', 16)}</button>`;
    region.appendChild(item);
    const remove = () => {
      item.classList.add('is-leaving');
      setTimeout(() => item.remove(), 220);
    };
    item.querySelector('.toast-close')?.addEventListener('click', remove);
    setTimeout(remove, 4200);
  }

  function formatQuota(error) {
    if (!error) return te('toast.error');
    if (error.code === 'rate_limited') {
      const minutes = Math.max(1, Math.ceil((error.retryAfter || 60) / 60));
      return (error.message || '').replace(/\s*$/, '') || te('quota.chat', { when: ` ${minutes} min` });
    }
    return error.message || te('toast.error');
  }

  async function ask(question) {
    const text = String(question || '').trim();
    if (!text || ui.chat.busy) return;
    ui.chat.messages.push({ role: 'user', text });
    ui.chat.busy = true;
    refreshChat();

    const result = await EV().chat(text, { lang: getLang() });
    ui.chat.busy = false;

    if (result.ok) {
      ui.chat.messages.push({
        role: 'bot',
        text: result.answer,
        events: result.events || [],
        // La réponse vient toujours de la base ; une reformulation IA en
        // échec ne change rien à sa validité, on ne l’annonce donc pas comme
        // une panne.
        note:
          EV().getState().mode === 'demo'
            ? te('chat.demoAnswer')
            : te('chat.source', { n: (result.events || []).length }),
      });
      if (Number.isFinite(result.remaining)) ui.chat.remaining = result.remaining;
    } else {
      ui.chat.messages.push({
        role: 'bot',
        text: formatQuota(result.error),
        error: result.error?.code === 'rate_limited',
      });
    }
    refreshChat();
  }

  function refreshChat() {
    // Le composant est remplacé à chaque échange : on le retrouve par le DOM
    // plutôt que de garder une référence qui deviendrait obsolète.
    const host = document.querySelector('[data-events-page] .ev-chat');
    if (!host) return;
    const holder = document.createElement('div');
    holder.innerHTML = chatTemplate();
    const fresh = holder.firstElementChild;
    host.replaceWith(fresh);
    // Conserver la saisie en cours et le focus après un nouvel échange.
    const input = $('.ev-chat-form input', fresh);
    if (input && ui.chat.busy === false) input.focus({ preventScroll: true });
    const last = $('.ev-chat-log', fresh);
    if (last) last.scrollTop = last.scrollHeight;
    bindChat(fresh);
  }

  function bindChat(root) {
    const form = $('[data-ev-chat-form]', root);
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const input = form.querySelector('input[name="question"]');
        const value = input?.value || '';
        if (input) input.value = '';
        ask(value);
      });
    }
    $$('[data-ev-ask]', root).forEach((button) => {
      button.addEventListener('click', () => ask(button.dataset.evAsk));
    });
  }

  /* ------------------------------ Formulaire ------------------------------- */

  function formValues(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    data.deal = Boolean(form.querySelector('input[name="deal"]')?.checked);
    return data;
  }

  async function handlePublish(form) {
    const status = $('.ev-form-status', form);
    const values = formValues(form);
    if (!values.title || !values.startsAt || !values.venue || !values.organizer) {
      if (status) status.textContent = te('publish.required');
      return;
    }
    // Bamako = UTC+0 : on interprète explicitement la saisie en UTC, sinon un
    // navigateur situé dans un autre fuseau décalerait l’événement.
    const parseLocal = (value) => {
      if (!value) return null;
      const text = String(value);
      return new Date(text.length === 16 ? `${text}:00Z` : text);
    };
    const start = parseLocal(values.startsAt);
    if (!start || Number.isNaN(start.getTime())) {
      if (status) status.textContent = te('publish.required');
      return;
    }
    const end = parseLocal(values.endsAt) || new Date(start.getTime() + 2 * 3600 * 1000);
    if (Number.isNaN(end.getTime()) || end <= start) {
      if (status) status.textContent = te('publish.dateError');
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    if (status) status.textContent = te('publish.sending');

    const result = await EV().submitEvent(
      {
        title: values.title,
        category: values.category,
        description: values.description,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        venue: values.venue,
        neighborhood: values.neighborhood,
        price: Number(values.price) || 0,
        organizer: values.organizer,
        contact: values.contact,
        sourceUrl: values.sourceUrl,
        image: values.image,
        deal: values.deal,
        sourceKind: ui.draft?.sourceKind === 'poster' ? 'poster' : 'organizer',
      },
      { lang: getLang() }
    );

    if (button) button.disabled = false;
    if (result.ok) {
      if (status) {
        status.textContent = te('publish.ok');
        status.classList.add('is-ok');
      }
      toast(te('publish.ok'));
      form.reset();
      ui.draft = null;
      const adminList = $('.ev-admin-list');
      if (adminList) adminList.outerHTML = `<div class="ev-admin-list">${adminPanelList()}</div>`;
    } else {
      const message = formatQuota(result.error);
      if (status) {
        status.textContent = message;
        status.classList.remove('is-ok');
      }
      toast(message, 'error');
    }
  }

  function adminPanelList() {
    const local = EV().submissions().filter((item) => item.status === 'pending');
    // En production, la file vient du serveur ; en démonstration, du stockage
    // local. Les deux ont exactement la même forme.
    const pending = ui.admin.remote.length ? ui.admin.remote : local;
    return pending.length
      ? pending
          .map(
            (item) => `
          <article class="ev-admin-item" data-sub="${esc(item.id)}">
            <div>
              <strong>${esc(item.payload.title)}</strong>
              <small>${esc(te('admin.submitted', { date: EV().humanDate(item.createdAt, getLang()) }))} · ${esc(item.payload.venue || '')}</small>
            </div>
            <div class="ev-admin-actions">
              <button type="button" class="btn btn-primary btn-sm" data-ev-review="${esc(item.id)}" data-ev-action="approve">${icon('check', 14)} ${esc(te('admin.approve'))}</button>
              <button type="button" class="btn btn-danger-soft btn-sm" data-ev-review="${esc(item.id)}" data-ev-action="reject">${icon('x', 14)} ${esc(te('admin.reject'))}</button>
            </div>
          </article>`
          )
          .join('')
      : emptyState(te('admin.empty'), { iconName: 'shield' });
  }

  /** Réduit une image côté client avant l’envoi (limite serveur : 4,5 Mo). */
  function downscaleImage(file, maxSize = 1400, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('decode'));
        img.onload = () => {
          const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
          const width = Math.max(1, Math.round(img.width * ratio));
          const height = Math.max(1, Math.round(img.height * ratio));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          if (!context) {
            resolve(String(reader.result));
            return;
          }
          context.drawImage(img, 0, 0, width, height);
          let type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          let dataUrl = canvas.toDataURL(type, type === 'image/png' ? undefined : quality);
          // Un PNG photographique peut rester énorme : on repasse en JPEG si
          // la limite serveur (4,5 Mo) risque d’être dépassée.
          if (dataUrl.length * 0.75 > 4_300_000) {
            type = 'image/jpeg';
            dataUrl = canvas.toDataURL(type, 0.78);
          }
          resolve(dataUrl);
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleImport(form) {
    const status = $('.ev-form-status', form);
    const file = form.querySelector('input[name="poster"]')?.files?.[0];
    const link = form.querySelector('input[name="link"]')?.value || '';
    const text = form.querySelector('textarea[name="text"]')?.value || '';
    if (!file && !link.trim() && !text.trim()) {
      if (status) status.textContent = te('import.none');
      return;
    }

    ui.import.busy = true;
    if (status) status.textContent = te('import.analyzing');
    let imageDataUrl = '';
    if (file) {
      try {
        imageDataUrl = await downscaleImage(file);
      } catch (error) {
        if (status) status.textContent = te('toast.error');
        ui.import.busy = false;
        return;
      }
    }

    const result = await EV().importDraft(
      { text, link, imageName: file?.name || '', imageDataUrl },
      { lang: getLang() }
    );
    ui.import.busy = false;

    if (result.ok) {
      ui.draft = { ...result.draft };
      ui.import.notice = result.notice || te('import.notice');
      ui.import.missing = result.missing || [];
      // Ouvre et pré-remplit le formulaire de publication.
      const page = document.querySelector('[data-events-page]');
      const publish = document.getElementById('ev-publish');
      if (publish) publish.open = true;
      const publishForm = $('[data-ev-publish-form]', page);
      if (publishForm && ui.draft) fillPublishForm(publishForm, ui.draft);
      if (publish) publish.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast(te('import.fill'));
    } else {
      ui.import.notice = formatQuota(result.error);
      ui.import.missing = [];
      toast(ui.import.notice, 'error');
    }

    const page = document.querySelector('[data-events-page]');
    const details = document.getElementById('ev-import');
    if (page && details) {
      const holder = document.createElement('div');
      holder.innerHTML = pageTemplate();
      const fresh = holder.querySelector('#ev-import');
      if (fresh) {
        fresh.open = true;
        details.replaceWith(fresh);
        bindPanels(page);
      }
    }
  }

  function fillPublishForm(form, draft) {
    const set = (name, value) => {
      const field = form.elements[name];
      if (field) field.value = value ?? '';
    };
    set('title', draft.title);
    set('category', draft.category || 'concert');
    set('organizer', draft.organizer);
    set('venue', draft.venue);
    set('neighborhood', draft.neighborhood || 'Bamako');
    set('price', draft.price ?? 0);
    set('contact', draft.contact);
    set('sourceUrl', draft.sourceUrl);
    set('description', draft.description);
    if (draft.startsAt) set('startsAt', String(draft.startsAt).slice(0, 16));
    if (draft.endsAt) set('endsAt', String(draft.endsAt).slice(0, 16));
    const deal = form.elements.deal;
    if (deal) deal.checked = Boolean(draft.deal);
  }

  /** Charge la file de validation (serveur en live, local en démo). */
  async function loadAdminQueue(token) {
    ui.admin.token = token || ui.admin.token;
    const result = await EV().adminQueue({ token: ui.admin.token });
    if (result.ok) {
      ui.admin.remote = result.mode === 'live' ? result.submissions : [];
      ui.admin.error = '';
    } else {
      ui.admin.remote = [];
      ui.admin.error = result.error?.message || te('admin.badToken');
    }
    const list = document.querySelector('.ev-admin-list');
    if (list) list.innerHTML = adminPanelList();
    return result;
  }

  async function handleReview(button) {
    const id = button.dataset.evReview;
    const action = button.dataset.evAction;
    const typed = document.querySelector('.ev-admin-bar input[name="token"]')?.value.trim() || '';
    const token = typed || ui.admin.token || (EV() ? EV().adminToken() : '');
    if (!token) {
      toast(te('admin.badToken'), 'error');
      return;
    }
    button.disabled = true;
    const result = await EV().reviewSubmission(id, action, action === 'approve' ? { reliability: 95 } : {}, { token });
    button.disabled = false;
    if (result.ok) {
      toast(action === 'approve' ? te('admin.approved') : te('admin.rejected'));
      ui.admin.remote = ui.admin.remote.filter((item) => String(item.id) !== String(id));
      const list = $('.ev-admin-list');
      if (list) list.innerHTML = adminPanelList();
      rerenderBody();
      // En production, on relit la file serveur pour refléter les autres
      // propositions traitées entre-temps.
      if (EV().getState().mode === 'live') loadAdminQueue(token);
    } else {
      toast(result.error?.message || te('admin.badToken'), 'error');
    }
  }

  /* ==========================================================================
     10. Écouteurs
     ========================================================================== */

  function bindPanels(main) {
    const publishForm = $('[data-ev-publish-form]', main);
    if (publishForm) {
      publishForm.onsubmit = (event) => {
        event.preventDefault();
        handlePublish(publishForm);
      };
    }
    const importForm = $('[data-ev-import-form]', main);
    if (importForm) {
      importForm.onsubmit = (event) => {
        event.preventDefault();
        handleImport(importForm);
      };
    }
    const adminForm = $('[data-ev-admin-form]', main);
    if (adminForm) {
      adminForm.onsubmit = (event) => {
        event.preventDefault();
        const token = adminForm.querySelector('input[name="token"]')?.value.trim() || '';
        const status = $('.ev-form-status', adminForm);
        ui.admin.token = token;
        EV().setAdminToken(token);
        ui.admin.open = true;
        if (token) {
          if (status) {
            status.textContent = te('admin.connect') + '…';
            status.classList.remove('is-ok');
          }
          loadAdminQueue(token).then((result) => {
            if (status) {
              status.textContent = result.ok ? '✓' : te('admin.badToken');
              status.classList.toggle('is-ok', result.ok);
            }
          });
          const details = document.getElementById('ev-admin');
          if (details) details.open = true;
        } else {
          if (status) status.textContent = te('admin.badToken');
        }
      };
    }
    // Les boutons de validation sont recréés après chaque action : on passe
    // par la délégation posée sur #main (voir bindPage).
  }

  function bindPage(main) {
    // Recherche (immédiate, sans recharger la page).
    const search = $('#ev-search', main);
    if (search) {
      let timer;
      search.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          ui.q = search.value.trim();
          rerenderBody();
        }, 180);
      });
    }

    const cat = $('#ev-cat', main);
    if (cat) {
      cat.addEventListener('change', () => {
        ui.category = cat.value;
        rerenderBody();
      });
    }
    const hood = $('#ev-hood', main);
    if (hood) {
      hood.addEventListener('change', () => {
        ui.hood = hood.value;
        rerenderBody();
      });
    }

    bindChat(main);
    bindPanels(main);

    // Délégation : filtres, vues, dates, cartes, mois.
    main.onclick = (event) => {
      const target = event.target;

      const review = target.closest('[data-ev-review]');
      if (review) {
        handleReview(review);
        return;
      }

      const filter = target.closest('[data-ev-filter]');
      if (filter) {
        const value = filter.dataset.evFilter;
        if (value === 'all') {
          resetFilters();
        } else if (value === 'free') {
          ui.free = !ui.free;
          ui.day = '';
        } else if (value === 'deal') {
          ui.deal = !ui.deal;
          ui.day = '';
        } else {
          ui.range = ui.range === value ? 'all' : value;
          ui.day = '';
        }
        rerenderBody();
        return;
      }

      const view = target.closest('[data-ev-view]');
      if (view) {
        ui.view = view.dataset.evView;
        const body = $('.ev-body', main);
        if (body) {
          destroyMap();
          const all = visibleEvents();
          body.innerHTML = ui.view === 'list' ? listView(all) : ui.view === 'calendar' ? calendarView(all) : mapView(all);
          if (ui.view === 'map') mountMap();
        }
        $$('.ev-view', main).forEach((button) => {
          const active = button.dataset.evView === ui.view;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-pressed', String(active));
        });
        return;
      }

      const month = target.closest('[data-ev-month]');
      if (month) {
        const next = currentMonth();
        next.m += Number(month.dataset.evMonth);
        if (next.m < 0) {
          next.m = 11;
          next.y -= 1;
        } else if (next.m > 11) {
          next.m = 0;
          next.y += 1;
        }
        ui.day = '';
        ui.month = next;
        rerenderBody();
        return;
      }

      const day = target.closest('[data-ev-day]');
      if (day) {
        ui.day = ui.day === day.dataset.evDay ? '' : day.dataset.evDay;
        rerenderBody();
        return;
      }

      const reset = target.closest('[data-ev-reset]');
      if (reset) {
        resetFilters();
        rerenderBody();
        return;
      }

      const ics = target.closest('[data-ev-ics]');
      if (ics) {
        downloadIcs(ics.dataset.evIcs);
        return;
      }

      const open = target.closest('[data-ev-open]');
      if (open) {
        openDetail(open.dataset.evOpen);
        return;
      }

      const scroll = target.closest('[data-ev-scroll]');
      if (scroll) {
        const panel = document.getElementById(`ev-${scroll.dataset.evScroll}`);
        if (panel) {
          panel.open = true;
          panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }

      if (target.closest('[data-ev-close]')) closeDetail();
    };

    // Échap ferme la fiche.
    main.onkeydown = (event) => {
      if (event.key === 'Escape') closeDetail();
    };
  }

  /* ==========================================================================
     11. Section d’accueil « Ce soir à Bamako »
     ========================================================================== */

  function homeTemplate() {
    const events = tonightEvents(3);
    return `
      <section class="home-events" aria-labelledby="home-events-title">
        <div class="section-head">
          <div>
            <p class="eyebrow">${icon('sparkle', 14)} ${esc(te('home.eyebrow'))}</p>
            <h2 id="home-events-title">${esc(te('home.title'))}</h2>
            <p>${esc(te('home.sub'))}</p>
          </div>
          <a class="section-link" href="#/evenements">${esc(te('home.all'))} ${icon('chevronRight', 16)}</a>
        </div>
        ${
          events.length
            ? `<div class="home-events-grid">${events.map((event) => eventCard(event, { compact: true })).join('')}</div>`
            : `<div class="ev-empty"><span class="ev-empty-icon">${icon('calendar', 24)}</span><p>${esc(te('home.empty'))}</p><a class="btn btn-ghost btn-sm" href="#/evenements">${esc(te('home.all'))}</a></div>`
        }
      </section>`;
  }

  function mountHome(container) {
    if (!container) return;
    container.innerHTML = homeTemplate();
    container.onclick = (event) => {
      const ics = event.target.closest('[data-ev-ics]');
      if (ics) {
        downloadIcs(ics.dataset.evIcs);
        return;
      }
      const open = event.target.closest('[data-ev-open]');
      if (open) {
        // La fiche s’ouvre après le rendu de la page (voir render()).
        ui.pendingOpen = open.dataset.evOpen;
        if (location.hash.startsWith('#/evenements')) {
          render(document.getElementById('main'));
        } else {
          location.hash = '#/evenements';
        }
      }
    };
  }

  /* ==========================================================================
     12. API publique + amorçage
     ========================================================================== */

  window.BamaHubEventsUI = {
    /** Rend la page complète dans #main. */
    render,
    /** Rend la section d’accueil dans son conteneur. */
    mountHome,
    /** Ouvre une fiche (lien profond #/evenements?id=…). */
    openDetail,
    /** Réinitialise les filtres (utile pour les tests). */
    resetFilters,
    te,
  };

  function boot() {
    if (!EV() || !window.BamaHubEventsUI) return;
    EV()
      .init()
      .then(() => {
        // Jeton admin mémorisé ; en démonstration on préremplit le jeton
        // pédagogique pour que la file de validation soit utilisable.
        ui.admin.token = EV().adminToken() || (EV().getState().mode === 'demo' ? 'demo-admin' : '');

        // Le premier rendu a pu précéder le chargement des données : on
        // redessine la page (et la section d'accueil) avec la base réelle.
        const page = document.querySelector('[data-events-page]');
        const main = document.getElementById('main');
        if (page && main) {
          const scrollTop = window.scrollY;
          render(main);
          window.scrollTo({ top: scrollTop, behavior: 'auto' });
        }
        const slot = document.getElementById('home-events-slot');
        if (slot && slot.isConnected) mountHome(slot);

        // File de validation : uniquement si un jeton est déjà mémorisé.
        if (ui.admin.token) loadAdminQueue(ui.admin.token);

      })
      .catch((error) => console.warn('[events-ui] init', error));

    // Redessiner avec la bonne langue.
    if (I18N()) {
      I18N().onChange(() => {
        if (document.querySelector('[data-events-page]')) {
          const main = document.getElementById('main');
          if (main) render(main);
        }
        const home = document.getElementById('home-events-slot');
        if (home && home.isConnected) mountHome(home);
      });
    }

    // Fermer proprement la carte quand on quitte la route.
    window.addEventListener('hashchange', () => {
      if (!location.hash.startsWith('#/evenements')) {
        destroyMap();
        closeDetail();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeDetail();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
