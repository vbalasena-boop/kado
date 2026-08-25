---
title: 'Gater l''action déclenchante « Fidélité » sur loyalty_enabled'
type: 'bugfix'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 0
baseline_commit: '84249cf10c504639a00d2810c7e0d7dd50b44dfa'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** L'action déclenchante « loyalty » (débloque un tour via l'inscription à la carte de fidélité) n'est gatée que sur la présence du **module** dans la formule (`fideliteAvailable = showFidelite`), pas sur l'activation réelle de la carte (`loyalty_enabled`). Un commerçant qui a le module mais a **désactivé** la carte peut cocher « Fidélité » → le jeu propose un tour renvoyant vers une carte **inactive** (la page carte gate déjà sur `!cfg.loyalty_enabled`) → impasse.

**Approach:** Faire dépendre la disponibilité de « loyalty » de `loyalty_enabled` **truthy** (cohérent avec le gate de la page carte), de bout en bout : (1) éditeur — la sélectabilité passe `fideliteAvailable = module && loyalty_enabled` (helpers inchangés, seul le booléen calculé change → purge à la sauvegarde) ; (2) jeu + garde serveur — un nouveau filtre pur retire « loyalty » des tours débloqués et la garde `/api/play` la refuse quand la carte est désactivée (filet de sécurité). Rétrocompatible.

## Boundaries & Constraints

**Always:** `loyaltyEnabled` = `!!loyalty_enabled` (truthy — aligné sur `!cfg.loyalty_enabled` de `app/[slug]/fidelite/page.tsx`) ; helpers de `lib/wheel.ts` **purs et testables** ; nouveau `unlockedSpinActions(triggerActions, { loyaltyEnabled })` (sanitize + purge « loyalty » si `!loyaltyEnabled`, repli `["instagram"]`) ; `isTriggerActionAllowed(playType, triggerActions, opts?)` gagne `{ loyaltyEnabled?: boolean }` **rétrocompatible** (défaut `true` → comportement inchangé si non passé), refuse « loyalty » si `loyaltyEnabled === false` ; l'éditeur calcule `fideliteAvailable = showFidelite && !!config.loyalty_enabled` (grise la case « Fidélité » en direct + purge à la persistance via `resolveTriggerActions`) ; défense serveur : la route de sauvegarde purge « loyalty » de `trigger_actions` si `!loyalty_enabled`.

**Ask First:** changer la sémantique `!== false` → `!!` ailleurs que sur ce chemin ; masquer (au lieu de griser) la case « Fidélité ».

**Never:** casser les configs `loyalty ∈ trigger_actions` **avec** `loyalty_enabled` truthy (comportement inchangé) ; nouvelle migration (colonnes présentes) ; changer la signature de `isTriggerActionAllowed` de façon non rétrocompatible (les autres appels éventuels doivent continuer à marcher) ; toucher aux autres actions (`instagram`, `optin`) ni à l'avis.

## I/O & Edge-Case Matrix

`unlockedSpinActions(triggerActions, { loyaltyEnabled })` (pur) :

| Scenario | Input | Expected |
|---|---|---|
| Carte active | `["instagram","loyalty"]`, `loyaltyEnabled:true` | `["instagram","loyalty"]` |
| Carte désactivée | `["instagram","loyalty"]`, `loyaltyEnabled:false` | `["instagram"]` |
| Seulement loyalty, désactivée | `["loyalty"]`, `loyaltyEnabled:false` | `["instagram"]` (repli) |
| Défaut (opts absent) | `["loyalty"]` | `["loyalty"]` (= sanitize, rétrocompat) |

`isTriggerActionAllowed(playType, triggerActions, opts?)` (pur, garde serveur) :

| Scenario | Input | Expected |
|---|---|---|
| loyalty, carte désactivée | `"loyalty"`, `["loyalty"]`, `{loyaltyEnabled:false}` | `false` |
| loyalty, carte active | `"loyalty"`, `["loyalty"]`, `{loyaltyEnabled:true}` | `true` |
| loyalty, sans opts | `"loyalty"`, `["loyalty"]` | `true` (rétrocompat) |
| instagram | `"instagram"`, `["instagram"]`, `{loyaltyEnabled:false}` | `true` (inchangé) |
| review | `"review"`, … | `false` (inchangé) |

</frozen-after-approval>

## Code Map

