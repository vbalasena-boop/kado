---
title: 'Réconcilier l''éditeur de roue — trigger_actions comme source unique'
type: 'refactor'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'd3fab89005813212ccb8a09dec4ad69d3fa17dbe'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** L'onglet « Liens » de l'éditeur a deux sections qui se chevauchent : l'ancienne « Canaux & liens » (toggle legacy `instagram_enabled` + promesse « 1 tour », toggle avis, avertissement « activez au moins un canal », et un garde `noChannel` qui bloque l'enregistrement) et la nouvelle « Actions qui débloquent un tour » (`trigger_actions`, vraie source des tours depuis 9.2). Résultat : confusion, garde de sauvegarde faux (bloque un commerçant loyalty/optin), et l'action « Fidélité » proposée même quand le module est verrouillé.

**Approach:** Faire de « Actions qui débloquent un tour » (`trigger_actions`) la **source unique** des tours. Retirer le toggle legacy `instagram_enabled` et la promesse « 1 tour » ; le champ « Lien Instagram » s'affiche quand l'action Instagram est active. Baser la possibilité d'enregistrer sur `trigger_actions` (toujours ≥1) et supprimer `noChannel` + l'avertissement. Griser l'action « Fidélité » quand le module n'est pas disponible. L'avis reste un CTA neutre non récompensé (toggle `review_enabled`, inchangé).

## Boundaries & Constraints

**Always:** `trigger_actions` reste la seule source des tours (≥1 garanti par `sanitizeTriggerActions`) ; le champ « Lien Instagram » reste éditable (affiché quand Instagram est une action active) ; le toggle avis (`review_enabled`) et son lien restent (contrôlent le CTA neutre 9.3) ; la mention de conformité reste ; lectures/écritures tolérantes (colonnes existantes conservées).

**Ask First:** retirer la colonne `instagram_enabled`/`review_enabled` (on ne fait que cesser d'exposer le toggle Instagram ; la colonne reste, persistée telle quelle) ; masquer complètement l'action « Fidélité » (choix retenu : la **griser** avec explication, pas la masquer).

**Never:** réintroduire `review` comme action déclenchante / `play_type` ; conditionner l'avis à la satisfaction (review gating) ; retirer la mention de conformité ; toucher au modèle de jeu, au tirage serveur, à `/api/play`, ou aux migrations.

## I/O & Edge-Case Matrix

`isTriggerActionSelectable(id, { fideliteAvailable })` (logique pure) :

| Scenario | Input / State | Expected Output | Error Handling |
|---|---|---|---|
| Instagram toujours sélectionnable | `("instagram", { fideliteAvailable: false })` | `true` | N/A |
| Offres toujours sélectionnable | `("optin", { fideliteAvailable: false })` | `true` | N/A |
| Fidélité dispo | `("loyalty", { fideliteAvailable: true })` | `true` | N/A |
| Fidélité verrouillée | `("loyalty", { fideliteAvailable: false })` | `false` | N/A |
| Valeur inconnue | `("review", { fideliteAvailable: true })` | `false` | N/A |

</frozen-after-approval>

## Code Map

- `lib/wheel.ts` -- `isTriggerActionSelectable(id, { fideliteAvailable })` : `loyalty` ⟺ `fideliteAvailable` ; `instagram`/`optin` → `true` ; sinon `false`.
- `WheelEditor.tsx` `:336`+`:1105` -- supprimer `noChannel` ; bouton Enregistrer `disabled={saving}` seul.
- `WheelEditor.tsx:546-618` (tab « Liens ») -- retirer le toggle `instagram_enabled` (560-572), la copie « 1 tour » (554-558) et l'avertissement « au moins un canal » (614-618) ; afficher « Lien Instagram » quand `triggerActions.includes("instagram")` (indice si vide) ; conserver toggle avis (`review_enabled`) + lien ; `igEnabled` devient inutile.
- `WheelEditor.tsx:626-649` + `:282-296` -- « Fidélité » grisée + explication quand `!showFidelite` (via `isTriggerActionSelectable`) ; `toggleTriggerAction` refuse une action non sélectionnable.
- `tests/wheel.test.ts` -- couvrir `isTriggerActionSelectable`.

## Tasks & Acceptance

**Execution:**
- [x] `lib/wheel.ts` -- `isTriggerActionSelectable(id, { fideliteAvailable })` -- gating testable des actions
- [x] `app/dashboard/wheel/WheelEditor.tsx` -- supprimer `noChannel` + garde de sauvegarde ; retirer toggle `instagram_enabled`, copie « 1 tour » et avertissement « au moins un canal » ; champ Lien Instagram affiché si Instagram actif ; conserver avis (CTA neutre) + conformité
- [x] `app/dashboard/wheel/WheelEditor.tsx` -- action « Fidélité » grisée + explication quand `!showFidelite` ; `toggleTriggerAction` refuse une action non sélectionnable
- [x] `tests/wheel.test.ts` -- tester `isTriggerActionSelectable`

**Acceptance Criteria:**
- Given l'onglet « Liens », when le commerçant l'ouvre, then une seule section pilote les tours (« Actions qui débloquent un tour ») ; plus de toggle « Proposer le tour Instagram » ni d'avertissement « activez au moins un canal ».
- Given un commerçant n'ayant activé que « Offres » (ou « Fidélité »), when il enregistre, then l'enregistrement **n'est pas bloqué** (le garde `noChannel` ne s'applique plus).
- Given une formule sans module fidélité (`showFidelite` faux), when il ouvre les actions, then « Fidélité » est **grisée** avec explication et ne peut pas être activée.
- Given l'action Instagram active, when il ouvre les liens, then le champ « Lien Instagram » est éditable ; l'avis reste un CTA neutre non récompensé et la mention de conformité reste affichée.

