# Carte centrale — livraison locale

## État

Branche `feat/map-first-companion`, base `ccbf4b09f8d38ae72799dddb68adf0bdb7152e61` (main local récent). Worktree `/home/smora/Workspace/unsoirlabas-map-first`. Implémentation additive sur DiscoveryMap et les données existantes : aucun schéma modifié, aucune migration ou suppression de données personnelles. La branche historique du dépôt canonique reste intacte. Aucun merge main, push, déploiement ou publication.

## Fonctionnel

- Accès principal de la bibliothèque directement sur la carte du voyage ; Carte en premier dans la navigation. Programme, parcours, carnet, film et Aujourd’hui restent accessibles.
- Voyage entier, bandeau de jours/journées libres, jour courant par défaut seulement dans une plage de séjour en cours, étapes non datées sous « À programmer ». Jx est calculé depuis le départ, y compris sans date de fin. Le jour sélectionné reste entièrement lisible par recentrage horizontal.
- Numérotation cohérente carte/liste pour la journée. Étapes sans coordonnées listées sans position ou lien Y aller inventé. Groupes de lieux proches identifiés comme groupes.
- Sélection carte/liste synchronisée. Fiche adjacente fixe desktop et volet bas mobile ; contrôle géométrique du marqueur hors du panneau et de la fiche dans le viewport. Depuis la liste mobile, la carte revient dans le champ de lecture.
- Hébergement uniquement pour les étapes `kind: stay`. L’ancre du composeur est un « Centre du séjour », jamais un hôtel supposé.
- « Me situer » explicite : précision/cercle, attente, relance, refus/indisponibilité et callbacks périmés ignorés. Position non persistée, pas de suivi, pas de réordre du programme ; recadrage du plan indépendant du GPS.
- Navigation Google Maps volontaire. « Raconter » conserve le lien stable voyage/étape via l’atelier existant ; « Lire le souvenir » ouvre le chapitre associé. Aucun récit ou date inventés.
- Protections de stockage et inter-onglets conservées ; consultation, sélection et géolocalisation ne modifient pas le stockage. Les journées historiques du composeur restent dans le programme sans conversion silencieuse en étapes datées.

## Vérifications finales

- `npm run build` et `npm run lint` : PASS.
- `PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/google-chrome PLAYWRIGHT_JSON_OUTPUT_NAME=evidence/map-first/final-matrix.json npm run test:acceptance -- --workers=1 --reporter=line,json` : **200 passants, 6 conditionnels ignorés, 0 échec, 0 flaky ; total 206**. Durée mesurée 333,167 secondes. JSON/log dans `evidence/map-first/`.
- La dernière matrice porte sur les octets fonctionnels finaux ; seule une ligne blanche CSS en fin de fichier a été supprimée ensuite, sans effet runtime.
- Couverture : sauvegarde/restauration, médias, carnets, conflits inter-onglets, fonctions existantes ; nouveaux parcours carte/jours, sélection réelle au marqueur et à la liste, panneau et marqueur visibles ensemble à 390/1440 px, absence de position, Jx Paris/Manila sans date de fin, GPS temporaire/callbacks/recentrage, stockage inchangé, fermeture/réouverture de la carte hors réseau avec journées et étapes conservées.
- Débordement et cibles principales contrôlés à 320, 390 et 1440 px.
- Smoke distinct `PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/google-chrome RUN_LIVE_MAP_SMOKE=1 npx playwright test tests/map-first-companion.spec.ts --grep 'real OSM map tile' --workers=1 --output=test-results-map-first-live --reporter=line` : **1 PASS**, 9/9 tuiles OSM décodées mobile, 12 desktop après redimensionnement. Cela prouve le chargement, pas l’exactitude d’un voyage réel.
- Revue indépendante puis re-revue : PASS, P1/P2 clôturés (`docs/map-first-review.md`). Le dernier ajustement mineur du bandeau et des répétitions mobiles a ensuite été exercé par la matrice complète et les captures fraîches.
- `git diff --check` : PASS après retrait de la ligne blanche finale.

### Échecs intermédiaires

La première matrice a donné 197 passants, 2 échecs, 6 ignorés. Le test vocal a passé isolément sans modification. Le test hors connexion échouait aussi sur main inchangé : il exigeait « Télécharger » alors que le shell était déjà prêt et proposait « Actualiser ». Seul son sélecteur accepte maintenant les deux états réels ; clic, disponibilité, fermeture/réouverture hors réseau, photo décodée et ajout de souvenir restent exigés. Un test carte hors ligne complète la couverture. Deux matrices complètes suivantes ont passé ; la dernière inclut l’ajustement visuel final. Rapport initial conservé dans `evidence/map-first/initial-matrix.json`.

## Fichiers

- `src/App.tsx`, `src/components/{DiscoveryMap,Home,UpcomingTrips}.tsx`, `src/components/discovery-map.css`.
- `tests/map-first-companion.spec.ts` ; adaptation des parcours bibliothèque → carte → programme dans `discovery-map`, `editorial-ux`, `planned-lived`, `today`, `trip-planner`; sélecteur hors ligne dans `offline`.
- Ce rapport, revue indépendante, rapports de matrice et captures.

## Captures et limites

`evidence/map-first/` contient `fixture-{320,390,1440}.png`, `selected-{390,1440}.png`, `real-map-{390,1440}.png`. Les captures représentent un **itinéraire synthétique de test, pas celui de Stef**. Les deux `real-map-*` utilisent le vrai fond OSM ; les autres bloquent les tuiles pour des régressions déterministes. Les captures de bibliothèque générées par la matrice sont préservées séparément, hors commit fonctionnel.

- GPS simulé dans le navigateur ; permission et précision sur téléphone réel non validées.
- Aucun fond cartographique hors ligne ni préchargement OSM. Étapes/jours/notes enregistrés restent consultables sans réseau.
- Pas de durée ou route inventée ; pointillés facultatifs et indicatifs, notamment entre îles.
- Sans fin de séjour, seules les dates renseignées sont présentées avec leur vrai Jx. Bandeau limité aux 90 premiers jours des très longues plages, avec avertissement et accès au programme complet.
- L’accès interactif hors de cette machine nécessite un Go distinct pour un aperçu temporaire ou un déploiement.
