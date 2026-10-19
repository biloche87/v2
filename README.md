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
| **Explorateur** (`#/explorer`) | Recherche plein texte (nom, description, menu, quartier…), filtres catégorie / sous-catégorie / quartier, filtres rapides (« De garde », « Livraison », « Urgences 24/7 »…), tri (pertinence, note, récents, prix), compteur de résultats, filtres actifs supprimables |
| **Fiche détail** (`#/adresse/:id`) | Badges, note et avis, description, champs spécifiques à la catégorie (menu, prix/nuit, garde…), contacts cliquables (tél., WhatsApp), itinéraire Google Maps, partage, favori, suppression des adresses créées localement, adresses similaires |
| **Ajout** (`#/ajouter`) | Formulaire en 3 étapes, champs dynamiques selon la catégorie, sous-catégories à cocher, aperçu en direct de la carte, validation, publication immédiate |
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
                    session et écran de démarrage
data.js             CONFIG des catégories + 20 adresses de démonstration
manifest.json       Manifeste PWA (icônes, couleurs, raccourcis)
favicon.ico         Favicon multi-tailles (16, 32, 48)
assets/logo/        Logo vectorisé et déclinaisons (voir ci-dessous)
```

Soit **quatre fichiers de code** (`index.html`, `style.css`, `app.js`, `data.js`)
plus les ressources de marque (`manifest.json`, `favicon.ico`, `assets/logo/`).

Répartition volontairement nette :

- `data.js` ne contient **aucun** code de rendu : uniquement la config et les
  données, exposées via `window.BamaHubData`.
- `app.js` ne contient **aucune** donnée métier : tout est dérivé de la config.
- `style.css` pilote l’apparence via des variables CSS (`--brand`, `--cat`, etc.).

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
  phone: '+223 66 12 34 56',
  whatsapp: '22366123456',              // sans « + », pour wa.me
  hours: 'Lun – Dim · 11h – 23h',
  description: '…',
  rating: 4.8,                          // null pour une nouvelle adresse
  reviews: 214,
  createdAt: '2026-10-12',              // sert à « Derniers ajouts » et au badge « Nouveau »
  coords: [12.6394, -8.0135],           // facultatif : lien Itinéraire
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

`data.js` contient **20 adresses fictives réalistes** réparties dans six
quartiers de Bamako — Hamdallaye, ACI 2000, Badalabougou, Kalaban Coura,
Magnambougou, Quartier du fleuve — avec des prix en FCFA, des numéros au format
malien (`+223 …`) et des coordonnées approximatives pour le lien d’itinéraire.

> ⚠️ Commerces, numéros et tarifs sont inventés pour la démonstration. Aucune
> donnée n’est envoyée vers un serveur : favoris, thème et adresses ajoutées
> restent dans le `localStorage` du navigateur.

---

© 2026 BamaHub — Bamako, Mali.
