---
title: "Roue : mêmes couleurs que le site"
status: ready-for-dev
---

# Roue : mêmes couleurs que le site

**Agent :** codex  
**Niveau :** moyen  
**Priorité :** normale

## Objectif

La roue du jeu public (`/{slug}`) doit reprendre la palette du site vitrine (`.vitrine` dans `app/globals.css` ~l.8376) : papier `#f4efe5`, encre `#292331`, prune `#33204d`, piment `#e85b3d`, soleil `#efc64f`, feuille `#6d9273`. Aujourd'hui : rose `#ff5d73` sur violet nuit `#150c29`.

## Critères vérifiables

- [ ] Couleurs par défaut des quartiers de la roue (liste ~l.105 de `app/dashboard/wheel/WheelEditor.tsx`, `DEFAULT_PRIZES` de `lib/defaults.ts`) = piment, soleil, feuille, prune, papier foncé (alternance lisible, contraste texte ≥ 4.5:1).
- [ ] Accent et fond par défaut (`#ff5d73`, `#150c29`) remplacés par piment `#e85b3d` / encre `#292331` dans : `lib/wheel-face.ts`, `WheelEditor.tsx`, `app/[slug]/Game.tsx`, `app/[slug]/page.tsx`, `app/[slug]/commander|suivi|fidelite/page.tsx`, `app/dashboard/qr/page.tsx`, `app/admin/business/[id]/personnaliser/*`, `app/api/admin/business/[id]/theme/route.ts`, `app/api/dashboard/wheel/route.ts`.
- [ ] Les thèmes déjà choisis par un commerçant (valeurs en base) ne changent PAS : seulement les valeurs par défaut. Aucune migration.
- [ ] Mettre à jour les tests qui citent les anciens défauts.
- [ ] `bash scripts/relais/verifier.sh` OK.

## Reprise

Fait : rien.
