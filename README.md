# Un soir là-bas

Carnet de voyage éditorial créé sur place : chaque soir, dix minutes pour raconter et partager la journée. Réalisé avec React 19, TypeScript et Vite.
Version publique statique : <https://unsoirlabas.vercel.app/>. Vercel construit
`dist` depuis `main` ; le récit vocal privé n’y est pas proposé (la compilation
Vercel le remplace par une explication), et l’import Google Photos sans client
OAuth configuré n’y est pas disponible. Le carnet et les décomptes restent dans
le navigateur utilisé, sans synchronisation entre appareils.
Les médias personnels restent locaux. Un import Google Photos Picker, désactivé par
défaut tant qu’un client OAuth Web public n’est pas configuré, permet de choisir des
photos sans transformer l’application en synchronisation ou publication distante.

## Lancer et vérifier

    npm run dev
    npm run lint
    npm run build
    npm run test:acceptance

Les tests Playwright lancent le serveur de prévisualisation sur le port 4673 :
le build doit donc précéder les tests ; Playwright utilise son Chromium installé (`npx playwright install chromium`).

## CI et contrôle après publication

GitHub Actions exécute `npm ci`, lint, build public avec SHA de commit, Playwright/Chromium et les tests backend déterministes (adapters IA factices, aucun modèle ni secret requis). Le build écrit `/deployment.json` avec le SHA fourni par Vercel (`VERCEL_GIT_COMMIT_SHA`) ou GitHub (`GITHUB_SHA`). Un build sans ces variables publie `unknown` et échoue donc volontairement au contrôle de déploiement.

Après autorisation explicite de publier la révision, vérifier l’alias de production et lancer le smoke depuis la racine du dépôt :

```bash
npm ci
npx playwright install chromium
npm run smoke:deploy -- --url https://unsoirlabas.vercel.app --expected-sha <SHA_COMPLET_DU_COMMIT_PUBLIE>
```

Le script compare la SHA attendue à `/deployment.json`, vérifie l’accueil/décompte, `/#create`, `/#share`, les débordements mobile/desktop et l’état vocal public. Si `/api/voice/health` répond 404 (ou si la plate-forme renvoie le document SPA HTML à la place de l’API), le bouton vocal doit être absent et l’avertissement d’accès privé visible. Ce contrôle ne publie rien et ne contacte pas le backend privé. En local, si Chromium n’est pas fourni par Playwright, `PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/google-chrome` peut sélectionner Chrome installé.

## Parcours

- `/#carnet` : couverture, chronologie des trois étapes et brouillons personnels.
- Sur l’accueil, **Le prochain départ** : destinations et dates à saisir soi-même,
  grand décompte en jours calendaires, tri chronologique, modification et retrait.
  Le jour du départ affiche « C’est le grand départ » ; les dates passées restent
  visibles comme souvenirs, sans décompte négatif.
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
les récits, les photos sélectionnées/redimensionnées du carnet et les décomptes
à venir enregistrés sous `un-soir-la-bas-upcoming-v1`. Les archives de version 1
restent importables ; elles ne contiennent pas de décomptes, donc leur restauration
conserve ceux déjà présents sur l’appareil. Les originaux de l’appareil ou
de Drive, les chapitres de démonstration, les comptes Drive et les modifications
non enregistrées n’y figurent pas. L’audio du récit vocal stocké dans IndexedDB
n’est pas exporté ni restauré. **Importer depuis Drive** ouvre le sélecteur de
fichiers (où Drive peut être choisi), vérifie l’archive puis affiche un aperçu avant
une restauration qui remplace le carnet et les décomptes locaux : il n’y a pas
encore de fusion. Une synchronisation OAuth directe demanderait un client Web
public, des origines HTTPS autorisées et une validation dédiée ; aucun identifiant
OAuth n’est embarqué dans ce prototype.


Les brouillons utilisent la clé `philippines-trip` de `localStorage`, sous la forme
`{ version: 1, drafts: [...] }`. Les photos importées sont redimensionnées à
1 400 pixels maximum et encodées en JPEG pour rester portables après rechargement.
Les quotas du navigateur peuvent limiter le nombre de journées ; un échec
d’enregistrement laisse le travail ouvert et affiche une explication.

Les voyages à venir sont conservés séparément, uniquement sur cet appareil, sous
`un-soir-la-bas-upcoming-v1`. Leur date suit le calendrier local (pas un nombre
d’heures restant) et se recalcule à l’ouverture, au retour dans l’onglet et chaque
minute. Ils sont inclus dans les nouvelles archives version 2 ; aucun voyage
de démonstration n’est inventé.

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

## Le récit du soir — IA locale

Dans l’atelier, **Commencer le récit du soir** ouvre le parcours audio local-first :
enregistrement ou import, transcription française, correction des segments,
rédaction fondée sur ces segments, revue des preuves puis insertion explicite dans
l’éditeur. L’IA ne sauvegarde et ne publie jamais le chapitre automatiquement.

Après `npm run build`, FastAPI sert l’application et l’API sur la boucle locale,
derrière l’origine HTTPS privée Tailscale. `faster-whisper small` assure la
transcription et Ollama exécute `qwen2.5:3b`; aucun modèle, secret ou jeton d’IA
n’est placé dans le navigateur. Les services locaux sont persistants via systemd
utilisateur. `npm run preview` reste une solution de repli sans API vocale.

Le service stocke ses fichiers privés dans `voice-data/` (ignoré par Git), exige
l’origine/hôte configurés (`VOICE_ALLOWED_ORIGINS`, `VOICE_ALLOWED_HOSTS`) et
`X-Un-Soir-Request: voice-v1` sur toute mutation. Les uploads sont limités à
64 MiB, vérifiés par SHA-256 et les tâches SQLite sont exécutées une par une.

Installation, architecture, limites, modèles validés et commandes de vérification :
[`docs/voice-ai.md`](docs/voice-ai.md).
