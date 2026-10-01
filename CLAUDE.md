@AGENTS.md

<!-- relais:debut -->
# Boucle Codex (consignes pour Claude uniquement)

Le fondateur a validé : Codex travaille d'abord (abonnement ChatGPT), Claude prend le relais quand Codex est à court, un seul agent à la fois.

- **Démarrage** : au premier message de la session, s'il existe des tâches prêtes ou en cours (BMAD : `grep -E ': (ready-for-dev|in-progress)$' _bmad-output/implementation-artifacts/sprint-status.yaml | grep -v 'epic-'` ; sinon sections « À faire » / « En cours » de `RELAIS.md`), lancer la boucle : skill `loop` sans intervalle avec le prompt « prends la suite ». Respecter d'abord les verrous d'`AGENTS.md`.
- **Chaque tour** : une seule tâche. Tâche de zone Codex et `codex login status` OK → `git worktree add <scratchpad>/wt-<id> -b codex/<id>`, puis au premier plan `codex exec --sandbox workspace-write -C <worktree> "<tâche + fichiers + critères>. Respecte AGENTS.md. Ni commit ni push."` ; Claude attend sans rien modifier. Sortie signalant limite d'usage ou authentification → Claude fait la tâche. Puis relire le diff, tests/lint/build du projet, fusionner, pousser, état à jour, tour suivant. Plus rien de prêt → arrêter la boucle et le dire en une ligne.
- **Connexion Codex** (si `codex login status` échoue et qu'une tâche Codex arrive) : lancer en arrière-plan `codex login --device-auth > <scratchpad>/codex-login.log 2>&1`, donner au fondateur le lien et le code (15 min), puis vérifier `codex login status`.
- **Économie** : une ligne par tâche terminée, rien entre deux tours.
- **Annonce modèle** : à la fin de chaque tâche, indiquer en une ligne : `Modèle utilisé : <Haiku / Sonnet / Opus> — <raison en 3 mots>`.
<!-- relais:fin -->
