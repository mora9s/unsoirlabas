# Un soir là-bas — candidat local, non publiable

Branche `integration/version-stable`, worktree `/home/smora/Workspace/unsoirlabas-stable`, base GitHub/Vercel `23eb079b83d44342cd2bf71b0997048905383d4e`. Empreinte du manifeste source/test validé : `b0c492b342df7bb29b90d613193c8409554526c355651cb33e070ec641dfa87b` (ce n’est pas un SHA Git).

La préparation familiale conserve ses 21 jours, son budget, ses transferts et l’import privé de vols. La carte personnelle combine les étapes datées et les jours du séjour sans inventer de dates, propose une position ponctuelle et renvoie au souvenir lié. Le hors ligne, la protection des carnets et photos, les exports ZIP/photo/PDF et les garde-fous de la voix privée sont intégrés. Les prototypes IA, continuité et rétention restent à part.

## Validation locale

- Lint, build et `git diff --check` réussis. `CI=1 npm run test:acceptance -- --workers=2 --reporter=line,json` : **236 réussis, 6 conditionnels ignorés, aucun échec ni flaky**, Chromium Playwright. Les contrôles conditionnels couvrent les variantes publiques et les fournisseurs de carte réels.
- Backend : **26 réussis** sur une venv Python 3.14, sans service réel. Variantes statiques publiques : **4 réussis** sans OAuth (un scénario conditionnel ignoré), **4 réussis** avec un identifiant synthétique ; pas de connexion Google réelle.
- Mise à jour de `23eb079` vers le build candidat et réouverture sans réseau sur une même origine de test : nouveau cache, préparation et vol synthétique inchangés octet pour octet, images du programme et d’un ancien carnet décodées.
- Revue ciblée : jours relatifs et protections PWA confirmés. Démontage de l’éditeur reproduit puis corrigé : il reste affiché après une suppression ailleurs, et la sauvegarde conflictuelle est refusée sans perdre la saisie ; un nouveau chargement du lien supprimé reste invalide. Un ancien ZIP met à jour le carnet principal et son miroir sans remplacer les autres carnets. Le test d’abandon de transaction IndexedDB confirme qu’aucune collection n’est modifiée.
- Preuves : `$TMPDIR/unsoirlabas-stable-combined-check/` (`candidate-source.sha256`, `candidate-acceptance.json`, `candidate-upgrade.json`, `candidate-{configured,unconfigured}.json`, `candidate-mixed-version-lock.json`, `rereview-red.log`). Harnais : `$TMPDIR/unsoirlabas-{upgrade-check,mixed-version-lock-check}.mjs`.

## Publication bloquée

Les deux vrais builds sur une même origine montrent que l’ancien onglet `23eb079` peut écrire une note pendant que le nouvel onglet détient son verrou. Aucune perte n’a été observée dans ce test, mais la garantie de sérialisation ne couvre pas l’ancien code. Ne pas activer la migration de données réelles sans transition contrôlée : sauvegardes vérifiées et espace séparé, ou preuve que les anciennes écritures ne peuvent plus intervenir, y compris depuis une installation hors ligne. Les doublons provenant de migrations antérieures avec références différentes ne sont pas fusionnés automatiquement. GPS réel sur téléphone et CI GitHub sur le commit exact restent à valider séparément.

Aucun push, merge dans `main`, aperçu externe ni déploiement pour cette consolidation.
