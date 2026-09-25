# Carte de découverte

Routes : `#explore` (tous les voyages), `#explore/<id>` (voyage précis).
La carte de construction existante reste accessible depuis « Modifier le parcours ».

## Parcours utiles

- Explorer : sélection documentée des Visayas, recherche de destination, puis recherche explicite dans un rayon de 5 km autour du centre de la carte.
- Filtrer : Nature, Culture, Manger, Dormir, Pratique. Les recherches ne se relancent jamais automatiquement au déplacement ou à la localisation.
- Garder : une envie conserve nom, position, catégorie et source dans `plan.ideas`. Elle figure dans les archives ZIP et leur restauration, sans nouveau stockage parallèle.
- Planifier : ajout daté ou sans date dans `plan.stops`, insertion avant la prochaine date postérieure, transport laissé au choix du voyageur. Descriptions et sources sont conservées dans les notes.
- Mon voyage : étapes et envies, filtre de journée, envies seules et liaisons indicatives facultatives.
- Mes souvenirs : étapes reliées à un chapitre, photo existante et lien vers le récit. Les chapitres sans étape géolocalisée ne sont pas artificiellement placés sur la carte.
- Une liste accessible donne accès à chaque lieu, y compris aux points superposés regroupés sur la carte. Sur mobile la fiche s'ouvre en bas, avec fermeture et touche Échap.

## Données et dépendances

Sources éditoriales : ministère philippin du Tourisme, Tourism Promotions Board, office du tourisme philippin au Royaume-Uni ; liens dans `src/discovery.ts`. Sélection consultée le 25 septembre 2026. Coordonnées indicatives, sans horaires ni réservation inventés. Photos locales réutilisées avec crédits et licences dans `public/assets/visayas/credits.json`.

API principale : Photon (`api` et `reverse`), données OpenStreetMap. Documentation : https://github.com/komoot/photon/blob/master/docs/api-v1.md. La recherche de proximité utilise les filtres OSM, un rayon de 5 km et au plus 30 résultats. Filtrage des coordonnées et de la distance côté client. Cache de session borné et délai de 30 secondes entre recherches de zone non cachées. Le service public ne garantit ni exhaustivité ni disponibilité ; prévoir une instance dédiée avant une diffusion à grande échelle.

Overpass a été évalué puis écarté de l'implémentation après un échec HTTP réel. Photon a renvoyé de vrais restaurants de Lazi lors de la vérification navigateur ; d'autres appels réels ont rencontré une panne du proxy de l'environnement (`ERR_PROXY_CONNECTION_FAILED`). Les erreurs réseau sont donc affichées explicitement en français et ne sont jamais assimilées à une absence de lieux.

Tuiles OpenStreetMap avec attribution. Aucun téléchargement massif ni carte hors ligne implicite. Géolocalisation uniquement sur action, non stockée. Lien Google Maps transmettant la destination seulement à son ouverture. Aucune promesse d'ouverture, d'accessibilité, de distance routière ou de réservation.

## Protection des données

Chaque ajout relit et valide les voyages, conserve les modifications concurrentes, bloque les doublons et les dates hors séjour, respecte les limites existantes de 30 envies / 30 étapes. Une écriture atomique du stockage conserve l'ancien état en cas de quota insuffisant. Les champs géographiques optionnels restent compatibles avec les données existantes ; les anciennes versions de l'application peuvent ne pas comprendre ces nouveaux champs.

## Validation

`tests/discovery-map.spec.ts` couvre l'envie, le doublon, l'ajout au programme, le ZIP et sa restauration dans un navigateur vierge, les recherches explicites simulées, la fiche téléphone, le mobile, le fond indisponible, la localisation refusée, les dates hors séjour, le quota, les souvenirs, les modifications concurrentes et le stockage corrompu. Les services externes sont simulés pour rendre les tests reproductibles ; les essais réseau réels sont distingués ci-dessus.
