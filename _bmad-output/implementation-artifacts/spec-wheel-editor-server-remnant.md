---
title: 'Réconciliation éditeur de roue — nettoyage du remnant serveur des canaux legacy'
type: 'chore'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'efa40a9bb4153e3a6d44faafb7336f0796099468'
context: []
---

## Intent

**Problem:** Dette « réconciliation éditeur de roue ». L'audit a montré que le gros de la réconciliation est **déjà livré** (`spec-editor-reconcile-trigger-actions.md`, done) : le garde `noChannel`, le toggle Instagram legacy et l'avertissement « au moins un canal » ont disparu de l'éditeur ; le jeu (`app/[slug]/Game.tsx`, `app/api/play`) tourne déjà **exclusivement** sur `trigger_actions` (la « double source de vérité Instagram » est résolue côté jeu) ; le toggle avis est déjà relabellé neutre (9.3). Restait un **remnant serveur** incohérent : `app/api/dashboard/wheel/route.ts` forçait `instagram_enabled`/`review_enabled` à `true` quand les deux étaient faux (ancien garde « au moins un canal »).

**Approach:** Retirer le remnant ; écrire les colonnes canaux legacy **telles quelles** (défaut historique `true` si absentes). `trigger_actions` reste la seule source de vérité du « au moins un tour » (garanti par `sanitizeTriggerActions`/`resolveTriggerActions` qui ne renvoient jamais une liste vide). Aucune migration, aucune UI, aucun changement de jeu.

## Code Map

- `app/api/dashboard/wheel/route.ts` (~l.77-83) -- suppression du bloc `if (!igEnabled && !rvEnabled) { igEnabled=true; rvEnabled=true }` ; `igEnabled`/`rvEnabled` deviennent des `const` écrits tels quels dans `basePayload`.
- `tests/wheel-route.test.ts` -- capture des payloads d'`upsert` ; deux tests : (a) `instagram_enabled:false` + `review_enabled:false` → **non forcés** à true ; (b) absents → défaut true.

## Tasks & Acceptance

**Execution:**
- [x] `app/api/dashboard/wheel/route.ts` -- retirer le remnant, écrire les flags legacy tels quels
- [x] `tests/wheel-route.test.ts` -- non-forçage + défaut true

**Acceptance Criteria:**
- Given une config avec `instagram_enabled=false` et `review_enabled=false`, when elle est enregistrée, then les deux colonnes sont persistées à `false` (plus de forçage) — `trigger_actions` garantit seul le « au moins un tour ».
- Given une config sans ces clés, when elle est enregistrée, then elles valent `true` (défaut historique, rétrocompat).

## Design Notes

- **Périmètre réduit par l'audit :** la majeure partie de la dette « éditeur » était déjà résolue par une story antérieure ; seul le remnant serveur restait. Changement code-only, ~5 lignes.
- **Non-goals** (restent reportés, `deferred-work.md`) : backfill `trigger_actions` depuis anciens `instagram_enabled=false` ; gating `loyalty` sur `loyalty_enabled` ; FAQ obsolète `app/dashboard/aide`. La colonne `instagram_enabled` (0 lecteur fonctionnel) est **conservée** (pas de migration destructive).

## Verification

**Commands:**
- `npx tsc --noEmit` -- 0 erreur ✓
- `npm run lint` -- 0 warning ✓
- `npm test` -- 266 verts ✓
- `npm run build` -- succès ✓
