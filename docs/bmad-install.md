# Installer BMAD Method dans Claude Code

Ce projet est cadré avec la **BMAD Method** (voir `brief.md`, `prd.md`,
`architecture.md`, `roadmap.md`). Pour retravailler ces documents avec les
agents BMAD (Analyst, PM, Architect, Scrum Master, Dev, QA…), installe le
plugin BMAD dans **ton** Claude Code.

## 1. Le marketplace est déjà déclaré dans le repo

Le fichier [`.claude/settings.json`](../.claude/settings.json) déclare le
marketplace officiel BMAD :

```json
{
  "extraKnownMarketplaces": {
    "bmad-plugins": {
      "source": { "source": "github", "repo": "bmad-code-org/bmad-plugins-marketplace" }
    }
  }
}
```

Quand tu ouvres ce dépôt dans Claude Code et que tu **fais confiance au dossier**,
le marketplace `bmad-plugins` est enregistré automatiquement — plus besoin de la
commande `/plugin marketplace add`.

## 2. Installer le plugin

> ⚠️ L'installation d'un plugin est **globale à ton Claude Code** (scope
> utilisateur par défaut), donc à faire depuis **ta** machine / ta session
> persistante — pas dans un conteneur cloud éphémère, où elle serait perdue.

Option A — interactif (recommandé) :

```
/plugin
```

Onglet **Discover** → marketplace `bmad-plugins` → choisis le module BMAD
voulu → scope **User** (global, tous tes projets).

Option B — en ligne de commande :

```
claude plugin install <module>@bmad-plugins           # global (scope user, défaut)
claude plugin install <module>@bmad-plugins --scope project   # committé dans ce repo
```

Puis recharge :

```
/reload-plugins
```

## 3. Utiliser BMAD dans ce projet

Une fois le plugin actif, dans le dossier `kado` :

```
/bmad:init        # détecte les docs existants dans docs/
/bmad:status
```

## Alternative sans plugin

L'installeur historique fonctionne toujours, mais il installe **par projet**
(dossier `.bmad-core/`), pas globalement :

```bash
npx bmad-method install
```

---

Réf. : [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) ·
[Marketplace officiel](https://github.com/bmad-code-org/bmad-plugins-marketplace) ·
[Claude Code — Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
