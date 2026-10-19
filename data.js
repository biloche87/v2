/**
 * ============================================================================
 *  BamaHub — Données & configuration
 *  Annuaire local de Bamako (Mali)
 * ============================================================================
 *
 *  ARCHITECTURE GÉNÉRIQUE
 *  ----------------------
 *  Tout commerce est un objet « listing » :
 *
 *    {
 *      id, name, category, subcategories[], neighborhood, address, phone,
 *      description, rating, reviews, createdAt, coords,
 *      fields: { ...valeurs des champs propres à la catégorie }
 *    }
 *
 *  Chaque catégorie est décrite par UN SEUL objet dans CATEGORIES :
 *  couleur, icône SVG, sous-catégories et champs spécifiques.
 *  Pour ajouter une catégorie, il suffit donc d'ajouter un objet à ce tableau :
 *  la grille d'accueil, les filtres, la fiche détail et le formulaire d'ajout
 *  s'adaptent automatiquement.
 *
 *  Types de champs disponibles :
 *    - text / textarea / number / select / boolean
 *    - price: true   → champ utilisé pour le budget et le prix affiché sur la carte
 *    - money: true   → ajoute « FCFA » à l'affichage
 *    - prefix/suffix → ex. « dès », « / nuit », « personnes »
 *    - badge: '…'    → affiche un badge sur la carte quand le booléen est vrai
 *    - required: true
 * ============================================================================
 */

