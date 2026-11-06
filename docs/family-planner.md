# Préparation familiale — Philippines 2027

Route : `/#philippines`, accessible depuis l’accueil et la navigation principale.

Le scénario familial couvre 20 nuits du 17 février au 9 mars 2027 : Moalboal (3), Dauin/Zamboanguita (5), Siquijor (7), Bohol / Panglao (3), Mactan (2). Deux adultes, deux enfants de 5 et 8 ans, sans vol intérieur. Ces dates restent envisagées.

## Utilisation

- **Explorer & choisir** : 57 propositions, soit 18 hôtels, 18 restaurants et 21 activités. Chaque étape possède les trois catégories. Recherche sans distinction d’accents, favoris, filtre d’activités douces, liste, carte ou les deux. Les filtres s’appliquent simultanément aux repères et aux cartes de lieux. Les repères superposés donnent accès à chaque fiche.
- **Comparer** : jusqu’à trois options, avec intérêt, contraintes familiales et prix indicatifs lorsqu’un repère a été transmis. Une comparaison n’effectue aucune réservation.
- **Fiches** : source, conseils pour les enfants, points à vérifier, statut, date, notes, montant total familial, déjà payé, nature et date de vérification du prix, référence et conditions. Les favoris ne sont pas comptés comme dépenses.
- **Idées personnelles** : ajouter, modifier ou supprimer un lieu avec lien HTTPS et coordonnées facultatives. Sans coordonnées, le repère est placé au centre de l’étape et le précise. Un changement d’étape efface une date devenue incompatible ; les autres notes restent conservées.
- **Jour par jour** : vue d’ouverture avec 21 journées, photos locales créditées, matin/après-midi/soir, transferts et alternative quotidienne, choix datés et notes personnelles. Rien n’impose de cumuler les activités proposées.
- **Budget** : budget cible ajustable, total des montants renseignés, payé déclaré, marge non affectée, sous-totaux par étape et options sans prix. Les hôtels se saisissent pour tout le séjour et toute la famille. Les autres dépenses sont modifiables. Seule l’offre aérienne transmise de 2 577,96 € est préremplie comme estimation non payée.
- **Avant le départ** : checklist, scénario aérien non réservé, cinq transferts, exports et téléchargement hors connexion.
- **Notre carnet** : création explicite d’un voyage classique avec cinq bases et les dates internationales. Aucun chapitre fictif. Le bouton réutilise le même carnet ensuite. Le programme familial détaillé et le budget restent dans la préparation ; ils ne sont pas automatiquement synchronisés avec les étapes du carnet classique.

## Données, sauvegardes et hors connexion

La préparation utilise la clé locale `unsoirlabas-family-planner-v1`. Elle ne requiert aucun compte et ne transmet pas les choix à un serveur. Elle ne synchronise pas les deux téléphones.

L’export JSON conserve choix, lieux personnels, prix, paiements, checklist et notes. L’import valide format, tailles, identifiants, dates, montants et liens avant toute écriture. Il montre un aperçu, demande de télécharger la copie actuelle, puis exige un remplacement explicite. Une modification après cette copie bloque le remplacement jusqu’à un nouvel export. L’import remplace, sans fusion. Les carnets classiques ne sont pas modifiés.

**Le ZIP historique du carnet n’inclut pas cette préparation** : exporter aussi son JSON. Les deux surfaces le signalent. Le HTML autonome est une copie de lecture, avec programme, choix, alternatives dépliables, budget et checklist ; il ne permet pas de restaurer les données. Les textes utilisateurs sont échappés.

Le téléchargement de l’application emporte le code, le catalogue et la photo de couverture. Les choix locaux restent consultables après fermeture/réouverture sans réseau. Le fond de carte et les liens externes nécessitent Internet ; les repères et la liste restent disponibles. Aucun téléchargement massif de tuiles cartographiques.

