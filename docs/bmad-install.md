# Installer BMAD Method dans Claude Code

Ce projet est cadré avec la **BMAD Method** (voir `brief.md`, `prd.md`,
`architecture.md`, `roadmap.md`). Pour retravailler ces documents avec les
agents BMAD (Analyst, PM, Architect, Scrum Master, Dev, QA…), tu as **deux
options**.

---

## Option A — Plugin Claude Code (global, tous tes projets)

> Le plus simple pour avoir BMAD partout. Le plugin `PabloLION/bmad-plugin`
> est **communautaire** mais se synchronise sur la BMAD officielle
> (BMad Code, LLC). L'annuaire officiel `bmad-code-org/bmad-plugins-marketplace`
> est un **registre** (liste de modules), pas un marketplace installable en
> l'état — ne pas l'utiliser avec `/plugin marketplace add`.

### Le marketplace est déjà déclaré dans le repo

Le fichier [`.claude/settings.json`](../.claude/settings.json) déclare le
marketplace. Quand tu ouvres ce dépôt dans Claude Code et que tu **fais
confiance au dossier**, il est enregistré automatiquement.

### Installer (à faire dans TON Claude Code)

Lance Claude Code (`claude` dans un terminal) puis, **à l'intérieur** de
l'interface Claude Code (pas dans le terminal zsh) :

```
/plugin marketplace add PabloLION/bmad-plugin
/plugin install bmad@bmad-method
/reload-plugins
```

À l'installation, choisis le scope **User** = global à tous tes projets.
Vérifie ensuite avec `/` : des commandes BMAD (`/pm`, `/sm`, `/dev`, `/qa`…)
doivent apparaître.

> ⚠️ Les commandes qui commencent par `/` fonctionnent **uniquement dans
> l'interface Claude Code**, pas au prompt zsh du terminal.

---

## Option B — Installeur officiel `npx` (par projet)

Méthode officielle BMAD, mais elle installe **dans le projet courant**
(pas en global). Prérequis : Node.js ≥ 20.12.

```bash
cd chemin/vers/kado
npx bmad-method install
```

L'assistant interactif demande : le dossier, les modules (core, bmm, bmb,
cis, gds, tea) et les IDE cibles (coche **claude-code**). Il crée les
commandes Claude Code (`/pm`, `/sm`, `/dev`, `/qa`…) pour ce projet.

---

## Utiliser BMAD dans ce projet

Une fois installé (option A ou B), dans le dossier `kado` :

```
/bmad:init        # ou les agents /pm, /sm, /dev… selon la version
```

Il s'appuie sur les docs existants dans `docs/`.

---

Réf. : [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) ·
[Docs d'installation](https://docs.bmad-method.org/how-to/install-bmad/) ·
[Plugin Claude Code (communautaire)](https://github.com/PabloLION/bmad-plugin) ·
[Claude Code — Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
