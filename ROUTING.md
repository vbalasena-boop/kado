# Base d'agents Instant Events : BMAD + agency-agents

Principe : **BMAD = le processus** (quoi, dans quel ordre). **agency-agents = les experts** appelés à une étape précise. 38 agents retenus sur 230+ pour limiter le poids en contexte.

## Routage par phase BMAD

| Phase BMAD | Agent BMAD (pilote) | Experts agency-agents (renfort) |
|---|---|---|
| 1 Analyse | analyst | product-feedback-synthesizer, specialized-french-consulting-market, design-ux-researcher |
| 2 Planification | pm, ux-designer | product-sprint-prioritizer, design-ux-architect, specialized-pricing-analyst |
| 3 Architecture | architect | software-architect, backend-architect, database-optimizer, security-appsec-engineer |
| 4 Réalisation | dev, quick-flow-solo-dev | frontend-developer, mobile-app-builder, rapid-prototyper, payments-billing-engineer, minimal-change-engineer |
| Revue / QA | qa, quinn | code-reviewer, reality-checker, evidence-collector, test-automation-engineer, accessibility-auditor, performance-benchmarker, ai-generated-code-auditor, ui-finish-gate-reviewer |
| Livraison / Ops | sm | devops-automator, sre, git-workflow-master, technical-writer |

## Hors développement (métier événementiel)
- **Marketing** : seo-specialist, content-creator, social-media-strategist, instagram-curator, email-strategist, brand-guardian
- **Vente** : sales-proposal-strategist (devis, propositions), pricing-analyst
- **Opérations** : hospitality-guest-services, support-finance-tracker
- **Chef d'orchestre** : agents-orchestrator (enchaîne plusieurs experts sur une tâche)

## Règles d'optimisation
1. **Un pilote, un ou deux experts max** par tâche. Jamais les 38 d'un coup.
2. **Rôles distincts de la règle Claude/Codex** : l'expert donne l'avis ou le plan, Codex écrit le code, Claude relit.
3. **Revue en deux passes** : code-reviewer (qualité) puis reality-checker (preuves que ça marche vraiment).
4. **Petits changements** : minimal-change-engineer pour éviter les refactors non demandés.
5. **Projet par projet** : copier seulement les agents utiles dans `.claude/agents/` du projet (ex. Kado : frontend, payments, seo), pas en global.
6. **Entretien** : tous les trimestres, supprimer les agents jamais appelés.

## Le côté "qui se complète"
Chaque fin de tâche, l'expert ajoute 3 lignes dans `LECONS.md` du projet (ce qui a marché, piège, décision). Le pilote BMAD relit ce fichier au début de la tâche suivante. La base s'améliore donc à chaque usage.
