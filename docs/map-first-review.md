# Revue indépendante — carte d’abord

Base examinée : `ccbf4b0` et diff local non commité. Revue source + captures `evidence/map-first/real-map-390.png` et `real-map-1440.png`. Aucune modification produit ni nouvelle exécution de la suite. Les captures montrent une carte et un programme lisibles sur mobile et desktop; elles utilisent des données de fixture, pas un itinéraire réel.

## Défauts à corriger

### P1 — Le centre de séjour est présenté comme un hébergement

`src/components/DiscoveryMap.tsx:45,187` affiche `tripStay.anchor.name` sous « Hébergement », et affirme « Base de séjour ». Or le modèle représente l’ancre comme un centre choisi — le code existant de `StayMap.tsx:26` la nomme « Centre » — sans établir qu’il s’agit d’un hôtel ou d’un hébergement. La fixture de test est elle-même un centre synthétique nommé « Hébergement de fixture » (`tests/map-first-companion.spec.ts:10`). Cela transforme une donnée de repérage en fait d’hébergement, contrairement à l’exigence de ne rien inventer.

**Correction bornée :** afficher « Centre du séjour » / « Centre choisi » et son nom sans supposer un hébergement; ne réserver « Hébergement » qu’à une étape explicitement enregistrée comme telle.

### P1 — La fiche sélectionnée n’est pas amenée à l’écran sur desktop en mode voyage

Le détail est rendu après toute la disposition carte/liste (`DiscoveryMap.tsx:186-191`). L’effet de sélection évite explicitement le défilement en mode voyage et donne le focus avec `preventScroll:true` (`:112`). Sur desktop, sélectionner un marqueur ou une ligne ne fait donc pas apparaître à l’écran la fiche, ses informations, ni le lien « Y aller »; l’utilisateur doit la chercher plus bas au lieu de garder le contexte carte. Le test vérifie `toBeVisible()` mais pas la présence dans le viewport (`tests/map-first-companion.spec.ts:28-31`), ce qui ne détecte pas ce défaut. Le panneau fixe mobile limite ce problème sur petit écran; la capture seule ne prouve pas l’interaction.

**Correction bornée :** placer la fiche près de la carte/liste ou la rendre en panneau adjacent/overlay visible en mode voyage desktop; compléter le test par une assertion d’intersection avec le viewport après sélection au marqueur et dans la liste.

## P2 — Incomplétudes et défauts secondaires

- **Le recentrage GPS peut être annulé par le cadrage automatique.** `locate()` appelle `setView()` (`DiscoveryMap.tsx:167`), mais la géolocalisation modifie `places` via sa dépendance `location` (`:59-68`); cela remplace `fit`, puis l’effet `[mode, tripId, fit]` recadre les étapes (`:110-111`). En mode voyage, le résultat peut revenir sur l’itinéraire au lieu de rester autour de la position demandée. Les tests contrôlent le texte de précision et la non-persistance, pas le centre final de la carte (`tests/map-first-companion.spec.ts:37-52`). **Correction :** distinguer le recadrage explicite/initial du changement de géolocalisation, puis tester le centre final après stabilisation des effets.
- **Jx est trompeur si le voyage n’a pas de date de fin.** `tripDates` ne contient alors que les dates portées par des étapes (`DiscoveryMap.tsx:46-50`), mais leur index est affiché comme numéro de jour (`:178`). Une première étape datée plusieurs jours après le départ peut ainsi être « J1 ». **Correction :** calculer le numéro depuis `departure`, ou afficher uniquement la date tant que la série des jours n’est pas établie.

## Couverture et sécurité des données

- Les captures confirment la hiérarchie carte/programme, bande de jours et débordement visuel contrôlé pour la fixture; le scénario sélectionné n’est pas capturé. Les captures OSM ne valident ni l’exactitude d’un itinéraire réel ni l’accès réseau hors fixture.
- Le pont « Raconter » conserve l’identifiant de voyage et l’identifiant d’étape dans la route (`DiscoveryMap.tsx:187`) plutôt que de fabriquer un récit. L’ajout d’une étape/envie relit l’état récent sous `withDurabilityLock`, valide et écrit via le helper déverrouillé (`:140-160`); je n’ai pas relevé d’écriture accidentelle liée à la consultation ou à la géolocalisation. Le test compare le stockage avant/après géolocalisation et ouverture du pont.
- Aucune P0 identifiée. La revue est indépendante mais limitée au diff, à ces deux captures et aux tests fournis; elle ne remplace pas une vérification appareil réel/GPS ni la suite canonique.

## Clôture — re-revue bornée des corrections

Relecture finale du code et des tests `tests/map-first-companion.spec.ts`; inspection de `evidence/map-first/selected-390.png` et `selected-1440.png`. Les constats précédents sont **clos** :

- Le centre est nommé « Centre du séjour » et décrit explicitement comme centre choisi, pas hébergement déclaré; les étapes `kind==='stay'` gardent leur libellé Hébergement.
- La fiche sélectionnée est en panneau fixe desktop et feuille mobile (46dvh). Les tests vérifient fiche/titre dans le viewport après sélection sur marqueur et liste, état sélectionné synchronisé, et marqueur hors du rectangle de la fiche. Les deux captures confirment que le marqueur reste visible à côté de la fiche; sur desktop le panneau recouvre une partie de la liste, mais pas le marqueur ni la fiche et aucune régression P1/P2 de sélection n’est relevée.
- Le cadrage automatique dépend des filtres explicites de voyage/jour/catégorie, pas de la position GPS; « Me situer » appelle le recentrage après réception, et le test vérifie la position au centre après stabilisation, y compris en mode envies uniquement.
- Pour les voyages sans fin, Jx est calculé depuis le départ en UTC; les tests couvrent Paris et Manille avec une étape au 3 février étiquetée J3. Les étapes sans date restent visibles dans « À programmer » et la vue d’ensemble.

**Résultat : PASS. Aucun P1/P2 restant dans le périmètre borné.** Revue statique/captures seulement; les résultats d’exécution des tests/build/lint cités dans le transfert parent n’ont pas été réexécutés ici.