## Design Notes

- On **n'expose plus** `instagram_enabled` dans l'UI, mais la colonne reste persistée (rien ne la consomme fonctionnellement depuis 9.2 ; le jeu et `/api/play` utilisent `trigger_actions`). `review_enabled` reste piloté par le toggle avis (CTA neutre).
- `isTriggerActionSelectable` isole la seule décision non triviale (gating fidélité) en logique pure testable ; le reste est de la présentation.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: 0 erreur
- `npm run lint` -- expected: 0 warning
- `npm test` -- expected: tous verts (dont `isTriggerActionSelectable`)
- `npm run build` -- expected: succès

**Manual checks:**
- Onglet « Liens » : une seule section de tours ; enregistrement possible avec une seule action non-Instagram ; « Fidélité » grisée si module verrouillé ; lien Instagram éditable ; CTA avis neutre + mention conformité présents.

## Suffix — Post-Review Fix

Suite à la revue (3 relecteurs, convergence forte) : une action verrouillée (« loyalty » hors formule) restait **persistée** dans `trigger_actions` → le jeu la proposait encore, et la case était désynchronisée. Corrigé en purgeant les actions non sélectionnables du set **effectif** (affichage + persistance), via deux fonctions pures testées.

## Suggested Review Order

**Logique pure (source unique + testabilité)**

- `resolveTriggerActions` : set effectif (sanitize + purge des non-sélectionnables + repli) — affiché ET persisté.
  [`wheel.ts:55`](../../lib/wheel.ts#L55)
- `nextTriggerActions` : réducteur pur du toggle (dernière action, non-sélectionnable, ordre canonique).
  [`wheel.ts:72`](../../lib/wheel.ts#L72)
- `isTriggerActionSelectable` : gating Fidélité par disponibilité du module.
  [`wheel.ts:36`](../../lib/wheel.ts#L36)

**Éditeur (une seule source de vérité)**

- Set effectif pour l'affichage + le garde ≥1.
  [`WheelEditor.tsx:345`](../../app/dashboard/wheel/WheelEditor.tsx#L345)
- Persistance du set effectif (purge d'une action verrouillée à l'enregistrement).
  [`WheelEditor.tsx:312`](../../app/dashboard/wheel/WheelEditor.tsx#L312)
- Toggle délègue au réducteur pur.
  [`WheelEditor.tsx:292`](../../app/dashboard/wheel/WheelEditor.tsx#L292)

**Tests**

- Matrices `resolveTriggerActions` + `nextTriggerActions` (purge, dernière action, ordre, no-op).
  [`wheel.test.ts:161`](../../tests/wheel.test.ts#L161)
