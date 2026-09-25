# Corrections de fiabilité des carnets — 25 septembre 2026

Branche : `fix/journal-reliability`, base `ee031a3`.

## Corrections

- Validation du carnet avant sauvegarde, limite explicite de 20 000 caractères par récit et de 40 journées. Les brouillons de récupération sont validés avant écriture : un récit hors limites ne remplace pas une copie récupérable valide.
- Les liens historiques lisent la même version que le carnet Philippines migré. Les modifications effectuées par l’un ou l’autre parcours actualisent les deux stockages, avec retour à la valeur historique précédente si la seconde écriture échoue. La lecture initiale conserve les octets historiques.
- Si les deux stockages préexistants divergent déjà, les textes différents sont conservés comme deux pages, la seconde identifiée « version historique ». La lecture ne choisit pas arbitrairement un texte à détruire et ne réécrit pas la source historique. Si la capacité de 40 pages est dépassée lors de cette réconciliation, une erreur de lecture est affichée et les données brutes sont conservées.
- L’édition remplace le chapitre à sa position actuelle. Les carnets conservent leur classement existant par dernière modification.
- Le nom et la date modifiés dans la préparation suivent le carnet, y compris après retrait de la carte du voyage. L’écriture des métadonnées revient à l’état précédent si l’enregistrement des voyages échoue.
- Retour du studio de partage vers la journée de son voyage, titres d’onglet adaptés aux nouvelles routes, identité du pied de page unifiée.
- Les erreurs de lecture du stockage multi-voyage sont visibles ; elles ne sont plus présentées comme une collection vide normale.

## Validation

Neuf nouveaux scénarios dans `tests/journal-reliability.spec.ts` : texte trop long, 41e journée, cohérence historique/migré et retour du partage, préservation de variantes divergentes, stockage corrompu, métadonnées/ordre, échec d’écriture, retrait du voyage après renommage et déduplication indépendante de l’ordre des clés JSON.

Lint et compilation réussis. Suite navigateur sur le serveur local lancé directement (contournement du lanceur Windows déjà diagnostiqué, mêmes assertions et délais) : 84 réussites, 3 exclusions de la variante publique, 1 échec dû au classement des carnets. Le classement existant a été rétabli. Relance ciblée finale avec le dernier scénario ajouté : 13 réussites, dont l’ensemble des tests multi-voyages et les huit nouvelles régressions. Aucune assertion existante modifiée.

Aucune modification du backend, aucun appel à une IA distante, aucune migration Supabase, aucun push ni déploiement. Les données restent locales ; le stockage média IndexedDB, la PWA et la refonte du premier usage sont des évolutions distinctes de ce correctif.

Contrôle local de la variante publique : 2 tests réussis, 1 exclu car il exige un client OAuth configuré. Aucun appel OAuth réel effectué. La variante locale a ensuite été reconstruite.

Suite finale complète après toutes les corrections : 87 tests réussis, 3 exclusions conditionnelles de build public, aucun échec (1,7 minute). Lint et build finaux réussis. Les captures produites par les tests ont été restaurées pour ne pas inclure de changements visuels générés dans le correctif.
