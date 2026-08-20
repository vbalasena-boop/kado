# BMAD Studio 🧭

**De l'idée à la roadmap, avec Claude.** Décris une idée d'application ; la chaîne
**BMAD** (Breakthrough Method of Agile AI-Driven Development) te rend :

1. 🔎 **Analyse de faisabilité** (Analyste) — résumé, score, verdict go / go-conditionnel / no-go, **avantages, contraintes, risques**, hypothèses à valider, prochaines étapes.
2. 📋 **PRD** (Product Manager) — objectifs, personas, périmètre MVP, epics, user stories.
3. 🏗️ **Architecture** (Architecte) — stack, composants, données, sécurité, déploiement.
4. 🗺️ **Roadmap** (Scrum Master) — epics ordonnés, sprints, jalons, définition de « terminé ».

Chaque étape réutilise les artefacts des précédentes, comme dans un vrai processus BMAD.
Le dossier complet est exportable en `.md`.

> Ce projet est autonome (son propre `package.json`) et a été **cadré avec BMAD**
> lui-même — voir `docs/brief.md`.

---

## Stack

Next.js (App Router) · API Claude (`@anthropic-ai/sdk`) · TypeScript · zéro base de données (sans état côté serveur).

## Démarrage (≈ 5 min)

```bash
cd bmad-studio
npm install
cp .env.example .env.local     # colle ta clé ANTHROPIC_API_KEY
npm run dev                     # http://localhost:3100
```

Obtiens une clé sur [console.anthropic.com](https://console.anthropic.com/).

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `ANTHROPIC_API_KEY` | Clé API Anthropic (obligatoire, serveur uniquement) |
| `BMAD_MODEL` | Modèle Claude (optionnel, défaut `claude-opus-5`) |

## Structure

```
app/
  page.tsx              Wizard (client) : saisie → faisabilité → chaîne BMAD
  layout.tsx            Layout racine
  globals.css           Design
  api/bmad/route.ts     Exécute une étape BMAD via Claude (serveur)
lib/
  agents.ts             Les 4 rôles BMAD (system prompts + prompts)
  anthropic.ts          Client Claude + modèle
  feasibility.ts        Types + parsing du rapport de faisabilité
docs/
  brief.md              Brief BMAD de BMAD Studio (dogfooding)
```

## Notes

- **L'analyse est une aide à la décision, pas une garantie.** Le rapport distingue
  faits et hypothèses à valider — traite-le comme tel.
- La clé API reste **côté serveur** ; le navigateur n'appelle jamais Claude directement.
- En déploiement serverless, une analyse « effort high » peut être longue : augmente
  le timeout de la fonction (voir `maxDuration` dans `app/api/bmad/route.ts`) ou passe
  le streaming en place pour de la prod.

## Extraire vers son propre dépôt

Ce dossier est autonome. Pour en faire un dépôt séparé :

```bash
cp -r bmad-studio ../bmad-studio-standalone
cd ../bmad-studio-standalone && git init && git add -A && git commit -m "init"
```
