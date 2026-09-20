# Mission — prototype « Philippines, journal vivant »

Construire un prototype web premium qui transforme chaque journée de vacances en un chapitre éditorial et partageable. Le prototype doit fonctionner réellement, pas seulement présenter des maquettes statiques.

## Cadre du test

- Travail exclusivement dans ce dépôt.
- Stack imposée : React 19 + TypeScript + Vite.
- Les médias fournis dans `public/assets/` sont les seuls médias autorisés. Aucun téléchargement supplémentaire et aucun média externe à l’exécution.
- Interface et contenus en français.
- Aucune API, aucun backend, aucune authentification et aucune publication réelle vers un réseau social.
- Ne pas lire de fichiers hors du dépôt, ne pas accéder aux secrets et ne pas modifier la configuration de la machine.
- Ne pas remplacer ou affaiblir les tests d’acceptation.
- Tu peux ajouter de petites dépendances si elles sont utiles, mais évite les frameworks UI lourds.
- Le résultat doit être soigné à 390 × 844 px et à 1440 × 1000 px.

## Intention produit

La promesse : **« Chaque soir, dix minutes pour transformer la journée en souvenir durable et partageable. »**

Le voyage doit se consulter comme un carnet contemporain et immersif, pas comme un tableau d’administration ou une grille générique de cartes. Direction artistique : chaleur éditoriale, grands médias, typographie expressive, rythme magazine, palette inspirée de la mer, du sable, de la végétation et du coucher de soleil. Éviter les emojis décoratifs, les gradients tape-à-l’œil, les effets gratuits et les textes factices.

## Contenu imposé

Voyage : **Philippines — 18 jours entre îles et lumière**.

Présenter exactement trois étapes principales :

1. **Jour 1 — Premiers battements à Manille** — publié.
2. **Jour 3 — Entre lagons et falaises à El Nido** — brouillon, mais sa page éditoriale complète doit être consultable.
3. **Jour 8 — Les collines de Bohol** — à venir.

La page du jour 3 doit contenir un vrai récit français cohérent, au moins six photos locales, la vidéo locale, quelques moments/lieux de la journée et une navigation vers les jours voisins.

## Surfaces obligatoires

### 1. Accueil du voyage

- couverture forte avec le titre et la durée du voyage ;
- chronologie lisible des trois jours ;
- états visuels distincts : publié, brouillon, à venir ;
- action accessible nommée `Découvrir le jour 3` ;
- les trois entrées portent `data-testid="day-card"` et `data-status="published|draft|upcoming"`.

### 2. Chapitre du jour 3

- conteneur `data-testid="day-detail"` ;
- image d’ouverture forte ;
- vrai récit éditorial ;
- mosaïque d’au moins six photos avec textes alternatifs utiles ;
- vidéo locale avec contrôles ;
- lieux ou moments de la journée ;
- navigation jour précédent / suivant.

### 3. Atelier « Créer une journée »

Accessible par un contrôle nommé `Créer` et contenu dans `data-testid="creator"`.

Fonctions réellement utilisables :

- import local d’images via `input[type="file"]` acceptant plusieurs fichiers ;
- aperçu immédiat de chaque média dans `data-testid="media-item"` ;
- suppression ;
- choix d’une couverture ;
- réorganisation au minimum par boutons précédent/suivant ;
- champ de souvenirs avec label accessible `Souvenirs de la journée` ;
- choix de ton incluant une option accessible `Aventure` ;
- action `Générer le récit` produisant un texte français non vide et contextualisé dans un `textarea` ;
- action `Prévisualiser` révélant `data-testid="day-preview"` ;
- action `Ajouter au voyage` enregistrant le brouillon dans `localStorage` sous la clé `philippines-trip` et affichant une confirmation visible contenant `ajoutée au voyage`.

### 4. Studio de partage

Accessible par un contrôle nommé `Partager` et contenu dans `data-testid="share-studio"`.

- aperçu Story vertical `data-testid="story-preview"` ;
- aperçu publication/carrousel 4:5 `data-testid="post-preview"` ;
- légende française proposée ;
- action `Copier la légende` réellement branchée au presse-papiers ;
- action `Télécharger` déclenchant le téléchargement d’un fichier local généré (une carte SVG/HTML ou une image est suffisante) ;
- aucune fausse affirmation de publication effective.

## Qualité requise

- HTML sémantique et navigation clavier utilisable ;
- focus visible et prise en charge de `prefers-reduced-motion` ;
- aucune erreur ou warning dans la console au chargement et pendant le parcours testé ;
- aucune image cassée ;
- aucun débordement horizontal à 390 px ;
- build TypeScript/Vite, lint et tests d’acceptation verts ;
- code structuré, lisible et sans placeholder.

## Commandes de validation

```bash
npm run lint
npm run build
npm run test:acceptance
```

## Compte rendu final attendu

Fournir uniquement : résumé fonctionnel, fichiers principaux modifiés, commandes de validation avec leur résultat exact, limites restantes honnêtes.
