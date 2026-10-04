# Revue et consolidation vers main

## Périmètre

Base distante : `a4d7b36`. Intégration de `feat/personal-roadmap-long` (`f290306`) et portage sélectif du composeur de séjour `4019031`.

Les parcours récents sont conservés : bibliothèque multi-voyage, journée et souvenirs rapides, découverte cartographique, programme quotidien, voyage animé et films, exemple Visayas, mode hors connexion. La roadmap apporte médias IndexedDB, rituel court/atelier complet, récupération, partage, PDF et sauvegarde/restauration durable.

Les prototypes IA locale et continuité restent des expériences séparées, non activées dans l'application. Le spike de rétention `90fc13f`/`d0515ba` n'est pas intégré : ses garanties ne suffisent pas pour les données personnelles. Aucun push ou déploiement n'est effectué par cette consolidation.

## Corrections d'intégration

- Schéma compatible avec les plans déjà enregistrés ; maintien des liens prévu/vécu et de l'ordre des chapitres.
- Verrou commun pour les écritures inter-onglets, publication des médias et sauvegardes/restaurations ; refus explicite des écritures non sûres.
- Édition d'étape attend la sauvegarde et fusionne seulement les champs changés ; conflits concurrents et suppression détectés.
- Photos hydratées dans les consommateurs autonomes et après sauvegarde ; les références IndexedDB ne sont jamais proposées comme URL d'image.
- Historique invalide préservé, sans faux succès ni écrasement ; brouillons trop longs refusés sans perdre le dernier état valide.
- Export HTML embarque les octets des photos, avec CSP restrictive et échappement. La sauvegarde ZIP prend son instantané sous le même verrou et conserve le verrou pendant la lecture des médias.
- Le bouton de préparation hors connexion utilise le worker réellement généré, avec contrôle de complétude `STATUS`, cache versionné borné et médias livrés précachés.
- Les tests suivent les routes programme/carte et les sections repliées réelles, sans supprimer les assertions de durabilité, confidentialité ou décodage.

## Vérifications finales exécutées

- Lint et build TypeScript/Vite : passants.
- Matrice Playwright canonique, un worker : **189 passants, 0 échec, 5 conditionnels ignorés**, rapport local `evidence/integration-final.json`.
- Build public local sans OAuth configuré : **4 passants**, 1 test configuré ignoré ; aucune activation de la voix privée.
- Build public local avec identifiant OAuth de fixture : **1 passant**, visibilité du Picker uniquement ; aucune authentification Google réelle.
- Backend et prototypes Python : **35 passants** ; avertissements de dépréciation FastAPI `on_event`, non bloquants.
- Build privé normal régénéré après les variantes publiques.

Les quatre gates de build public ignorées par la matrice canonique sont couvertes par les exécutions publiques distinctes. Le smoke fournisseur cartographique live reste optionnel/non exécuté. Les tests locaux ne constituent pas une validation physique sur téléphone ni une preuve de déploiement public.

## Hygiène

Les configurations temporaires et les artefacts de test concurrents ne sont pas inclus dans la fusion. Les captures de bibliothèque régénérées sont laissées séparées, sans les confondre avec le code fonctionnel. Chaque exécution concurrente dispose de ports et de répertoires d'artefacts distincts.
