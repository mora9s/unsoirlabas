# Philippines — Les jours au large

Carnet de voyage éditorial en français, réalisé avec React 19, TypeScript et Vite.
Les médias personnels restent locaux. Un import Google Photos Picker, désactivé par
défaut tant qu’un client OAuth Web public n’est pas configuré, permet de choisir des
photos sans transformer l’application en synchronisation ou publication distante.

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

## Album partagé et Google Photos

L’atelier référence l’album partagé **PHILIPPINES 2027** et l’ouvre uniquement à la
demande. L’import Picker est séparé : il demande le choix explicite de l’utilisateur,
importe uniquement des photos et les convertit localement en données portables. Il
reste désactivé sans `VITE_GOOGLE_PHOTOS_CLIENT_ID` (ou
`window.__GOOGLE_PHOTOS_CONFIG__.clientId`) et sur HTTP non sécurisé. La configuration,
les limites, la confidentialité et les prérequis de compte réel sont détaillés dans
[`docs/google-photos-picker.md`](docs/google-photos-picker.md).

## Sauvegarde Drive

Depuis l’accueil, **Sauvegarder dans Drive** prépare une archive ZIP versionnée et
portable. Sur les appareils qui proposent le partage de fichiers, la feuille de
partage permet de choisir Drive ; sinon l’archive est téléchargée, y compris sur
un réseau local ou hors ligne, pour être déposée manuellement dans
`Voyages / Philippines / Sauvegardes`. L’application ne prétend jamais avoir
chargé le fichier dans Drive.

L’archive contient les chapitres personnels, leur ordre et leurs identifiants,
les récits et les photos sélectionnées/redimensionnées du carnet. Les originaux
de l’appareil ou de Drive, les chapitres de démonstration, les comptes Drive et
les modifications non enregistrées n’y figurent pas. **Importer depuis Drive**
ouvre le sélecteur de fichiers (où Drive peut être choisi), vérifie l’archive puis
affiche un aperçu avant une restauration qui remplace le carnet local : il n’y a
pas encore de fusion. Une synchronisation OAuth directe demanderait un client Web
public, des origines HTTPS autorisées et une validation dédiée ; aucun identifiant
OAuth n’est embarqué dans ce prototype.


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
`tests/archive.spec.ts` vérifie l’archive ZIP, son manifeste, la restauration
explicitement confirmée et la non-mutation lors d’un rejet ou d’une annulation.
