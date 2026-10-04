# Carte et composeur de séjour — preuve locale

Statut : première version locale, branche `feat/map-stay-composer`, non publiée. Usage cible : voyage familial de Stef aux Philippines ; les destinations de test ne sont pas son itinéraire approuvé.

## Livré

Explorateur placé avant les anciens formulaires. Recherche explicite du centre puis des alentours (2,5 km). Carte Leaflet/OSM avec candidats, envies, couleurs des journées et sélection marqueur/liste. Noms affichés comme texte, jamais HTML. Jusqu’à 5 restaurants et 5 activités affichés, extension jusqu’à 10 selon disponibilité. Proximité dans un échantillon borné, pas classement de qualité.

Contextes séparés par centre : Cebu → Panglao → Cebu ne fusionne pas les choix. Ancien `plan.stay` compatible. Proposition de 1 à 3 journées, validation, déplacement, retrait, verrouillage préservé même lors d’une réduction de durée. Écritures sérialisées avec comparaison d’état : conflit explicite et rechargement au lieu d’écrasement silencieux. Choix/journées locaux inclus dans ZIP et consultables sans nouvelle recherche ; pas de fond de carte hors ligne.

## Exécution finale du contrôleur

4 octobre 2026, `/usr/bin/google-chrome` :

- `npm run build` : réussi (TypeScript/Vite).
- `npm run lint` : réussi sans avertissements.
- `PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:acceptance -- --workers=2 --reporter=line` : **95 réussis, 4 ignorés, zéro échec**. Les tests privés et le test réseau opt-in ne sont pas présentés comme couverts par ce passage.
- `LIVE_MAP_PROVIDER_SMOKE=1 PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/google-chrome npx playwright test tests/live-map-provider.spec.ts --workers=1 --reporter=line` : **1 réussi**, services Nominatim/Overpass/tuiles réels. Les images de tuiles sont réellement décodées.
- Passage intermédiaire séjour/ZIP : 24/24 réussis. Le passage global a ensuite révélé la régression des notes (lecture d’un champ contrôlé après attente du verrou). Valeur désormais capturée avant l’attente. Le test de suppression attend la confirmation de sauvegarde avant de recharger.

## Dernier essai réel aux Philippines

Observations `2026-10-04T13:12Z`, données OSM `2026-10-04T13:10:41Z` :

- Cebu City : 62 lieux nommés, 60 restaurants et 2 activités/repères.
- Panglao, Bohol : 8 lieux nommés, 7 restaurants et 1 activité/repère.

Un appel Overpass explicite avec deux sorties bornées à 60 objets nommés par catégorie. Cela évite que les restaurants épuisent le quota des activités. Ni inventaire exhaustif ni proximité sur tout le catalogue. Preuves : `evidence/map-stay/live-probe.json`, `live-cebu.png`, `live-panglao.png`, `live-cebu-map.png`, `live-panglao-map.png`. Carte réelle de Cebu inspectée visuellement par le contrôleur : fond, marqueurs et attribution visibles.

`mock-mobile.png`, `mock-desktop.png` et `mock-mobile-map.png` sont des scénarios automatisés fictifs, pas des recommandations. La dernière bloque volontairement les tuiles et affiche un nom hostile littéralement pour vérifier l’absence d’injection ; elle ne prouve pas le chargement du fond.

## Revue indépendante

Les cinq blocages initiaux (isolation des centres, journées verrouillées sparse, déplacement, infobulles HTML, écrasement d’état périmé) ont été revus comme résolus. Le dernier blocage de migration `stay` + `stayContexts: []` a été reproduit par un test RED, corrigé puis validé GREEN et en suite globale. Relecture ciblée finale **APPROVED** ; rapport de clôture `/home/smora/.hermes/cache/scratch/stay-review-closure.md`.

## Limites

- OSM seul est insuffisant pour promettre 5 à 10 incontournables pertinents aux Philippines. Enrichissement par sources touristiques fiables/curation et validation familiale nécessaires.
- Journées indicatives, pas optimisées par routes, horaires ou durées. Pas de vérification des fermetures, ferries, passages inter-îles ou adaptation aux enfants.
- Pas encore de créneaux détaillés matin/après-midi, préférences rythme/transport/budget, journées partielles ou météo.
- Recherche depuis l’explorateur central ; bouton contextuel sur chaque ancienne étape textuelle et recherche autour de tout POI encore à compléter.
- Choix locaux consultables sans réseau, mais pas de fond cartographique hors ligne ni de garantie des services communautaires. Pas de preuve de première installation entièrement hors ligne, sur téléphone physique ou connexion mobile réelle aux Philippines.
- Aucun push, déploiement ou achat fournisseur.
