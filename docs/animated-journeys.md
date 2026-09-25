# Voyages animés

L’intégration reprend le moteur original d’Atlas Motion (Sites, version 3, source `0a0150d99da9a9dedd0c2b75e69187d21904703d`), conservé dans `public/atlas`. Elle ne dépend pas de l’accès au Site privé : le globe, Three.js, D3, Lucide et la texture terrestre sont servis avec le carnet. Les bibliothèques conservent leurs mentions de licence ; les sources et attributions sont recensées dans `public/atlas/ORIGIN.md`.

## Utilisation

Depuis **Planifier**, ajouter le départ puis les escales. Ouvrir les détails de chaque étape pour choisir un résultat de recherche ou saisir sa latitude et sa longitude. Sélectionner le transport vers chaque étape après la première et, si souhaité, le chapitre dont les photos doivent apparaître à l’arrivée.

**Voir le voyage** est accessible depuis le plan et le carnet. La lecture parcourt toutes les liaisons et ménage quatre secondes à chaque arrivée, avec jusqu’à trois photos du chapitre associé, couverture en premier. Le curseur, le choix du trajet et « Voir l’arrivée » permettent une consultation directe. Le mode carte numérote les étapes et représente leurs liaisons illustrées. La durée sélectionnée (12/18/24 s) concerne l’animation, pas le temps de transport réel.

La démonstration `#motion/demo` ne crée ni ne modifie de données personnelles. Elle est accessible depuis le carnet de démonstration.

## Données et comportement

- `PlanStop` conserve son identifiant et accepte `point: {lat, lon}`, `transport` et `chapterId`, tous facultatifs pour lire les anciens plans. Le transport décrit l’arrivée depuis l’étape précédente ; après réorganisation il convient de le vérifier.
- Les nouvelles propriétés sont validées à la lecture, à l’écriture et à l’import. Elles voyagent dans les archives ZIP existantes. Aucun nouveau stockage ne duplique les photos.
- Une étape non localisée ou un transport manquant bloque le film complet ; aucune étape intermédiaire n’est sautée. Une référence de chapitre absente conserve le trajet, sans afficher de photos étrangères.
- Le plan appartient à la fiche de préparation. Retirer cette fiche supprime ses étapes ; le carnet conservé garde ses chapitres, mais pas le parcours. Sauvegarder avant retrait.
- Le lecteur et les ressources 3D se chargent seulement en ouvrant la vue. L’iframe locale isole le moteur ; les messages vérifient origine, fenêtre et identifiant de requête. Les photos sont affichées dans React et ne sont pas envoyées au moteur.
- Lecture interrompue quand l’onglet devient caché, lors des changements de données ou de vue ; ressources du lecteur libérées en quittant la vue. Avec mouvements réduits, la navigation est manuelle.

## Services et limites

Recherche explicite via [Photon](https://photon.komoot.io/), avec sélection d’un résultat par l’utilisateur ; saisie GPS disponible si le service échoue. Voiture et marche utilisent [OSRM / FOSSGIS](https://routing.openstreetmap.de/about.html), cache en mémoire et intervalle de 1,1 seconde entre requêtes. Échec explicite, puis repli illustré uniquement sur demande. Avion, bateau et train restent illustratifs ; le train ne prétend pas suivre les rails. Ce lecteur n’est pas un outil de navigation.

Les détails satellite dépendent d’Esri. Le globe de base est local ; les lieux recherchés, coordonnées de calcul et zones de tuiles demandées sont transmis aux services concernés. Les photos et textes ne le sont pas. Les attributions sont visibles dans le rendu et sous le lecteur.

L’export vidéo reste hors de cette première intégration. Les boutons d’enregistrement de l’ancien studio ne sont pas importés. La navigation des carnets et leurs sauvegardes restent utilisables sans WebGL.

## Vérification

`npm run build`, `npm run lint` et tests Playwright : globe réel dans Chromium, progression et enchaînement complet, photos et lien du chapitre, saisie GPS et persistance, train et mouvements réduits, panne de routage avec repli explicite, étapes incomplètes et archive ZIP contenant les positions/transports/associations.