Le stockage corrompu reste intact et bloque les écritures. Les échecs de quota sont explicites. Chaque mutation relit les dernières données. Les fiches et les notes quotidiennes détectent les modifications concurrentes, afin de ne pas remplacer silencieusement une autre version. Le stockage du navigateur peut être effacé par le système : conserver les exports ailleurs.

## Sources et limites éditoriales

Les liens figurent dans chaque fiche et dans `src/family-data.ts`. Sites d’établissements, offices de tourisme et pistes transmises par la famille ont été consultés le 5 novembre 2026. `verified` signifie que la source a été consultée, **pas** que les couchages, horaires, tarifs ou disponibilités de 2027 sont confirmés. Les pistes non contrôlées sont signalées comme telles.

Les coordonnées sont des repères d’orientation approximatifs, pas des entrées vérifiées. Les liaisons de la vue générale sont schématiques, sans calcul d’itinéraire. L’ouverture de Google Maps cherche le nom du lieu ; vérifier l’adresse avant un déplacement.

Aucune réservation, commande ou demande à un prestataire n’est effectuée. Les champs « réservé », « confirmé » et « payé » sont des déclarations de l’utilisateur. Les confirmations hôtelières pour quatre, les ferries datés, les assurances, les billets et les conditions des sorties enfants restent à obtenir. Il n’existe pas encore de coffre de documents ni de synchronisation familiale.

Les photos proviennent des médias déjà présents dans le dépôt, avec crédits et licences. Les noms personnels, coordonnées privées et références de billets ne sont pas préremplis dans le code public.

## Architecture

- `src/family-data.ts` : catalogue, séjours, calendrier et checklist.
- `src/family-store.ts` : schéma, validation, écritures, calculs et exports.
- `src/components/FamilyPlanner.tsx` : préparation et interactions.
- `src/components/FamilyMap.tsx` : Leaflet chargé à la demande, catégories, groupes et repli réseau.
- `src/components/family-planner.css` : présentation et adaptation mobile.
- `tests/family-planner.spec.ts` : parcours utilisateurs, sauvegardes, erreurs, concurrence, carte et hors connexion.

Le catalogue d’alternatives est séparé des étapes du carnet pour respecter la limite historique de 30 étapes sans confondre une proposition avec une étape retenue.

## Vérification

Build TypeScript/Vite privé et public, lint, parcours Playwright, contrôle visuel à 390 et 1440 pixels. Le test cartographique réel a chargé 9 tuiles sur 9, sans erreur JavaScript ; les tests automatisés simulent volontairement l’indisponibilité du fond pour vérifier le repli.

Les tests historiques du studio ouvrent désormais les panneaux de personnalisation et de modification avant d’utiliser leurs champs. Leurs assertions sur l’audio, la persistance, les photos et le mobile sont conservées.

Résultats locaux du 5 novembre 2026 :

- `npm run lint` : réussi.
- `npm run build` : réussi, variantes locale et publique (`VERCEL=1`).
- Suite complète `npx playwright test --workers=3` : 135 réussis, 3 ignorés (contrats de build public), 1 dépassement de délai lors du transfert d’une archive de 25 Mo dans le navigateur. Ce test a réussi au rejeu ciblé, sans modification de son assertion ni de son délai.
- Variante publique : tests familiaux, contrats publics et rejeu de l’archive, 17 réussis, 1 ignoré (client OAuth non configuré).
- Après le dernier ajout des sous-totaux budgétaires : `npx playwright test tests/family-planner.spec.ts --workers=2`, **14 réussis**.
- Contrôles visuels 390/1440 px et fond OpenStreetMap réel ; aucune erreur JavaScript pendant ce contrôle.

Le backend, inchangé, n’a pas été retesté localement. Les captures de cette séance sont conservées localement dans `screenshots/family/` et exclues du suivi Git.

La publication de cette version sur le dépôt GitHub public a été explicitement autorisée par l’utilisateur le 5 novembre 2026, y compris les dates envisagées, le circuit et les âges des enfants. Les confirmations et données personnelles saisies ensuite restent dans le navigateur.
