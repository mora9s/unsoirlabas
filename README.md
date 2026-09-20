# Philippines — Les jours au large

Carnet de voyage éditorial en français, réalisé avec React 19, TypeScript et Vite.
Toutes les photographies et la vidéo proviennent de `public/assets/`. Aucun service
distant, authentification ou publication sur un réseau social.

## Lancer et vérifier

    npm run dev
    npm run lint
    npm run build
    npm run test:acceptance

Les tests Playwright lancent le serveur de prévisualisation sur le port 4673 :
le build doit donc précéder les tests. La configuration fournie utilise Chrome
à `/usr/bin/google-chrome`.

## Parcours

- `/#carnet` : couverture, chronologie des trois étapes et brouillons personnels.
- `/#day-3` : récit d’El Nido, ouverture photographique, six images, moments,
  vidéo et navigation vers Manille et Bohol.
- `/#create` : import multiple, couverture, réorganisation, suppression, écriture,
  génération locale contextualisée, aperçu et enregistrement du brouillon.
- `/#share` : Story 9:16 et publication 4:5, légende modifiable, copie et export PNG.

## Données et limites volontaires

Les brouillons utilisent la clé `philippines-trip` de `localStorage`, sous la forme
`{ version: 1, drafts: [...] }`. Les photos importées sont redimensionnées à
1 400 pixels maximum et encodées en JPEG pour rester portables après rechargement.
Les quotas du navigateur peuvent limiter le nombre de journées ; un échec
d’enregistrement laisse le travail ouvert et affiche une explication.

La génération du récit est déterministe : elle encadre les souvenirs saisis selon
le ton choisi, sans inventer de lieux ni envoyer les données à une IA distante.
Le studio exporte une carte du jour 3, pas une publication effective ni un
carrousel multipage. Les modifications non enregistrées sont conservées pendant
la navigation dans l’application, mais pas après un rechargement.

La photographie de Port Barton et la vidéo de Nakabuang Beach sont identifiées
comme des fenêtres vers d’autres lieux, pas comme des prises de vue d’El Nido.

## Structure et vérification

`src/components/` sépare les quatre surfaces. `src/journal.ts` rassemble les données,
la validation du stockage, la génération et la préparation des images.
`src/base.css` et `src/journal.css` portent la direction éditoriale et le responsive.

Les tests d’acceptation fournis sont inchangés. `tests/journal-extended.spec.ts`
ajoute les deux dimensions cibles, le contrôle des médias et requêtes,
la reprise des brouillons, le clavier, l’historique et les dimensions des PNG.

État de cette livraison : code écrit, exécution non vérifiée. Le lanceur de
commandes a refusé lint, build et tests avant leur exécution, avec le statut
`BLOCKED: Security scan` en mode non interactif. Aucun résultat vert ni capture
du prototype exécuté n’est revendiqué.