- `lib/wheel.ts` -- ajouter `unlockedSpinActions(triggerActions: unknown, opts?: { loyaltyEnabled?: boolean }): TriggerAction[]` (`sanitizeTriggerActions` puis, si `opts?.loyaltyEnabled === false`, retirer « loyalty » ; repli `["instagram"]`). Étendre `isTriggerActionAllowed(playType, triggerActions, opts?: { loyaltyEnabled?: boolean })` : après la vérif membership, si `playType === "loyalty" && opts?.loyaltyEnabled === false` → `false`. **Défaut `true`** (non passé → inchangé).
- `app/[slug]/Game.tsx` (~l.444) -- `enabledActions = unlockedSpinActions(config.trigger_actions, { loyaltyEnabled: !!config.loyalty_enabled })` (au lieu de `sanitizeTriggerActions`).
- `app/api/play/route.ts` (~l.96, l.111) -- ajouter `loyalty_enabled` au `select("trigger_actions, loyalty_enabled")` (lecture tolérante) ; passer `{ loyaltyEnabled: !!(taRes.data as any)?.loyalty_enabled }` à `isTriggerActionAllowed`.
- `app/dashboard/wheel/WheelEditor.tsx` (l.293, 305, 345, 623) -- `fideliteAvailable: showFidelite && !!config.loyalty_enabled` (partout). La case « Fidélité » se grise dès que la carte est décochée ; `resolveTriggerActions` purge « loyalty » à la persistance.
- `app/api/dashboard/wheel/route.ts` (~l.221) -- persister `unlockedSpinActions(cfg.trigger_actions, { loyaltyEnabled: !!cfg.loyalty_enabled })` au lieu de `sanitizeTriggerActions(cfg.trigger_actions)` (défense serveur : un payload forgé ne peut pas persister « loyalty » avec une carte désactivée).
- `tests/wheel.test.ts` -- matrices `unlockedSpinActions` + `isTriggerActionAllowed` (avec/sans `loyaltyEnabled`).

## Tasks & Acceptance

**Execution:**
- [x] `lib/wheel.ts` -- `unlockedSpinActions` + `isTriggerActionAllowed` étendu (rétrocompatible)
- [x] `app/[slug]/Game.tsx` -- tours débloqués via `unlockedSpinActions`
- [x] `app/api/play/route.ts` -- lire `loyalty_enabled` + le passer à la garde
- [x] `app/dashboard/wheel/WheelEditor.tsx` -- `fideliteAvailable = showFidelite && !!loyalty_enabled`
- [x] `app/api/dashboard/wheel/route.ts` -- persister via `unlockedSpinActions` (défense serveur)
- [x] `tests/wheel.test.ts` -- matrices helper + garde

**Acceptance Criteria:**
- Given le module fidélité présent mais `loyalty_enabled=false`, when le commerçant édite la roue, then la case « Fidélité » est **non sélectionnable** (grisée) et « loyalty » est purgée de la config persistée.
- Given une config `loyalty ∈ trigger_actions` mais `loyalty_enabled` faux (donnée existante/forgée), when un joueur tente le tour fidélité, then le jeu ne le propose pas **et** `/api/play` renvoie 403 (`action_not_allowed`).
- Given `loyalty_enabled` truthy et « loyalty » configurée, when on joue, then rien ne change (rétrocompat).

## Design Notes

- **Pas de churn de signature côté éditeur :** les helpers `{ fideliteAvailable }` restent inchangés ; on change seulement le booléen calculé par l'appelant (`showFidelite && !!loyalty_enabled`). L'invariant « au moins une action » (repli `["instagram"]`) est préservé par `resolveTriggerActions`/`unlockedSpinActions`.
- **Cohérence du gate :** `!!loyalty_enabled` (truthy) s'aligne exactement sur `if (!cfg?.loyalty_enabled)` déjà utilisé par la page carte et l'API carte → un tour fidélité n'est offert que si la carte est réellement accessible.

## Suffix — Post-Review

Auto-revue (changement pur-logique, filet de sécurité serveur ajouté). Deux tests pré-existants reflétaient l'ANCIENNE sémantique (« loyalty » configurée sans `loyalty_enabled`) et cassaient sous le nouveau gating — corrigés pour passer `loyalty_enabled` là où « loyalty » doit survivre, **et** complétés par les tests du nouveau comportement : `/api/play` renvoie 403 pour un tour fidélité quand la carte est désactivée ; la route de sauvegarde purge « loyalty » de `trigger_actions` si `loyalty_enabled` faux. Signature de `isTriggerActionAllowed` étendue de façon **rétrocompatible** (seul appelant : `/api/play`, mis à jour ; tsc confirme aucun autre appelant cassé). 282 tests verts.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: 0 erreur
- `npm run lint` -- expected: 0 warning
- `npm test` -- expected: tous verts (dont wheel)
- `npm run build` -- expected: succès
