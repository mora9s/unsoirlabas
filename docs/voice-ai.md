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
- Les uploads sont bornés, hachés, écrits dans un fichier temporaire puis promus atomiquement.
- Les tâches sont persistées dans SQLite et exécutées une par une.
- Les instructions prononcées dans l’audio sont traitées comme des données, pas comme des commandes du modèle.
- Chaque paragraphe doit citer des segments existants. Les nombres absents des preuves citées sont refusés. Les citations facilitent la revue humaine mais ne prouvent pas à elles seules qu’une reformulation est exacte.

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
