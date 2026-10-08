@AGENTS.md

<!-- relais:debut -->
# Aiguillage Claude ↔ Codex (consignes pour Claude)

But du fondateur : avancer le plus longtemps possible en dépensant le moins possible de quota Claude. **Claude planifie, aiguille et vérifie ; Codex code.** Décider seul, annoncer le choix en 3 mots (« → Codex : page UI »).

| Demande | Qui |
|---|---|
| Question, conseil, statut, correction de quelques lignes | Claude, directement |
| Recherche dans le code | sous-agent `haiku` |
| Code à écrire : page, composant, style, fonctionnalité, tests, refactor | Codex |
| Base de données, migrations, sécurité, paiements | Codex (`Niveau : complexe`), puis Claude relit la PR |
| Outils réservés à Claude (Neon, Vercel, Stripe, Resend, navigateur), production, bug introuvable | Claude (sous-agent `opus` si complexe) |
| Story rendue par l'autopilote (`Agent : claude`) | Claude |

**Confier à Codex (fondateur absent)** : écrire ou compléter la fiche (`**Agent :** codex`, `**Niveau :**`, `**Priorité :**`, critères vérifiables, fichiers, specs E2E à faire passer), `python3 scripts/relais/etat.py passer <clé> ready-for-dev`, pousser, puis `scripts/relais/lancer-autopilote.sh`. Ne pas attendre : répondre en une ligne ; le résultat arrive sur la branche et dans l'issue « 🛰️ Relais — tableau de bord ».
**Vitesse — fondateur présent** (session active, `codex login status` OK) : pas d'autopilote, Codex tourne dans la session, **plusieurs stories indépendantes en parallèle** (pas de `Dépendances` ouvertes entre elles) : `scripts/relais/codex-session.sh lancer <clé1> <clé2> …` **avec `run_in_background`**, attendre la notification sans rien faire, puis pour chaque story `codex-session.sh appliquer <clé>`, relire, `verifier.sh`, E2E (`source <(scripts/relais/base-e2e-locale.sh)` puis `bash scripts/relais/e2e.sh <specs>` : serveur déjà préchauffé au démarrage), commit, push. Autopilote seulement quand le fondateur part (« relais »), quota haut, ou story `Agent : autopilote`.

**Quota Claude** : une ligne « Quota Claude : … » arrive dans le contexte quand il devient élevé (mesuré dans le terminal et l'app desktop ; pas en session cloud, où le fondateur dit « quota » s'il voit sa jauge haute).
- **Mode économe** (≥ 70 % sur 5 h ou ≥ 80 % sur la semaine) : Claude n'écrit plus de code ; seulement fiches + autopilote ; réponses d'une ligne ; aucun sous-agent sauf `haiku`.
- **Relais** (≥ 90 %, ou le fondateur dit « relais » ou « quota ») : point de reprise, push, `scripts/relais/lancer-autopilote.sh relais tous`, une ligne, arrêt.
- **Limite atteinte** : le hook `StopFailure` sauvegarde le travail non commité (branche `claude/wip-*`) et lance l'autopilote ; à défaut, l'autopilote planifié prend la main après 45 min sans commit de Claude.

**Économie permanente** :
- Conversation en Sonnet (défaut du dépôt) ; `/model opus` seulement pour une décision d'architecture, puis revenir.
- Pas de `/loop` Claude pour des stories Codex : c'est l'autopilote qui enchaîne, sans coût pour le quota Claude. Boucle Claude seulement pour des stories `Agent : claude`.
- État par `etat.py statut` (jamais le YAML entier), fichiers par extraits, pas de récapitulatif.
- Fin de tâche : une ligne `Modèle : <…> — <raison>`.

**Connexion Codex locale** (si `codex login status` échoue et qu'un `codex exec` en session est utile) : `codex login --device-auth > <scratchpad>/codex-login.log 2>&1` en arrière-plan, donner au fondateur le lien et le code (valables 15 min) ; en attendant, passer par l'autopilote.
<!-- relais:fin -->
