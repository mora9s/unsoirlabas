# Le récit du soir — service local

Le navigateur enregistre l’audio dans IndexedDB, par fragments d’une seconde. Une coupure réseau n’efface donc pas un enregistrement déjà reçu par le navigateur. L’audio n’est envoyé au service local qu’après l’action **Transcrire en français**.

Le build privé local (`npm run build`) conserve l’atelier vocal. Le build statique
Vercel (`VERCEL=1`) ne présente pas ses commandes : aucun service vocal n’y est
déployé. La création manuelle de journée reste disponible sur Vercel. Une
éventuelle nouvelle cible publique exige de revoir explicitement cette séparation
avant publication.

## Parcours

1. Enregistrer jusqu’à 5 minutes ou importer un fichier audio (64 MiB maximum).
2. Conserver les fragments sur l’appareil.
3. Envoyer une copie au service privé avec SHA-256 et clé d’idempotence.
4. Transcrire localement avec `faster-whisper small`, CPU int8, français et VAD.
5. Corriger chaque segment horodaté.
6. Faire rédiger une proposition par `qwen2.5:3b` via Ollama sur la boucle locale.
7. Vérifier le titre, les paragraphes, leurs preuves et les incertitudes.
8. Utiliser explicitement le récit dans l’éditeur. Cette action ne sauvegarde ni ne publie le chapitre.

L’audio local et la copie serveur ont deux suppressions séparées. Le texte brut, le texte corrigé et le récit proposé restent distincts.

## Sécurité

- Aucun secret ou jeton d’IA n’est envoyé au frontend.
- FastAPI et Ollama écoutent uniquement sur `127.0.0.1`.
- Tailscale Serve fournit l’origine HTTPS privée.
- Toutes les mutations exigent une origine, un hôte autorisé et `X-Un-Soir-Request: voice-v1`.
- Cette origine, cet hôte et cet en-tête ne sont pas une authentification. La protection applicative par bearer est disponible en opt-in (`VOICE_AUTH_ENABLED=true` + secret `VOICE_AUTH_TOKEN`) et couvre santé, lectures de tâches et toutes les mutations implémentées. Si activée sans secret, l’API répond 503 sans retomber sur les anciennes vérifications. Il n’existe pas de route de téléchargement audio : `GET /api/voice/recordings/{rid}/audio` répond 404, que l’authentification soit désactivée ou activée, même avec un bearer valide.
- L’atelier navigateur actuel ne fait pas de connexion ni n’ajoute de bearer. Activer cette option bloque donc l’atelier vocal dans l’état actuel; aucun secret serveur ne doit être copié dans le build public. Ne pas l’activer sur le service en cours avant une intégration d’auth navigateur sûre et un essai privé planifié. La création/édition manuelle reste disponible.
- Le schéma serveur n’associe pas les enregistrements ou tâches à un utilisateur ou scope. Le bearer est un unique périmètre partagé, pas une isolation entre voyages/personnes; protéger le token et ne pas partager l’accès.
- Les uploads sont bornés, hachés, écrits dans un fichier temporaire puis promus atomiquement.
- Les tâches sont persistées dans SQLite et exécutées une par une.
- Les instructions prononcées dans l’audio sont traitées comme des données, pas comme des commandes du modèle.
- Chaque paragraphe doit citer des segments existants. Les nombres absents des preuves citées sont refusés, y compris les nombres écrits en chiffres ou en mots français reconnus. Le contrôle lexical accepte les cardinaux isolés `zéro` et `deux` à `vingt` (avec ou sans accents pour zéro), sans convertir les unités. `un`/`une`, les composés au-delà de vingt et les ordinaux ne sont pas normalisés. Décimaux, durées et unités ne sont comparés que comme texte/chiffres littéraux : le validateur ne les interprète pas et ne prouve aucune équivalence, durée ou conversion d’unité. Les titres sont comparés à l’ensemble des preuves source ; un nombre non attesté entraîne le rejet du brouillon. Les citations facilitent la revue humaine mais ne prouvent pas à elles seules qu’une reformulation est exacte.

## Modèles validés sur cette machine

- `Systran/faster-whisper-small`, révision `536b0662742c02347bc0e980a01041f333bce120`.
- `qwen2.5:3b`, Q4_K_M, digest `357c53fb659c5076de1d65ccb0b397446227b71a42be9d1603d46168015c9e4b`.

Un test synthétique français de 70 secondes a pris environ 11 à 13 secondes pour la transcription et 77 secondes pour la rédaction complète après démarrage du service. Whisper reste imparfait sur les noms propres et les monnaies : la correction humaine est obligatoire.

## Lancement

Après `npm run build` :

```bash
VOICE_ALLOWED_ORIGINS='https://smora-precision-3550.taildf8f08.ts.net:7443,http://127.0.0.1:4681' \
VOICE_ALLOWED_HOSTS='smora-precision-3550.taildf8f08.ts.net:7443,127.0.0.1:4681,localhost:4681' \
VOICE_OLLAMA_URL='http://127.0.0.1:11435' \
uvicorn server.app:app --host 127.0.0.1 --port 4681
```

Cette commande conserve le mode compatible actuel, sans authentification applicative. `VOICE_AUTH_ENABLED` accepte uniquement `true`/`false`, `1`/`0`, `yes`/`no` ou `on`/`off` (sans distinction de casse); toute autre valeur fait échouer le démarrage au lieu de désactiver silencieusement la protection. Pour un futur démarrage privé de validation seulement, configurer le secret hors dépôt dans l’environnement du service (long aléatoire, jamais dans Vite, HTML, stockage navigateur ou logs), puis définir `VOICE_AUTH_ENABLED=true` et `VOICE_AUTH_TOKEN`. Les clients HTTP autorisés doivent envoyer `Authorization: Bearer *** sur chaque route `/api/voice/*`; le serveur compare en temps constant. Aucun endpoint de connexion/session navigateur n’est livré, aucun bearer n’est fourni au frontend et la configuration n’est pas activée sur l’instance existante. L’activation en production reste bloquée jusqu’à ce qu’un parcours privé de session/capacité côté navigateur soit conçu, testé et approuvé.

Deux services utilisateur sont installés localement :

```bash
systemctl --user status unsoirlabas-ollama.service unsoirlabas.service
```

Ollama est fixé à `127.0.0.1:11435`, en CPU, avec un seul traitement à la fois. Le modèle Whisper est libéré avant la rédaction et Ollama décharge Qwen après chaque génération pour limiter la mémoire.

## Vérification

```bash
python3 -m pytest -q tests/backend
npm run lint
npm run build
npx playwright test
curl https://smora-precision-3550.taildf8f08.ts.net:7443/api/voice/health
```

Le test réel audio → transcription → rédaction → suppression est archivé dans `../evidence/voice-ai-live-e2e-final.json` depuis le répertoire parent du benchmark.
