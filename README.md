# BamaHub

**L’annuaire local de Bamako (Mali).** Restaurants, hôtels, pharmacies de garde,
boutiques, salons de coiffure/beauté, garages, écoles, services (plombier,
électricien) et événements — réunis dans une application web légère, mobile first,
avec mode sombre.

Aucun framework, aucun build : des fichiers statiques ouvrables directement
dans un navigateur, une identité de marque vectorisée et un manifeste PWA.

---

## Sommaire

- [Lancer le projet](#lancer-le-projet)
- [Fonctionnalités](#fonctionnalités)
- [Nouveautés v2](#nouveautés-v2)
- [Module Événements & bons plans IA](#module-événements--bons-plans-ia)
- [Cartes & géolocalisation](#cartes--géolocalisation)
- [Identité visuelle & logo](#identité-visuelle--logo)
- [Connexion & inscription](#connexion--inscription)
- [Structure des fichiers](#structure-des-fichiers)
- [Architecture des données](#architecture-des-données)
- [Ajouter une catégorie](#ajouter-une-catégorie)
- [Ajouter une adresse de démonstration](#ajouter-une-adresse-de-démonstration)
- [Personnalisation](#personnalisation)
- [Raccourcis et accessibilité](#raccourcis-et-accessibilité)
- [Données de démonstration](#données-de-démonstration)

---

## Lancer le projet

Le site fonctionne **sans installation** :

```bash
# option 1 — ouvrir directement le fichier
xdg-open index.html        # macOS : open index.html

# option 2 — servir le dossier (recommandé)
python3 -m http.server 8000
# puis http://localhost:8000
```

> Le stockage local (favoris, adresses ajoutées, thème, comptes) fonctionne aussi
> en `file://`, mais un petit serveur HTTP reste plus proche des conditions
> réelles (favicon, manifeste et service worker mis à part).

---

## Fonctionnalités

| Page | Contenu |
| --- | --- |
| **Accueil** (`#/`) | Hero + recherche, grille des 9 catégories, « Derniers ajouts », « Populaires », exploration par quartier, appel à l’action |
| **Explorateur** (`#/explorer`) | Recherche plein texte (nom, description, menu, quartier, repère…), filtres catégorie / sous-catégorie / quartier, filtres rapides (« De garde », « Livraison », « Urgences 24/7 »…), tri (pertinence, note, récents, prix, distance), compteur de résultats, filtres actifs supprimables, **bascule Liste / Carte** |
| **Fiche détail** (`#/adresse/:id`) | Badges, note et avis, description, champs spécifiques à la catégorie (menu, prix/nuit, garde…), contacts cliquables (tél., WhatsApp), **mini-carte**, **repère**, itinéraires **Google Maps et Waze**, **partage de la position sur WhatsApp**, partage, favori, suppression des adresses créées localement, adresses similaires |
| **Ajout** (`#/ajouter`) | Formulaire en 3 étapes, champs dynamiques selon la catégorie, sous-catégories à cocher, **repère**, **position exacte sur une carte** (clic ou « Ma position »), aperçu en direct de la fiche, validation, publication immédiate |
| **Favoris** (`#/favoris`) | Adresses enregistrées dans le navigateur, suppression unitaire ou globale |
| **Connexion / inscription** (`#/connexion`, `#/inscription`) | Fenêtre modale avec illustration de marque, compte local, session mémorisée, compte de démonstration |

Détails d’expérience :

- **Mode sombre** avec bouton dédié, mémorisé dans `localStorage` et respect de
  `prefers-color-scheme` au premier chargement.
- **Mobile first** : navigation inférieure fixe sur téléphone, grille de cartes
  responsive (1 → 2 → 3 colonnes), cibles tactiles ≥ 40 px.
- **Recherche insensible aux accents** (« pharmacie » = « Pharmacie »,
  « hopital » = « hôpital »).
- **Animations légères** (apparition des pages, survol des cartes, transition de
  thème) désactivées automatiquement avec `prefers-reduced-motion`.
- **Favoris et adresses ajoutées persistants** via `localStorage` (aucun serveur,
  aucun compte).
- **Toasts** avec action « Annuler » (retrait d’un favori) et « Voir ».
- **URL partageables** : chaque filtre de l’explorateur est reflété dans le hash,
  chaque fiche possède sa propre adresse.


---


---

## Nouveautés v2

Quatorze fonctions ont été ajoutées sans framework ni étape de build. Le cœur
reste les quatre fichiers (`index.html`, `style.css`, `app.js`, `data.js`) ; la
traduction est isolée dans `translations.js` et les bibliothèques tierces sont
auto-hébergées.

| Fonction | Où / comment l’essayer |
| --- | --- |
| **1. Bilingue français / bambara** | Bouton globe dans l’en-tête et la fenêtre Réglages. Le choix est mémorisé (`bamahub:lang`) et s’applique à l’interface, aux filtres, aux fiches et aux messages. |
| **2. « Ouvert » / « Ferme bientôt »** | Badge calculé depuis `hours` (60 min de préavis), filtre rapide `quick=open`, recalcul automatique chaque minute. |
| **3. WhatsApp pré-rempli** | Bouton sur chaque fiche (« Commander » pour un restaurant, « Réserver » pour un hôtel) avec message contenant le nom, la catégorie et le quartier. Repli sur `listing.phone` si `whatsapp` est absent. |
| **4. Pharmacies de garde** | Filtre rapide `quick=duty` + bandeau d’appel en haut de l’explorateur. Piloté par le champ booléen `onDuty` de la catégorie Pharmacies. |
| **5. Économiseur de données** | Réglages → « Économiseur de données » (`auto` / `on` / `off`). En mode actif, les cartes chargent les variantes `-sm.webp`, `loading="lazy"` et le réglage « sans images » les remplace par un visuel de catégorie. |
| **6. Recherche vocale** | Micro dans la recherche d’accueil et l’explorateur (Web Speech API, `fr-FR`). Repli sur la saisie clavier avec un message si le navigateur ne la supporte pas. |
| **7. Plat / offre du jour** | Depuis une fiche restaurant, publication d’un plat du jour (nom + prix + photo). La carte apparaît sur l’accueil, datée du jour, et se réinitialise le lendemain. |
| **8. Promos & coupons** | Bandeau promo sur la fiche, code copiable et **QR code** à présenter en caisse. Les promos publiées localement complètent celles de `data.js`. |
| **9. Avis** | Note 1–5, texte, photo optionnelle, mention « Avis vérifié » (compte connecté), vote utile, signalement avec motif. Les avis locaux sont fusionnés avec ceux de `data.js`. |
| **10. Indice de confiance** | Score 0–100 : complétude de la fiche (45), qualité et volume des avis (35), ancienneté (20). Affiché sur les cartes et les fiches. |
| **11. Comparateur** | Jusqu’à 3 adresses via le bouton « Comparer » des cartes, puis `#/comparer?ids=a,b,c`. Tableau aligné ligne par ligne, meilleure valeur surlignée. |
| **12. QR par adresse + affiche** | Bouton « QR / affiche » sur la fiche : feuille imprimable (`#print-root`) avec le QR, le nom, l’adresse, le téléphone et le coupon éventuel. `window.print()` puis nettoyage automatique. |
| **13. Page de partage** | `partage/<slug>.html` : page statique avec `og:title`, `og:description`, `og:image` absolue, WhatsApp et redirection vers `index.html#/adresse/<slug>` après 1,4 s. À régénérer si les fiches changent (voir plus bas). |
| **14. Suggestions** | Les recherches et fiches consultées alimentent un historique local (cap 40). L’accueil et l’explorateur proposent des requêtes et des adresses proches de cet historique. |

### Fichiers ajoutés

```
translations.js               Dictionnaires FR / BM + t(), tData(), apply(),
                              setLang() — expose window.BamaHubI18n
assets/vendor/qrcode/         qrcode-generator 2.0.4 (MIT), auto-hébergé
assets/photos/                18 visuels WebP (960×640 et variantes -sm)
partage/                      22 pages Open Graph, une par adresse
```

`index.html` charge, dans l’ordre : Leaflet (+ markercluster), `data.js`,
`events-data.js`, `translations.js`, `qrcode.js`, `app.js`, puis
`events-ui.js`. Aucune étape de compilation n’est requise ; les pages
`#/evenements` restent utilisables même si `events-ui.js` ne se charge pas
(message de repli explicite).

### Stockage local v2

Tout reste dans le navigateur, sans serveur ni compte distant :

| Clé | Contenu |
| --- | --- |
| `bamahub:lang` | `fr` ou `bm` |
| `bamahub:reviews` | avis publiés localement, par adresse |
| `bamahub:reports` | signalements d’avis |
| `bamahub:promos` | coupons publiés localement |
| `bamahub:daily-offers` | plats du jour publiés |
| `bamahub:history` | historique de recherche et de consultation |
| `bamahub:compare` | ids du comparateur (3 maximum) |
| `bamahub:datasaver` / `bamahub:images` | préférences d’images |

Pour repartir de zéro : `localStorage.clear()` dans la console, puis recharger.
Le compte de démonstration (`demo@bamahub.ml` / `bamako2026`) reste disponible.

### Régénérer les pages de partage

Les fichiers de `partage/` sont statiques (les robots sociaux n’exécutent pas
JavaScript). Après une modification des fiches, les régénérer avec le script
`tools/build-share-pages.js` — ou adapter à la main `og:title`,
`og:description`, `og:image` et l’URL de redirection.

---

## Module Événements & bons plans IA

Un agenda bilingue pour Bamako, alimenté **deux fois par jour** par une tâche
planifiée (06:00 et 15:00, heure de Bamako = UTC+0), stocké dans Supabase et lu
par les visiteurs **sans aucun appel IA**. Le module est volontairement isolé :
si le backend n’est pas configuré, le site reste entièrement fonctionnel en
**mode démonstration** avec un jeu d’exemple réaliste et la même interface.

### Ce que voient les visiteurs

| Fonction | Où / comment l’essayer |
| --- | --- |
| **Agenda filtrable** | `#/evenements` ou « Événements » dans la navigation. Filtres Aujourd’hui / Ce soir / Ce week-end / Gratuit / Bon plan, catégorie, quartier, recherche libre. |
| **Trois vues** | **Liste** (cartes avec date, lieu, prix et indice de fiabilité), **Calendrier** mensuel cliquable (pastilles par catégorie), **Carte** Leaflet avec épingles regroupées et itinéraires Google Maps / Waze. |
| **Assistant en langage naturel** | « Que faire samedi ? », « Un concert gratuit ce soir », « Événements à Badalabougou ». La réponse est construite depuis la base ; les cartes renvoient vers la fiche et la source. |
| **Fiche détaillée** | Dates, lieu, tarif, organisateur, indice de fiabilité, **source cliquable**, bouton « Signaler » (mauvaise date, mauvais lieu, annulé, douteux). |
| **Badges de confiance** | « Vérifié » (source officielle ou validation humaine) ou « **Détecté par IA, à confirmer** » pour les suggestions automatiques. L’indice 0–100 est visible partout. |
| **Import par affiche** | Photo, lien ou texte collé → Gemini remplit la fiche → l’utilisateur **relit et corrige** → la proposition part en validation. |
| **Publier mon événement** | Formulaire gratuit (titre, catégorie, dates, lieu, quartier, prix, organisateur, contact, source). Toute proposition passe par la file de validation. |
| **Accueil « Ce soir à Bamako »** | Trois idées du soir avec **Ajouter à mon agenda** (.ics), **Partager sur WhatsApp** et **Itinéraire**. |
| **Quotas lisibles** | Limites par utilisateur avec message clair et délai d’attente : chat 30/h et 150/jour, imports 6/h, publications 5/jour, signalements 20/h (valeurs serveur, réglables). |

Toutes les chaînes basculent en **bambara** avec le bouton de langue, y compris
les cartes, le calendrier, le chat, les formulaires et les messages d’erreur.

### Architecture

```
Utilisateur ──► index.html / app.js
                     │  (route #/evenements)
                     ▼
               events-ui.js  ── interface, filtres, calendrier, carte
                     │
                     ▼
               events-data.js ── cache local + bascule démo ⇄ live
                     │  fetch /api/*
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ Netlify Functions (netlify/functions/)                           │
│  events          GET  liste publique (cache 60 s)                │
│  chat            POST réponse ancrée sur la base (+ quota)       │
│  import-event    POST affiche → brouillon (Gemini vision)        │
│  submit-event    POST proposition d’organisateur                 │
│  report-event    POST signalement                                │
│  admin-events    GET/POST file de validation (jeton)             │
│  refresh-events  tâche planifiée 06:00 & 15:00                   │
│  health          GET diagnostic sans secret                      │
└───────────────┬──────────────────────────────┬───────────────────┘
                │ PostgREST (service_role)     │ REST Gemini
                ▼                              ▼
          Supabase (events, submissions,   Gemini 2.5 Flash
          reports, rate_limits)            (+ Google Search si dispo)
```

**Aucune clé n’est présente dans le navigateur** : `GEMINI_API_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` et `ADMIN_TOKEN` ne sont lus que par les fonctions.
Les visites ne déclenchent aucun appel IA : elles lisent la table `events`.

### Mise en service

1. **Créer le schéma** — coller `supabase/schema.sql` dans l’éditeur SQL de
   Supabase (tables, index, RLS, fonction atomique `consume_rate_limit`).
   `supabase/seed.sql` ajoute six événements de démonstration facultatifs
   (`delete from public.events where source_kind = 'seed';` pour les retirer).
2. **Déclarer les variables d’environnement** dans Netlify
   (*Site configuration → Environment variables*) :

   | Variable | Rôle | Défaut |
   | --- | --- | --- |
   | `SUPABASE_URL` | URL du projet (`https://xxx.supabase.co`) | — |
   | `SUPABASE_SERVICE_ROLE_KEY` | clé service role, **jamais** exposée au client | — |
   | `GEMINI_API_KEY` | clé Google AI Studio | — |
   | `GEMINI_MODEL` | modèle principal | `gemini-2.5-flash` |
   | `GEMINI_FALLBACK_MODELS` | modèles de repli, séparés par des virgules | `gemini-2.0-flash,gemini-1.5-flash` |
   | `GEMINI_CHAT` | `1` pour activer la reformulation Gemini du chat | `0` |
   | `GEMINI_TIMEOUT_MS` | délai maximal par appel | `25000` |
   | `ADMIN_TOKEN` | jeton du panneau de validation | — |
   | `SITE_URL` | URL publique (liens absolus) | `https://bamahub.ml` |
   | `CHAT_LIMIT_PER_HOUR` / `_DAY` | quotas du chat | `30` / `150` |
   | `IMPORT_LIMIT_PER_HOUR` | imports d’affiches | `6` |
   | `SUBMIT_LIMIT_PER_DAY` | publications | `5` |
   | `REPORT_LIMIT_PER_HOUR` | signalements | `20` |

   Les fonctions synchrones sont dimensionnées pour la limite Netlify de
   10 secondes (import d’affiche : 9 s, reformulation du chat : 6 s).
   `refresh-events` dispose de 30 s : 14 s pour la veille, 6 s au maximum pour
   la structuration des propositions. Un dépassement renvoie une erreur propre
   (`timeout`, `degraded`) au lieu d’être coupé au milieu d’une écriture.

3. **Déployer** — `netlify.toml` publie la racine du dépôt, bundle
   `netlify/functions/` et redirige `/api/*` vers les fonctions. La planification
   est déclarée sur `refresh-events` (`0 6,15 * * *`, UTC = heure de Bamako).

En local : `netlify dev` sert le site et les fonctions sur
`http://localhost:8888` ; sans variables, toutes les routes répondent
proprement `503 not_configured` et l’interface reste en démonstration.
Déclenchement manuel de la veille :

```bash
curl -X POST https://<site>/.netlify/functions/refresh-events \
  -H "x-admin-token: $ADMIN_TOKEN"
```

### Contrat d’API

| Route | Corps / paramètres | Réponse |
| --- | --- | --- |
| `GET /api/events` | `limit`, `range`, `free=1`, `deal=1`, `cat`, `q`, `id` | `{ ok, events[], count, generatedAt, mode }` |
| `POST /api/chat` | `{ question, lang, sessionId, clientTime }` | `{ ok, answer, events[], intent, remaining, degraded }` |
| `POST /api/import-event` | `{ text, link, imageDataUrl, imageName, lang }` | `{ ok, draft, confidence, missing[], notice }` |
| `POST /api/submit-event` | fiche complète + `sourceKind` | `201 { ok, submission, remaining }` |
| `POST /api/report-event` | `{ eventId, reason, note }` | `{ ok, message }` |
| `GET/POST /api/admin-events` | en-tête `x-admin-token` | file d’attente / `{ ok, status, event }` |
| `GET /api/health` | — | état des services, sans secret |

Erreurs : `400` (validation), `401` (jeton), `405`, `413` (image > 4,5 Mo),
`429` + `Retry-After` (quota), `503 not_configured` (backend absent),
`502` (base ou Gemini indisponible). Le client bascule alors en démo ou affiche
un message lisible, jamais une trace technique.

### Déduplication et purge

- **Clé métier** `dedupe_key` = empreinte FNV-1a du titre normalisé + jour +
  lieu, unique en base.
- Sont aussi fusionnés : même `source_url`, ou titre très proche (Jaccard ≥ 0,62)
  à moins de 36 h d’écart. Le doublon le plus fiable enrichit la ligne existante
  (source, image, score) sans écraser un statut « vérifié ».
- Les événements terminés depuis plus de 6 h sont supprimés à chaque passage de
  `refresh-events` ; la lecture publique filtre également le passé.
- Une proposition `pending` ou `rejected` n’est jamais exposée publiquement.

### Mode démonstration

Sans backend, `events-data.js` génère **24 événements d’exemple** (dates
relatives, donc toujours crédibles), dont deux événements passés qui servent à
vérifier la purge. Tout fonctionne : chat local, filtres, calendrier, carte,
import par analyse de texte, publication, validation, quotas et .ics. Le bandeau
« Démonstration · données d’exemple » et la réponse du chat le signalent
explicitement — **aucun serveur n’est appelé**.

- Jeton de validation de démonstration : `demo-admin` (prérempli dans le
  panneau « Validation des propositions »).
- Clés de stockage : `bamahub:events:local`, `:submissions`, `:reports`,
  `:limits`, `:device`, `:admin`.
- L’import d’affiche sans backend utilise une extraction **par mots-clés**,
  annoncée comme telle ; les images sont réduites côté client (max 1400 px,
  JPEG 0,82) avant tout envoi.

### Sécurité et limites assumées

- La clé Gemini et la clé service role ne quittent jamais le serveur ; le
  panneau admin compare `ADMIN_TOKEN` en temps constant. Pour ouvrir la
  validation à des organisateurs, remplacer ce jeton par **Netlify Identity**
  ou **Supabase Auth** (le reste du flux est inchangé).
- RLS activée sur les quatre tables, aucune politique publique : la clé `anon`
  ne lit rien. Si le site doit un jour interroger PostgREST directement, ajouter
  une politique `select` limitée aux statuts publics.
- La veille IA ne publie jamais en « vérifié » : les découvertes Gemini sont
  plafonnées à 88/100 et restent « à confirmer » jusqu’à validation humaine.
- Les quotas par IP + session sont doublés d’un compteur mémoire de secours
  (utile en `netlify dev`), la source de vérité restant Postgres.

### Vérifications

Les tests de développement couvrent le mode démo et le contrat client ↔ serveur :

```bash
node --check events-data.js && node --check events-ui.js
node --check netlify/lib/*.mjs netlify/functions/*.mjs
npm install --no-save jsdom   # une seule fois, pour les deux tests d’interface
# harnais jsdom : accueil, filtres, calendrier, carte, chat, fiche, publication,
# validation admin, bascule BM, quotas
node tools/tests/events-ui.test.js
# contrat live avec un fetch simulé (prix price_fcfa, chat, import, submit)
node tools/tests/live-contract.test.js
# fonctions Netlify sans clés : 503/401/429/413, dédoublonnage, purge
node tools/tests/functions.test.mjs
# faux PostgREST en mémoire : lecture, chat, publication, validation, purge, 429
node tools/tests/server-flow.test.mjs
# carte Leaflet réelle : création, bascule de vue, destruction
node tools/tests/map.test.js
```


---
## Cartes & géolocalisation

La carte repose sur **Leaflet 1.9.4** et **Leaflet.markercluster 1.5.3**,
auto-hébergés dans `assets/vendor/leaflet/` (aucun CDN, **aucune clé API**), avec
les tuiles d’**OpenStreetMap**.

### Trois usages

| Contexte | Contenu |
| --- | --- |
| Explorateur, mode **Carte** | Tous les résultats filtrés, épingles colorées par catégorie et regroupées en clusters ; clic sur une épingle → fiche, itinéraires et partage |
| **Autour de moi** | Position du navigateur, cercle de rayon, adresses triées par distance et limitées à **500 m / 1 km / 5 km** |
| Fiche & formulaire | Mini-carte de l’adresse ; dans le formulaire, clic sur la carte ou bouton **« Ma position »** pour placer le pin (déplaçable) |

### Distances

La distance est calculée côté client avec la **formule de Haversine**
(`R = 6 371 km`), sans service externe :

```js
haversine(12.6392, -8.0029, 12.6450, -7.9970); // ≈ 850 mètres
formatDistance(850);                            // « 850 m »
formatDistance(1240);                           // « 1,2 km »
```

La vue choisie est reflétée dans l’URL : `#/explorer?vue=carte` ouvre
directement la carte, ce qui permet de partager un lien.

Le mode « Autour de moi » utilise `navigator.geolocation` avec
`enableHighAccuracy`, un délai de 12 s et des messages d’erreur explicites en cas
de refus ou d’indisponibilité. **La position reste en mémoire** : elle n’est ni
stockée ni transmise à un serveur.

> La géolocalisation exige un contexte sécurisé : `http://localhost` ou HTTPS.
> En `file://`, la carte s’affiche mais le navigateur peut refuser la position.

### Itinéraires et partage

- **Google Maps** : `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>`
- **Waze** : `https://www.waze.com/ul?ll=<lat>%2C<lng>&navigate=yes&zoom=17`
- **WhatsApp** : message pré-rempli avec le nom, le quartier, l’adresse, le
  **repère** et le lien de la position, via `https://wa.me/?text=…`

### Coordonnées et repères

Chaque adresse peut porter :

```js
coords: [12.6394, -8.0135],                     // [latitude, longitude]
landmark: 'En face de la pharmacie de Hamdallaye' // repère utile
```

Beaucoup de rues de Bamako ne portent pas de nom : le **repère** est donc un
champ de premier plan, affiché sur la fiche, dans la popup de la carte et dans
le message WhatsApp. Les adresses sans coordonnées restent visibles en liste et
dans la recherche ; la carte indique simplement combien d’adresses n’ont pas de
position.

### Tuiles OpenStreetMap

Les tuiles sont chargées depuis `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
avec l’attribution obligatoire « © OpenStreetMap contributors ». Hors connexion,
elles ne se chargent pas : les épingles, les distances et les itinéraires restent
utilisables et un message discret le signale. Ce projet de démonstration
génère un trafic négligeable ; pour un déploiement à forte audience, utilisez un
fournisseur de tuiles ou un cache conforme à la
[politique d’utilisation d’OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/).

Le mode sombre applique un filtre CSS aux tuiles (inversion + rotation de teinte)
pour rester lisible sans second jeu de tuiles.

---

## Identité visuelle & logo

Le logo (épingle de localisation + « B » stylisé + mot-symbole bicolore) est
décliné dans **`assets/logo/`**. Tous les fichiers SVG sont **vectorisés** à
partir du logo fourni : ils restent nets à toutes les tailles et sur tous les
écrans (aucune perte à l'agrandissement).

| Fichier | Usage |
| --- | --- |
| `logo.svg` | Lockup horizontal — en-tête desktop, documents |
| `logo-white.svg` | Version blanche — pied de page, fonds sombres |
| `logo-stacked.svg` / `logo-stacked-white.svg` | Version empilée — splash, réseaux sociaux |
| `mark.svg` / `mark-white.svg` / `mark-white-orange.svg` | Pictogramme seul |
| `icon.svg` | Tuile d'application (base des PNG) |
| `icon.png`, `icon-192.png`, `icon-512.png` | Icônes PWA |
| `icon-maskable-512.png` | Icône maskable Android (zone de sécurité respectée) |
| `apple-touch-icon.png` | Icône iOS (180 × 180, fond plein) |
| `favicon-16.png`, `favicon-32.png`, `favicon-48.png` | Favicons |
| `og-image.png` | Aperçu 1200 × 630 pour WhatsApp, Facebook, X, LinkedIn |
| `auth-visual.jpg` | Illustration verticale de l'écran de connexion |

### Palette

| Rôle | Couleur |
| --- | --- |
| Bleu de marque | `#2563eb` |
| Orange d'accent | `#f97316` |
| Dégradé du splash | `#2563eb` → `#1e40af` |

### Variables CSS du logo

Le logo de l'en-tête et du splash est un **sprite SVG inline** (`<symbol>` +
`<use>`) dont les couleurs sont pilotées par des variables CSS :

```css
:root {
  --logo-blue: #2563eb;      /* bleu de marque */
  --logo-orange: #f97316;    /* orange d'accent */
  --logo-white: #ffffff;
}

[data-theme='dark'] {
  --logo-blue: #60a5fa;      /* bleu éclairci pour rester lisible */
  --logo-orange: #fb923c;
}
```

Conséquences :

- **net à toutes les résolutions** (aucune image raster dans l'interface) ;
- **bascule automatique en mode sombre** en redéfinissant deux variables ;
- les SVG de `assets/logo/` utilisent les mêmes variables avec un repli
  (`var(--logo-blue, #2563eb)`), donc ils fonctionnent aussi hors application.

### Où le logo apparaît

1. **En-tête** — logo horizontal, hauteur 38 px (40 px dès 760 px), cliquable
   vers l'accueil. Sur mobile, seul le pictogramme est affiché.
2. **Splash** — logo empilé blanc centré sur dégradé bleu, animation
   d'apparition (fondu + montée), puis disparition automatique après ~1,5 s.
3. **Favicon & PWA** — `favicon.ico`, `favicon-16/32.png`, `apple-touch-icon.png`,
   `icon-192.png`, `icon-512.png` et `manifest.json` complet.
4. **Pied de page** — `logo-white.svg` sur une plaque sombre.
5. **Mode sombre** — les variables `--logo-blue` / `--logo-orange` sont
   éclaircies automatiquement.
6. **Connexion & inscription** — logo horizontal centré au-dessus du formulaire,
   illustration de marque à gauche sur desktop.
7. **Aperçus sociaux** — `og:image` (1200 × 630), `twitter:card` en
   `summary_large_image`.

> Les balises `og:image` / `twitter:image` utilisent une URL absolue
> (`https://bamahub.ml/assets/logo/og-image.png`) : WhatsApp et les autres
> plateformes n'acceptent pas les chemins relatifs. Adaptez le domaine au
> moment de la mise en ligne.

---

## Connexion & inscription

Une fenêtre modale accessible (focus piégé, `Échap`, fond inerte) propose deux
onglets :

- **Connexion** : e-mail + mot de passe, compte de démonstration
  `demo@bamahub.ml` / `bamako2026` (créé à la volée via « remplir
  automatiquement ») ;
- **Inscription** : nom complet, e-mail, mot de passe.

Les comptes sont **locaux** : ils vivent dans `localStorage`
(`bamahub:accounts`, `bamahub:session`), le mot de passe n'est jamais stocké en
clair (empreinte SHA-256, avec repli si `crypto.subtle` est indisponible en
`file://`). Les routes `#/connexion` et `#/inscription` ouvrent directement la
fenêtre correspondante.

---

## Structure des fichiers

```
index.html          Coquille HTML : en-tête, splash, sprite du logo, pied de page,
                    fenêtre de connexion, conteneur des pages
style.css           Design system complet (variables, composants, thème sombre,
                    responsive, section « Identité de marque »)
app.js              Application : état, rendu, routage, filtres, favoris, formulaire,
                    session, carte, avis, comparateur, QR et écran de démarrage
translations.js     Dictionnaires français / bambara et helpers i18n
data.js             CONFIG des catégories + 22 adresses de démonstration
events-data.js      Module événements : cache local, analyse d’intention, chat,
                    dédoublonnage, quotas, .ics — bascule démo ⇄ API
events-ui.js        Interface événements : liste, calendrier, carte, fiche,
                    import d’affiche, publication, validation, accueil
netlify/lib/        Cœur serveur : events-core (règles pures), env, http,
                    supabase, gemini, rate-limit
netlify/functions/  8 fonctions Netlify (dont la tâche planifiée)
supabase/           schema.sql (tables, RLS, quotas) et seed.sql de démonstration
manifest.json       Manifeste PWA (icônes, couleurs, raccourcis)
favicon.ico         Favicon multi-tailles (16, 32, 48)
assets/logo/        Logo vectorisé et déclinaisons (voir ci-dessous)
assets/vendor/leaflet/
                    Leaflet 1.9.4 + markercluster 1.5.3 auto-hébergés
                    (JS, CSS, images et licences)
assets/vendor/qrcode/
                    qrcode-generator 2.0.4 (MIT) auto-hébergé
assets/photos/      Visuels WebP des catégories et du plat du jour
partage/            Pages Open Graph statiques (22 adresses)
tools/              Script de régénération des pages de partage
```

Soit **sept fichiers de code** (`index.html`, `style.css`, `app.js`, `data.js`,
`translations.js`, `events-data.js`, `events-ui.js`) plus les ressources de marque (`manifest.json`,
`favicon.ico`, `assets/logo/`), les bibliothèques auto-hébergées
(`assets/vendor/leaflet/`, `assets/vendor/qrcode/`), les visuels
(`assets/photos/`) et les pages de partage (`partage/`).

Répartition volontairement nette :

- `data.js` ne contient **aucun** code de rendu : uniquement la config et les
  données, exposées via `window.BamaHubData`.
- `app.js` ne contient **aucune** donnée métier : tout est dérivé de la config.
- `style.css` pilote l’apparence via des variables CSS (`--brand`, `--cat`, etc.).
- `translations.js` ne contient que du texte et quelques fonctions : `t()`,
  `tData()`, `apply()` et `setLang()`. Ajouter une langue revient à ajouter un
  dictionnaire et à le déclarer dans `LANGS`.
- `tools/` ne sert qu’au développement : l’application elle-même n’en dépend
  pas et continue de fonctionner en ouvrant `index.html`.

---

## Architecture des données

Tout commerce est un **listing** générique :

```js
{
  id: 'le-baobab',
  name: 'Le Baobab',
  category: 'restaurants',              // une seule catégorie principale
  subcategories: ['Cuisine malienne'],  // zéro, une ou plusieurs sous-catégories
  neighborhood: 'Hamdallaye',
  address: 'Hamdallaye ACI 2000, Rue 421',
  landmark: 'En face de la pharmacie de Hamdallaye', // repère (rues souvent sans nom)
  phone: '+223 66 12 34 56',
  whatsapp: '22366123456',              // sans « + », pour wa.me
  hours: 'Lun – Dim · 11h – 23h',
  description: '…',
  rating: 4.8,                          // null pour une nouvelle adresse
  reviews: 214,
  createdAt: '2026-10-12',              // sert à « Derniers ajouts » et au badge « Nouveau »
  coords: [12.6394, -8.0135],           // [lat, lng] : carte, distance, itinéraires
  fields: {                             // champs propres à la catégorie
    menu: 'Riz au gras — 2 500 FCFA\nCapitaine braisé — 4 500 FCFA',
    platDuJour: 'Riz au gras au poulet',
    averagePrice: 2500,
    reservation: true
  }
}
```

Chaque catégorie décrit elle-même **sa couleur, son icône, sa tagline, ses
sous-catégories et ses champs** :

```js
{
  id: 'pharmacies',
  label: 'Pharmacies',
  singular: 'Pharmacie',
  color: '#059669',
  tagline: 'Soins, garde et conseils de proximité',
  icon: '<path d="…"/>',                       // contenu SVG 24×24
  subcategories: ['Pharmacie de quartier', 'Parapharmacie', 'Grossiste'],
  fields: [
    { key: 'onDuty', label: 'Pharmacie de garde', type: 'boolean',
      badge: 'De garde',                          // badge affiché sur les cartes
      valueLabels: { true: 'De garde aujourd’hui', false: 'Pas de garde' } },
    { key: 'openingHours', label: 'Horaires d’ouverture', type: 'text' },
    { key: 'pharmacyServices', label: 'Services disponibles', type: 'textarea' }
  ]
}
```

### Types de champs

| Propriété | Effet |
| --- | --- |
| `type` | `text`, `textarea`, `number`, `select`, `boolean` |
| `price: true` | champ utilisé pour le prix affiché et les tris par prix |
| `money: true` | ajoute « FCFA » à l’affichage |
| `prefix` / `suffix` | ex. `dès`, `/ nuit`, `personnes`, `chambres` |
| `badge` | texte du badge affiché quand le booléen vaut `true` |
| `required` | champ obligatoire dans le formulaire |
| `hint`, `placeholder`, `min`, `step`, `options` | aides de saisie |

Les champs `textarea` contenant une ligne de la forme `Plat — 2 500 FCFA` sont
automatiquement rendus en liste avec le prix aligné. Les autres `textarea` sont
affichés en liste à puces.

---

## Ajouter une catégorie

**Un seul objet à ajouter** dans le tableau `CATEGORIES` de `data.js` :

```js
{
  id: 'pressings',
  label: 'Pressings',
  singular: 'Pressing',
  color: '#0891b2',
  tagline: 'Linge impeccable, livré à temps',
  icon: '<path d="M4 4h16v16H4z"/><circle cx="12" cy="12" r="3"/>',
  subcategories: ['Pressing', 'Blanchisserie', 'Retoucherie'],
  fields: [
    { key: 'services', label: 'Prestations', type: 'textarea' },
    { key: 'priceFrom', label: 'À partir de', type: 'number',
      money: true, price: true, prefix: 'dès', suffix: '/ pièce' },
    { key: 'express', label: 'Service express', type: 'boolean', badge: 'Express' }
  ]
}
```

Aussitôt :

- la catégorie apparaît dans la grille d’accueil, les puces de l’explorateur et
  le sélecteur du formulaire ;
- sa couleur et son icône habillent les cartes, la fiche et les badges ;
- ses champs spécifiques sont rendus dans le formulaire **et** sur la fiche ;
- le filtre par sous-catégorie et les filtres rapides se mettent à jour.

> Les adresses déjà présentes dans `localStorage` restent lisibles : une
> catégorie inconnue retombe proprement sur une catégorie « Autres ».

---

## Ajouter une adresse de démonstration

Ajoutez un objet au tableau `LISTINGS` de `data.js` (même forme que ci-dessus).
Pour rendre visible un filtre rapide, il suffit qu’au moins une adresse coche le
booléen correspondant (`onDuty`, `delivery`, `urgent`, `enrollmentOpen`,
`homeService`, `reservation`).

---

## Personnalisation

- **Couleur de marque** : `--brand` et ses dérivés dans `:root` (`style.css`).
- **Couleur d’une catégorie** : propriété `color` dans `data.js`.
- **Arrondis et espacements** : variables `--radius-*`, `--shadow-*`.
- **Thème sombre** : bloc `[data-theme='dark']` dans `style.css`.
- **Clés de stockage** : objet `STORAGE` en haut de `app.js`.

---

## Raccourcis et accessibilité

- `Tab` / `Entrée` : navigation complète au clavier ; lien « Aller au contenu
  principal » en début de page.
- `/` : place le curseur dans la recherche de l’explorateur.
- `Échap` n’est pas intercepté : la navigation reste celle du navigateur.
- Boutons favoris en `aria-pressed`, filtres avec `aria-expanded`,
  résultats annoncés via `aria-live`, mode sombre avec libellé dynamique.
- Contrastes conformes sur les deux thèmes et animations neutralisées si
  l’utilisateur préfère réduire les mouvements.

---

## Données de démonstration

`data.js` contient **22 adresses fictives réalistes** réparties dans six
quartiers de Bamako — Hamdallaye, ACI 2000, Badalabougou, Kalaban Coura,
Magnambougou, Quartier du fleuve — avec des prix en FCFA, des numéros au format
malien (`+223 …`), un **repère** et des coordonnées approximatives utilisées par
la carte, les distances et les itinéraires.

> ⚠️ Commerces, numéros et tarifs sont inventés pour la démonstration. Aucune
> donnée n’est envoyée vers un serveur : favoris, thème et adresses ajoutées
> restent dans le `localStorage` du navigateur.

---

© 2026 BamaHub — Bamako, Mali.
