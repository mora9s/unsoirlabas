# Un soir là-bas — reprise du 5 novembre 2026

Ce document décrit le bilan initial, avant les développements de la même journée. La préparation désormais implémentée et ses limites sont décrites dans [le guide familial](family-planner.md).

Objectif : préparer le voyage familial aux Philippines en février–mars 2027, puis utiliser le carnet pendant le séjour.

## État vérifié

- Dépôt : https://github.com/mora9s/unsoirlabas ; branche `main` ; dernier commit `a4d7b36d492393eb2c7dc415945984a4562dc306`, daté du 25 septembre 2026.
- Le site https://unsoirlabas.vercel.app annonce ce même commit dans `/deployment.json` (contrôle HTTP du 5 novembre). Cela confirme la version annoncée, pas tous les parcours en production.
- Aucune issue ni pull request ouverte trouvée lors de la reprise.
- Copie du dépôt récupérée localement dans `unsoirlabas/`. Aucune publication réalisée pendant ce bilan.
- `npm ci --no-audit --no-fund --fetch-retries=0 --fetch-timeout=20000`, `npm run lint` et `npm run build` réussis.
- Tests ciblés : `npx playwright test tests/trip-planner.spec.ts tests/visayas.spec.ts --workers=2` : **5 réussis, 2 échoués**. Les trois tests Visayas passent. Les deux échecs du planificateur sont des délais dépassés sur « Nouvelle envie », caché dans la section `<details>` repliée ; le test ne l'ouvre pas. Les assertions ultérieures de ces deux tests n'ont donc pas été vérifiées. Suite complète et backend non exécutés ; aucun test modifié pour ce bilan.

## Ce qui existe dans l'application

| Besoin | État constaté dans le code et la documentation |
|---|---|
| Créer un voyage | Destination, départ, fin facultative, décompte |
| Préparer le programme | Envies, étapes datées, transports, adresses, heures, référence de réservation et notes |
| Explorer | Carte, recherche de lieux, ajout d'envies et d'étapes |
| Pendant le séjour | Programme du jour, souvenirs rapides, photos et chapitres |
| Conserver / partager | Archives ZIP, copies de lecture HTML, cartes PNG et film |
| Hors connexion | Application à télécharger explicitement ; données locales accessibles ; recherche et fonds de carte nécessitent Internet |
| Travail familial partagé | Pas de synchronisation entre appareils ; sauvegarde/restauration manuelles |
| Budget et réservations | Pas de budget calculé ni de suivi structuré des paiements, échéances et annulations ; référence de réservation en texte libre seulement |

Les données personnelles sont dans le navigateur utilisé, pas dans GitHub. Une éventuelle préparation déjà saisie sur téléphone ou ordinateur reste à retrouver sur cet appareil. La restauration ZIP remplace les collections concernées, sans fusion : ne pas l'utiliser comme synchronisation familiale.

## L'exemple Visayas n'est pas le voyage réservé

Le modèle propose 20 jours sur place : Cebu J1–2, Bohol J3–6, Siquijor J7–10, Negros oriental J11–14, sud de Cebu puis retour J15–20. Il comporte 20 chapitres fictifs et 25 repères. Vols internationaux hors programme ; hôtels, traversées, prix et disponibilités non confirmés.

Sa date technique par défaut est le 1er février 2027. Une autre démonstration utilise le 12 avril 2027. Aucune de ces dates ne constitue une décision familiale.

Le modèle change souvent de lieu de nuit, notamment à Bohol et Siquijor. Pour une famille, ma proposition de travail est de garder davantage de nuits dans chaque base et de traiter certaines visites en excursions. Le choix dépendra de l'âge des enfants et du rythme souhaité.

## Contexte familial reçu après la première lecture

Le scénario de travail est désormais défini : environ trois semaines, deux adultes et deux enfants de 8 et 5 ans, aucun vol intérieur, budget global de 10 000 à 11 500 €. Le dossier familial détaillé est conservé localement hors de ce dépôt public, dans `../VOYAGE-PHILIPPINES-2027.md` ; il rassemble calendrier, hébergements envisagés, programme quotidien, budget proposé et décisions restantes. Les dates et tarifs aériens transmis restent une offre étudiée, pas une réservation confirmée.

L'itinéraire familial remplace l'exemple comme référence de préparation : Moalboal, Dauin/Zamboanguita, Siquijor, Loboc, Panglao, puis Mactan. Il ne faut pas importer les récits fictifs comme souvenirs de ce séjour.

## Préparation à faire maintenant

1. Valider l'offre aérienne transmise : départ Nice, arrivée et retour Cebu, correspondances protégées, bagages, sièges et conditions tarifaires.
2. Conserver les six bases du scénario familial et vérifier les hôtels sur les dates envisagées, avec occupation réelle pour quatre et conditions d'annulation.
3. Organiser le repos en transit à Singapour et la chambre à l'arrivée à Moalboal après le transfert routier. Recaler le calendrier seulement si les vols changent.
4. Préparer une fiche par transfert : ports exacts, opérateur, durée porte à porte, bagages, prix familial, conditions de modification, solution de remplacement. Garder une nuit près de l'aéroport avant le retour international comme marge proposée.
5. Chiffrer vols, hébergements/chambres, ferries, transferts, repas, activités, assurance et marge. Aucun tarif n'a été recherché ou validé pendant ce bilan.
6. Sélectionner les hébergements selon couchages, climatisation, accès aux repas/plages, temps de trajet et annulation, puis suivre chaque réservation et échéance.
7. Vérifier les formalités selon les nationalités et la durée réelle ; préparer les documents, assurances et sauvegardes hors ligne.

## Repères de voyage vérifiés le 5 novembre 2026

- PAGASA situe généralement décembre–février dans la saison sèche plus fraîche et mars–mai dans la saison sèche chaude. Les climats diffèrent selon les îles ; ce n'est pas une prévision météo du séjour : https://www.pagasa.dost.gov.ph/information/climate-philippines
- Pour des ressortissants français, France Diplomatie décrit actuellement une admission touristique sans visa préalable jusqu'à 30 jours, sous condition de billet retour ou de continuation, et l'enregistrement eTravel. Si « février–mars » signifie plus de 30 jours, traiter la durée autorisée avant de réserver. Recontrôler les règles avant départ : https://www.diplomatie.gouv.fr/fr/information-par-pays/philippines/conseils-aux-voyageurs-entree-sejour
- OceanJet présente les dessertes de Cebu, Tagbilaran, Siquijor et Dumaguete ; aucun horaire ou tarif de février–mars 2027 n'a été confirmé ici : https://www.oceanjet.net/

## Priorités d'évolution proposées

1. Un espace « Notre voyage Philippines 2027 » avec dates réelles, voyageurs, décisions et tâches restantes.
2. Budget prévu/réservé/payé et réservations avec liens, confirmations et échéances.
3. Itinéraire familial avec nuits par base, journées de transfert et marges visibles.
4. Export pratique imprimable et test de restauration/hors connexion sur les appareils emportés.

Point de modèle à traiter : `validPlan` limite le voyage à 30 étapes. Le dossier familial détaillé pourrait dépasser cette limite si chaque hôtel, activité et transfert devient une étape. Définir la représentation des séjours et journées avant l'intégration. Aucune donnée personnelle n'a été injectée dans le navigateur ni publiée ; seul ce bilan a été ajouté à la copie locale du dépôt.

Le carnet et les fonctions créatives peuvent déjà servir. La priorité est maintenant la préparation concrète, puis les améliorations de l'application qui la facilitent.