const CATEGORIES = [
  {
    id: 'restaurants',
    label: 'Restaurants',
    singular: 'Restaurant',
    color: '#ea580c',
    tagline: 'Tables locales & saveurs du monde',
    icon: `
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
      <path d="M7 2v20"/>
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
    `,
    subcategories: ['Cuisine malienne', 'Grillades', 'Poisson braisé', 'Fast-food', 'Pâtisserie & café'],
    fields: [
      {
        key: 'menu',
        label: 'Menu & tarifs',
        type: 'textarea',
        placeholder: 'Un plat par ligne, ex. Riz au gras — 2 500 FCFA',
        hint: 'Une ligne par plat : la fiche s’affichera sous forme de liste.',
      },
      {
        key: 'platDuJour',
        label: 'Plat du jour',
        type: 'text',
        placeholder: 'Ex. Riz au gras au poulet + jus de bissap',
      },
      {
        key: 'averagePrice',
        label: 'Prix moyen par personne',
        type: 'number',
        money: true,
        price: true,
        prefix: '≈',
        min: 0,
        step: 500,
        placeholder: '2 500',
      },
      {
        key: 'reservation',
        label: 'Réservation possible',
        type: 'boolean',
        valueLabels: { true: 'Oui, par téléphone', false: 'Sans réservation' },
      },
    ],
  },
  {
    id: 'hotels',
    label: 'Hôtels',
    singular: 'Hôtel',
    color: '#4f46e5',
    tagline: 'Dormir bien, au cœur de Bamako',
    icon: `
      <path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/>
      <path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/>
      <path d="M12 4v6"/>
      <path d="M2 18h20"/>
    `,
    subcategories: ['Hôtel', 'Résidence', 'Auberge', 'Maison d’hôtes'],
    fields: [
      {
        key: 'pricePerNight',
        label: 'Prix par nuit',
        type: 'number',
        money: true,
        price: true,
        prefix: 'dès',
        suffix: '/ nuit',
        min: 0,
        step: 500,
        placeholder: '25 000',
        required: true,
      },
      {
        key: 'rooms',
        label: 'Nombre de chambres',
        type: 'number',
        suffix: 'chambres',
        min: 1,
        placeholder: '24',
      },
      {
        key: 'amenities',
        label: 'Équipements & services',
        type: 'textarea',
        placeholder: 'Wi-Fi gratuit, piscine, restaurant, navette aéroport…',
      },
    ],
  },
  {
    id: 'pharmacies',
    label: 'Pharmacies',
    singular: 'Pharmacie',
    color: '#059669',
    tagline: 'Soins, garde et conseils de proximité',
    icon: `
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
      <path d="m8.5 8.5 7 7"/>
    `,
    subcategories: ['Pharmacie de quartier', 'Parapharmacie', 'Grossiste'],
    fields: [
      {
        key: 'onDuty',
        label: 'Pharmacie de garde',
        type: 'boolean',
        badge: 'De garde',
        valueLabels: { true: 'De garde aujourd’hui', false: 'Pas de garde aujourd’hui' },
      },
      {
        key: 'openingHours',
        label: 'Horaires d’ouverture',
        type: 'text',
        placeholder: 'Ex. Lun – Dim · 8h – 22h',
      },
      {
        key: 'pharmacyServices',
        label: 'Services disponibles',
        type: 'textarea',
        placeholder: 'Vaccins, prise de tension, parapharmacie, conseils…',
      },
    ],
  },
  {
    id: 'boutiques',
    label: 'Boutiques',
    singular: 'Boutique',
    color: '#db2777',
    tagline: 'Tissus, épicerie et artisanat',
    icon: `
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
      <path d="M3 6h18"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    `,
    subcategories: ['Tissus & bazin', 'Épicerie', 'Prêt-à-porter', 'Artisanat'],
    fields: [
      {
        key: 'products',
        label: 'Produits phares',
        type: 'textarea',
        placeholder: 'Bazin riche, wax, accessoires de couture…',
      },
      {
        key: 'priceFrom',
        label: 'À partir de',
        type: 'number',
        money: true,
        price: true,
        prefix: 'dès',
        min: 0,
        step: 500,
        placeholder: '2 500',
      },
      {
        key: 'delivery',
        label: 'Livraison à Bamako',
        type: 'boolean',
        badge: 'Livraison',
        valueLabels: { true: 'Disponible', false: 'Retrait en boutique' },
      },
    ],
  },
  {
    id: 'salons',
    label: 'Coiffure & beauté',
    singular: 'Salon',
    color: '#c026d3',
    tagline: 'Coiffure, soins et bien-être',
    icon: `
      <circle cx="6" cy="6" r="3"/>
      <path d="M8.12 8.12 12 12"/>
      <path d="M20 4 8.12 15.88"/>
      <circle cx="6" cy="18" r="3"/>
      <path d="M14.8 14.8 20 20"/>
    `,
    subcategories: ['Coiffure femme', 'Barbershop', 'Onglerie', 'Soins & spa'],
    fields: [
      {
        key: 'salonServices',
        label: 'Prestations & tarifs',
        type: 'textarea',
        placeholder: 'Tresses — 10 000 FCFA, soin capillaire — 5 000 FCFA…',
      },
      {
        key: 'priceFrom',
        label: 'Prestation à partir de',
        type: 'number',
        money: true,
        price: true,
        prefix: 'dès',
        min: 0,
        step: 500,
        placeholder: '5 000',
      },
      {
        key: 'homeService',
        label: 'Service à domicile',
        type: 'boolean',
        badge: 'À domicile',
        valueLabels: { true: 'Disponible sur rendez-vous', false: 'Uniquement au salon' },
      },
    ],
  },
  {
    id: 'garages',
    label: 'Garages',
    singular: 'Garage',
    color: '#0284c7',
    tagline: 'Réparer, entretenir, repartir',
    icon: `
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    `,
    subcategories: ['Mécanique auto', 'Carrosserie', 'Vulcanisation', 'Vidange & entretien'],
    fields: [
      {
        key: 'garageServices',
        label: 'Prestations',
        type: 'textarea',
        placeholder: 'Diagnostic, freinage, climatisation, carrosserie…',
      },
      {
        key: 'priceFrom',
        label: 'Main-d’œuvre à partir de',
        type: 'number',
        money: true,
        price: true,
        prefix: 'dès',
        min: 0,
        step: 500,
        placeholder: '7 500',
      },
      {
        key: 'towing',
        label: 'Remorquage / dépannage',
        type: 'boolean',
        badge: 'Dépannage 24/7',
        valueLabels: { true: 'Dépannage 24h/24', false: 'Sur place uniquement' },
      },
    ],
  },
  {
    id: 'ecoles',
    label: 'Écoles',
    singular: 'École',
    color: '#0d9488',
    tagline: 'Apprendre et grandir à Bamako',
    icon: `
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>
      <path d="M22 10v6"/>
      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>
    `,
    subcategories: ['Crèche', 'Primaire', 'Secondaire', 'Supérieur', 'Formation professionnelle'],
    fields: [
      {
        key: 'levels',
        label: 'Niveaux enseignés',
        type: 'text',
        placeholder: 'Maternelle, primaire, collège…',
      },
      {
        key: 'tuition',
        label: 'Frais de scolarité',
        type: 'number',
        money: true,
        price: true,
        prefix: 'dès',
        suffix: '/ an',
        min: 0,
        step: 5000,
        placeholder: '275 000',
      },
      {
        key: 'enrollmentOpen',
        label: 'Inscriptions ouvertes',
        type: 'boolean',
        badge: 'Inscriptions ouvertes',
        valueLabels: { true: 'Ouvertes', false: 'Sur liste d’attente' },
      },
    ],
  },
  {
    id: 'services',
    label: 'Services',
    singular: 'Service',
    color: '#475569',
    tagline: 'Plombiers, électriciens et artisans fiables',
    icon: `
      <path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9"/>
      <path d="m18 15 4-4"/>
      <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>
    `,
    subcategories: ['Plomberie', 'Électricité', 'Froid & climatisation', 'Menuiserie', 'Peinture'],
    fields: [
      {
        key: 'serviceList',
        label: 'Services proposés',
        type: 'textarea',
        placeholder: 'Fuites, installations sanitaires, chauffe-eau…',
      },
      {
        key: 'priceFrom',
        label: 'Déplacement / intervention',
        type: 'number',
        money: true,
        price: true,
        prefix: 'dès',
        min: 0,
        step: 500,
        placeholder: '5 000',
      },
      {
        key: 'urgent',
        label: 'Urgences 24h/24',
        type: 'boolean',
        badge: 'Urgences 24/7',
        valueLabels: { true: 'Disponible 24h/24', false: 'Aux horaires d’ouverture' },
      },
    ],
  },
  {
    id: 'evenements',
    label: 'Événements',
    singular: 'Événement',
    color: '#b45309',
    tagline: 'Salles, traiteurs et grands jours',
    icon: `
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
      <path d="M13 5v2"/>
      <path d="M13 17v2"/>
      <path d="M13 11v2"/>
    `,
    subcategories: ['Salle de fête', 'Traiteur', 'Décoration', 'Photographie', 'Animation'],
    fields: [
      {
        key: 'eventTypes',
        label: 'Types d’événements',
        type: 'text',
        placeholder: 'Mariages, baptêmes, séminaires…',
      },
      {
        key: 'capacity',
        label: 'Capacité d’accueil',
        type: 'number',
        suffix: 'personnes',
        min: 1,
        placeholder: '300',
      },
      {
        key: 'priceFrom',
        label: 'Tarif de départ',
        type: 'number',
        money: true,
        price: true,
        prefix: 'dès',
        min: 0,
        step: 500,
        placeholder: '150 000',
      },
    ],
  },
];

