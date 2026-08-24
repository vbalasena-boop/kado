# BMAD Method dans ce projet

La **BMAD Method** (v6) est **déjà installée dans ce dépôt**. Les agents et
workflows sont posés dans `.claude/skills/` et le cœur dans `_bmad/`, donc dès
que tu ouvres le projet `kado` dans **Claude Code** (app bureau/web ou CLI),
les skills BMAD sont disponibles — rien à installer en plus.

## Ce qui a été installé

- **Modules** : `core` + `bmm` (BMad Method — agents Analyst, PM, Architect,
  UX, Scrum Master, Dev, QA…).
- **Langue** : français (chat + documents générés).
- **Connaissance projet** : dossier `docs/` (brief, PRD, architecture, roadmap
  existants).
- **Sorties** : générées dans `_bmad-output/` (planning + implémentation).

Config lisible dans `_bmad/_config/config.toml` (géré par l'installeur — ne
pas éditer à la main ; pour des réglages durables, re-lancer l'installeur ou
utiliser `_bmad/custom/config.toml`).

## Utiliser BMAD

Ouvre `kado` dans Claude Code, puis invoque un agent via la palette de skills
(les skills commencent par `bmad-`). Par exemple :

- `bmad-help` — ne sais pas par où commencer ? demande-lui.
- `bmad-agent-analyst` (Mary) — cadrage / analyse.
- `bmad-agent-pm` (John) — PRD, épics.
- `bmad-agent-architect` — architecture.
- `bmad-agent-dev` — implémentation des stories.

Workflow agile typique : Analyst → PM (PRD) → Architect → création des
epics/stories → Dev/QA story par story.

## Mettre à jour BMAD

```bash
npx bmad-method install --directory . --tools claude-code \
  --modules core,bmm --action update
```

## Alternative : plugin global (tous tes projets)

L'install ci-dessus vaut **pour ce dépôt**. Pour avoir BMAD dans **tous** tes
projets sans réinstaller, un plugin Claude Code (communautaire, basé sur la
BMAD officielle) existe — à faire dans **ton** Claude Code :

```
/plugin marketplace add PabloLION/bmad-plugin
/plugin install bmad@bmad-method     # scope User = global
```

> ℹ️ Ces commandes `/` fonctionnent uniquement **dans l'interface Claude Code**,
> pas au prompt du terminal.

---

Réf. : [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) ·
[Docs](https://docs.bmad-method.org/how-to/install-bmad/) ·
[Plugin communautaire](https://github.com/PabloLION/bmad-plugin)