const NEIGHBORHOODS = [
  'Hamdallaye',
  'ACI 2000',
  'Badalabougou',
  'Kalaban Coura',
  'Magnambougou',
  'Quartier du fleuve',
];

/**
 * 20 adresses de démonstration réparties dans six quartiers de Bamako.
 * Les coordonnées sont approximatives : elles servent au lien « Itinéraire ».
 */
const LISTINGS = [
  {
    id: 'le-baobab',
    name: 'Le Baobab',
    category: 'restaurants',
    subcategories: ['Cuisine malienne', 'Grillades'],
    neighborhood: 'Hamdallaye',
    address: 'Hamdallaye ACI 2000, Rue 421',
    phone: '+223 66 12 34 56',
    whatsapp: '22366123456',
    hours: 'Lun – Dim · 11h – 23h',
    description:
      'Une table conviviale où le tô, le riz au gras et les brochettes se partagent en famille. Terrasse ombragée et ambiance chaleureuse au cœur de Hamdallaye.',
    rating: 4.8,
    reviews: 214,
    createdAt: '2026-10-12',
    coords: [12.6394, -8.0135],
    fields: {
      menu:
        'Riz au gras au poulet — 2 500 FCFA\nCapitaine braisé — 4 500 FCFA\nBrochettes de bœuf — 1 500 FCFA\nTô à la sauce gombo — 1 750 FCFA\nJus de bissap — 500 FCFA',
      platDuJour: 'Riz au gras au poulet + jus de bissap',
      averagePrice: 2500,
      reservation: true,
    },
  },
  {
    id: 'faso-grill',
    name: 'Faso Grill',
    category: 'restaurants',
    subcategories: ['Grillades', 'Fast-food'],
    neighborhood: 'ACI 2000',
    address: 'ACI 2000, Rue 138, face à la place de l’Indépendance',
    phone: '+223 76 45 67 89',
    whatsapp: '22376456789',
    hours: 'Lun – Sam · 11h30 – 23h',
    description:
      'Le rendez-vous des amateurs de grillades à ACI 2000 : brochettes marinées, poulet yassa et burgers généreux servis rapidement.',
    rating: 4.6,
    reviews: 158,
    createdAt: '2026-09-28',
    coords: [12.6183, -8.0276],
    fields: {
      menu:
        'Brochettes de mouton — 2 000 FCFA\nPoulet yassa — 3 500 FCFA\nBurger Faso — 3 000 FCFA\nFrites maison — 1 000 FCFA\nPlantains grillés — 750 FCFA',
      platDuJour: 'Poulet yassa + plantains grillés',
      averagePrice: 4000,
      reservation: false,
    },
  },
  {
    id: 'capitaine-bleu',
    name: 'Capitaine Bleu',
    category: 'restaurants',
    subcategories: ['Poisson braisé', 'Cuisine malienne'],
    neighborhood: 'Quartier du fleuve',
    address: 'Quartier du fleuve, près du Pont des Martyrs',
    phone: '+223 78 90 12 34',
    hours: 'Mar – Dim · 12h – 23h',
    description:
      'Face au fleuve Niger, Capitaine Bleu célèbre le poisson frais : capitaine grillé, crevettes et brochettes de tilapia. Vue imprenable au coucher du soleil.',
    rating: 4.7,
    reviews: 186,
    createdAt: '2026-08-19',
    coords: [12.6314, -7.9951],
    fields: {
      menu:
        'Capitaine grillé — 6 000 FCFA\nCrevettes sautées — 7 500 FCFA\nTilapia braisé — 5 000 FCFA\nAttiéké — 1 000 FCFA\nDessert du jour — 1 500 FCFA',
      platDuJour: 'Capitaine grillé, sauce citron-gingembre',
      averagePrice: 6000,
      reservation: true,
    },
  },
  {
    id: 'hotel-teriya',
    name: 'Hôtel Teriya',
    category: 'hotels',
    subcategories: ['Hôtel'],
    neighborhood: 'ACI 2000',
    address: 'ACI 2000, Rue 138, Bamako',
    phone: '+223 44 90 12 34',
    whatsapp: '22344901234',
    hours: 'Réception 24h/24',
    description:
      'Un hôtel d’affaires calme à deux pas des institutions. Chambres climatisées, piscine, restaurant et navette aéroport sur demande.',
    rating: 4.7,
    reviews: 302,
    createdAt: '2026-10-02',
    coords: [12.6189, -8.0269],
    fields: {
      pricePerNight: 35000,
      rooms: 42,
      amenities:
        'Wi-Fi gratuit\nPiscine extérieure\nRestaurant & bar\nNavette aéroport\nSalle de réunion\nParking sécurisé',
    },
  },
  {
    id: 'auberge-du-fleuve',
    name: 'Auberge du Fleuve',
    category: 'hotels',
    subcategories: ['Auberge', 'Maison d’hôtes'],
    neighborhood: 'Quartier du fleuve',
    address: 'Quartier du fleuve, Rue 20, Bamako',
    phone: '+223 20 22 45 67',
    hours: 'Réception 24h/24',
    description:
      'Une petite auberge pleine de charme, avec une terrasse donnant sur le fleuve. Idéale pour un séjour simple et central, petit-déjeuner inclus.',
    rating: 4.5,
    reviews: 127,
    createdAt: '2026-07-30',
    coords: [12.6321, -7.9972],
    fields: {
      pricePerNight: 22000,
      rooms: 18,
      amenities:
        'Wi-Fi\nPetit-déjeuner inclus\nTerrasse vue fleuve\nVentilateur & climatisation\nBagagerie',
    },
  },
  {
    id: 'pharmacie-de-la-paix',
    name: 'Pharmacie de la Paix',
    category: 'pharmacies',
    subcategories: ['Pharmacie de quartier', 'Parapharmacie'],
    neighborhood: 'Hamdallaye',
    address: 'Hamdallaye, face au marché de quartier',
    phone: '+223 66 45 78 90',
    whatsapp: '22366457890',
    hours: 'Lun – Dim · 8h – 22h',
    description:
      'Pharmacie de proximité tenue par une équipe attentionnée. De garde cette semaine, avec un service de conseil et de parapharmacie.',
    rating: 4.6,
    reviews: 89,
    createdAt: '2026-10-15',
    coords: [12.641, -8.0118],
    fields: {
      onDuty: true,
      openingHours: 'Lun – Dim · 8h – 22h · Garde de nuit',
      pharmacyServices:
        'Vaccination\nPrise de tension\nParapharmacie\nConseils mère-enfant',
    },
  },
  {
    id: 'pharmacie-aci-2000',
    name: 'Pharmacie ACI 2000',
    category: 'pharmacies',
    subcategories: ['Pharmacie de quartier'],
    neighborhood: 'ACI 2000',
    address: 'ACI 2000, Rue 138, près du rond-point',
    phone: '+223 79 23 45 67',
    hours: 'Lun – Sam · 8h – 20h',
    description:
      'Une officine moderne et bien achalandée au centre d’ACI 2000, avec un accueil rapide et des conseils personnalisés.',
    rating: 4.4,
    reviews: 75,
    createdAt: '2026-06-14',
    coords: [12.6168, -8.0241],
    fields: {
      onDuty: false,
      openingHours: 'Lun – Sam · 8h – 20h',
      pharmacyServices:
        'Médicaments génériques\nParapharmacie\nMatériel médical\nPrise de tension',
    },
  },
  {
    id: 'pharmacie-du-carrefour',
    name: 'Pharmacie du Carrefour',
    category: 'pharmacies',
    subcategories: ['Pharmacie de quartier', 'Parapharmacie'],
    neighborhood: 'Badalabougou',
    address: 'Badalabougou Est, Rue 102',
    phone: '+223 65 34 56 78',
    whatsapp: '22365345678',
    hours: 'Lun – Dim · 8h – 23h',
    description:
      'Au carrefour de Badalabougou Est, une pharmacie de garde réputée pour sa disponibilité et son rayon parapharmacie bien fourni.',
    rating: 4.7,
    reviews: 103,
    createdAt: '2026-09-05',
    coords: [12.6229, -7.9922],
    fields: {
      onDuty: true,
      openingHours: 'Lun – Dim · 8h – 23h · Garde',
      pharmacyServices:
        'Garde de nuit\nVaccins\nParapharmacie\nSoins infirmiers de base',
    },
  },
  {
    id: 'boutique-diarra',
    name: 'Boutique Diarra',
    category: 'boutiques',
    subcategories: ['Tissus & bazin', 'Prêt-à-porter'],
    neighborhood: 'Badalabougou',
    address: 'Badalabougou Est, Rue 115, Bamako',
    phone: '+223 66 78 90 12',
    hours: 'Lun – Sam · 9h – 19h',
    description:
      'Le paradis du bazin riche et du wax. Mamadou Diarra sélectionne les plus beaux tissus de Bamako depuis vingt ans, avec conseil et retouches.',
    rating: 4.8,
    reviews: 64,
    createdAt: '2026-10-08',
    coords: [12.6235, -7.9911],
    fields: {
      products:
        'Bazin riche getzner\nWax hollandais\nPrêt-à-porter femme\nAccessoires & bijoux\nRetouches sur mesure',
      priceFrom: 2500,
      delivery: false,
    },
  },
  {
    id: 'kadi-market',
    name: 'Kadi Market',
    category: 'boutiques',
    subcategories: ['Épicerie'],
    neighborhood: 'ACI 2000',
    address: 'ACI 2000, Rue 224, Bamako',
    phone: '+223 76 12 34 56',
    whatsapp: '22376123456',
    hours: 'Lun – Dim · 8h – 21h',
    description:
      'L’épicerie fine du quartier : produits frais, boissons importées et articles introuvables ailleurs. Livraison gratuite dès 15 000 FCFA à ACI 2000.',
    rating: 4.5,
    reviews: 112,
    createdAt: '2026-08-25',
    coords: [12.622, -8.0293],
    fields: {
      products:
        'Produits frais\nÉpicerie fine\nBoissons importées\nProduits bio\nConserves & surgelés',
      priceFrom: 1000,
      delivery: true,
    },
  },
  {
    id: 'salon-djeneba',
    name: 'Salon Djeneba',
    category: 'salons',
    subcategories: ['Coiffure femme', 'Soins & spa'],
    neighborhood: 'Hamdallaye',
    address: 'Hamdallaye, Rue 319, Bamako',
    phone: '+223 78 23 45 67',
    whatsapp: '22378234567',
    hours: 'Mar – Dim · 9h – 20h',
    description:
      'Tresses, nattes, tissages et soins capricieux : Djeneba et son équipe subliment les cheveux avec des produits naturels, dans un cadre apaisant.',
    rating: 4.9,
    reviews: 156,
    createdAt: '2026-10-01',
    coords: [12.6377, -8.0164],
    fields: {
      salonServices:
        'Tresses & nattes — dès 10 000 FCFA\nTissage — dès 15 000 FCFA\nSoin capillaire — 5 000 FCFA\nMise en plis — 7 500 FCFA\nManucure — 4 000 FCFA',
      priceFrom: 5000,
      homeService: true,
    },
  },
  {
    id: 'barber-king',
    name: 'Barber King',
    category: 'salons',
    subcategories: ['Barbershop'],
    neighborhood: 'Magnambougou',
    address: 'Magnambougou, route de Ségou, Bamako',
    phone: '+223 69 45 67 89',
    hours: 'Lun – Sam · 9h – 21h',
    description:
      'Coupes nettes, dégradés précis et ambiance hip-hop. Le barbershop de référence à Magnambougou pour une coupe qui tient toute la semaine.',
    rating: 4.6,
    reviews: 98,
    createdAt: '2026-07-11',
    coords: [12.6468, -7.9392],
    fields: {
      salonServices:
        'Coupe homme — 2 000 FCFA\nDégradé — 2 500 FCFA\nBarbe & contours — 1 500 FCFA\nCoupe enfant — 1 500 FCFA',
      priceFrom: 2000,
      homeService: false,
    },
  },
  {
    id: 'garage-auto-plus',
    name: 'Garage Auto Plus',
    category: 'garages',
    subcategories: ['Mécanique auto', 'Vidange & entretien'],
    neighborhood: 'Kalaban Coura',
    address: 'Kalaban Coura ACI, Rue 59, Bamako',
    phone: '+223 66 90 12 34',
    whatsapp: '22366901234',
    hours: 'Lun – Sam · 7h30 – 19h',
    description:
      'Un garage sérieux et équipé pour les véhicules citadins comme pour les 4×4. Diagnostic électronique, vidange et dépannage 24h/24.',
    rating: 4.5,
    reviews: 81,
    createdAt: '2026-09-18',
    coords: [12.5978, -7.9828],
    fields: {
      garageServices:
        'Diagnostic électronique\nVidange & filtres\nFreinage\nClimatisation auto\nDépannage & remorquage 24h/24',
      priceFrom: 7500,
      towing: true,
    },
  },
  {
    id: 'mecanique-mamadou',
    name: 'Mécanique Mamadou',
    category: 'garages',
    subcategories: ['Carrosserie', 'Mécanique auto'],
    neighborhood: 'Magnambougou',
    address: 'Magnambougou, près du marché, Bamako',
    phone: '+223 70 34 56 78',
    hours: 'Lun – Sam · 8h – 18h30',
    description:
      'Carrosserie, peinture au pistolet et réparation moteur : Mamadou travaille avec patience et propose des devis clairs avant chaque intervention.',
    rating: 4.7,
    reviews: 67,
    createdAt: '2026-06-27',
    coords: [12.6492, -7.9425],
    fields: {
      garageServices:
        'Carrosserie\nPeinture au pistolet\nTôlerie\nRéparation moteur\nPetits travaux de soudure',
      priceFrom: 5000,
      towing: false,
    },
  },
  {
    id: 'ecole-les-etoiles',
    name: 'Groupe Scolaire Les Étoiles',
    category: 'ecoles',
    subcategories: ['Primaire', 'Secondaire'],
    neighborhood: 'Badalabougou',
    address: 'Badalabougou Ouest, Rue 88, Bamako',
    phone: '+223 20 21 34 56',
    hours: 'Lun – Ven · 7h30 – 17h',
    description:
      'Un groupe scolaire à taille humaine, de la maternelle au collège. Classes bilingues français-anglais, cantine et soutien scolaire inclus.',
    rating: 4.6,
    reviews: 54,
    createdAt: '2026-09-22',
    coords: [12.6207, -7.9977],
    fields: {
      levels: 'Maternelle, primaire et collège',
      tuition: 275000,
      enrollmentOpen: true,
    },
  },
  {
    id: 'institut-faso-tech',
    name: 'Institut Faso Tech',
    category: 'ecoles',
    subcategories: ['Supérieur', 'Formation professionnelle'],
    neighborhood: 'ACI 2000',
    address: 'ACI 2000, Rue 445, Bamako',
    phone: '+223 44 91 23 45',
    whatsapp: '22344912345',
    hours: 'Lun – Ven · 8h – 18h · Sam 9h – 13h',
    description:
      'Formations professionnalisantes en informatique, gestion et génie civil. Un campus moderne, des stages en entreprise et 92 % d’insertion à six mois.',
    rating: 4.8,
    reviews: 73,
    createdAt: '2026-08-06',
    coords: [12.6245, -8.0212],
    fields: {
      levels: 'Licences & masters : informatique, gestion, génie civil',
      tuition: 850000,
      enrollmentOpen: true,
    },
  },
  {
    id: 'plomberie-konate',
    name: 'Plomberie Konaté',
    category: 'services',
    subcategories: ['Plomberie'],
    neighborhood: 'Kalaban Coura',
    address: 'Kalaban Coura ACI, Rue 214, Bamako',
    phone: '+223 66 23 45 67',
    whatsapp: '22366234567',
    hours: 'Lun – Dim · 7h – 20h · Urgences 24h/24',
    description:
      'Fuites, chauffe-eau, pompes et installations sanitaires : une intervention rapide partout à Bamako, avec un devis annoncé avant les travaux.',
    rating: 4.8,
    reviews: 142,
    createdAt: '2026-10-10',
    coords: [12.5963, -7.9857],
    fields: {
      serviceList:
        'Recherche de fuites\nInstallation sanitaire\nChauffe-eau & pompes\nDébouchage\nRénovation de salle de bain',
      priceFrom: 5000,
      urgent: true,
    },
  },
  {
    id: 'elec-pro-bamako',
    name: 'Élec’Pro Bamako',
    category: 'services',
    subcategories: ['Électricité', 'Froid & climatisation'],
    neighborhood: 'Magnambougou',
    address: 'Magnambougou, secteur 3, Bamako',
    phone: '+223 76 56 78 90',
    whatsapp: '22376567890',
    hours: 'Lun – Sam · 8h – 19h',
    description:
      'Installations électriques aux normes, dépannage de groupes électrogènes et entretien de climatiseurs. Une équipe réactive pour les particuliers et les entreprises.',
    rating: 4.7,
    reviews: 119,
    createdAt: '2026-09-12',
    coords: [12.6441, -7.9356],
    fields: {
      serviceList:
        'Installation électrique\nDépannage & mise aux normes\nGroupes électrogènes\nClimatisation & froid\nÉclairage LED',
      priceFrom: 7500,
      urgent: true,
    },
  },
  {
    id: 'espace-traore',
    name: 'Espace Traoré',
    category: 'evenements',
    subcategories: ['Salle de fête', 'Décoration'],
    neighborhood: 'Kalaban Coura',
    address: 'Kalaban Coura, Rue 340, Bamako',
    phone: '+223 78 67 89 01',
    hours: 'Tous les jours · 9h – 00h',
    description:
      'Une salle de fête modulable pouvant accueillir 350 invités, avec scène, espace traiteur et parking. Décoration et sonorisation disponibles sur place.',
    rating: 4.8,
    reviews: 46,
    createdAt: '2026-10-05',
    coords: [12.5991, -7.9796],
    fields: {
      eventTypes: 'Mariages, baptêmes, séminaires, concerts',
      capacity: 350,
      priceFrom: 150000,
    },
  },
  {
    id: 'traiteur-awa',
    name: 'Traiteur Awa',
    category: 'evenements',
    subcategories: ['Traiteur', 'Animation'],
    neighborhood: 'Hamdallaye',
    address: 'Hamdallaye ACI 2000, Rue 512, Bamako',
    phone: '+223 66 34 56 78',
    whatsapp: '22366345678',
    hours: 'Tous les jours · 8h – 21h',
    description:
      'Cuisine malienne et internationale pour vos grands jours : buffets, cocktails d’entreprise et services de table soignés, du devis à la dernière assiette.',
    rating: 4.9,
    reviews: 58,
    createdAt: '2026-09-30',
    coords: [12.6368, -8.0152],
    fields: {
      eventTypes: 'Mariages, baptêmes, cocktails d’entreprise',
      capacity: 200,
      priceFrom: 4500,
    },
  },
];

// Exposé globalement pour les scripts classiques (sans module).
window.BamaHubData = { CATEGORIES, NEIGHBORHOODS, LISTINGS };
