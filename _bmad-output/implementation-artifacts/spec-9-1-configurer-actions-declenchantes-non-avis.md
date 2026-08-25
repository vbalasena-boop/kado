---
title: 'Story 9.1 — Configurer les actions déclenchantes (non-avis)'
type: 'feature'
created: '2026-08-25'
status: 'draft'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Aujourd'hui un tour du jeu se débloque via l'action « avis Google » (avis incité → risque de suppression de la fiche Google du commerçant). Il n'existe aucune configuration des actions déclenchantes **non-avis**.

**Approach:** Ajouter une config `trigger_actions` (sous-ensemble de `{instagram, loyalty, optin}`) persistée dans `wheel_configs`, et une section dans l'éditeur de roue pour l'activer/désactiver, avec garde-fou « au moins une action active ». **9.1 ne modifie PAS le comportement du jeu** — la story 9.2 consommera cette config ; la 9.3 traitera l'avis en CTA neutre.

## Boundaries & Constraints

**Always:** valeurs autorisées uniquement `instagram|loyalty|optin` ; au moins une action active (repli `["instagram"]` si vide) ; persistance **tolérante** (colonne absente ne casse pas la sauvegarde du reste) ; réutiliser le `POST /api/dashboard/wheel` existant ; migration idempotente `0045`.

**Ask First:** introduire de nouveaux `play_type` côté jeu (relève de 9.2) ; retirer/renommer le toggle « Avis Google » existant (relève de 9.3).

**Never:** modifier `Game.tsx` ou la mécanique de jeu ; toucher au verrou des 2 tours ; conditionner quoi que ce soit à un avis ; supprimer `instagram_enabled`/`review_enabled`.

## I/O & Edge-Case Matrix

`sanitizeTriggerActions(input)` :

| Scenario | Input / State | Expected Output | Error Handling |
|---|---|---|---|
| Liste valide | `["instagram","optin"]` | `["instagram","optin"]` | N/A |
| Valeurs inconnues filtrées | `["instagram","review","x"]` | `["instagram"]` | N/A |
| Vide → garde-fou | `[]` | `["instagram"]` | N/A |
| Non-tableau | `null` / `undefined` / `"x"` | `["instagram"]` | N/A |
| Doublons | `["optin","optin"]` | `["optin"]` | N/A |

</frozen-after-approval>

## Code Map

- `supabase/migrations/0045_wheel_trigger_actions.sql` (nouveau) -- colonne `trigger_actions jsonb not null default '["instagram"]'::jsonb`
- `lib/wheel.ts` (nouveau) -- constante `TRIGGER_ACTIONS` + `sanitizeTriggerActions()` (logique pure testable)
- `app/api/dashboard/wheel/route.ts` -- persister `trigger_actions` dans un bloc `try/catch` tolérant (calqué sur `play_alerts`, l.150-157)
- `app/dashboard/wheel/page.tsx` -- lecture tolérante de `trigger_actions`, passage à `initialConfig`
- `app/dashboard/wheel/WheelEditor.tsx` -- type `Config` + section « Actions qui débloquent un tour » (3 interrupteurs, garde-fou ≥1) ; envoyé dans le POST existant (l.276-279, body `{ config, prizes }`)
- `tests/wheel.test.ts` (nouveau) -- couvre la matrice I/O

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/0045_wheel_trigger_actions.sql` -- `add column if not exists trigger_actions ...` -- persistance de la config
- [ ] `lib/wheel.ts` -- `TRIGGER_ACTIONS = ["instagram","loyalty","optin"]` + `sanitizeTriggerActions(input): string[]` (whitelist, dédup, repli `["instagram"]`)
- [ ] `app/api/dashboard/wheel/route.ts` -- update tolérant `{ trigger_actions: sanitizeTriggerActions(cfg.trigger_actions) }`
- [ ] `app/dashboard/wheel/page.tsx` -- lire `trigger_actions` (tolérant, défaut `["instagram"]`) → `initialConfig`
- [ ] `app/dashboard/wheel/WheelEditor.tsx` -- `Config.trigger_actions?: string[]` ; section 3 interrupteurs (Instagram / Fidélité / Offres) ; empêcher de désactiver le dernier ; inclus dans le POST
- [ ] `tests/wheel.test.ts` -- teste la matrice `sanitizeTriggerActions`

**Acceptance Criteria:**
- Given l'éditeur de roue, when le commerçant active/désactive les actions puis sauvegarde, then `trigger_actions` (⊆ `{instagram,loyalty,optin}`) est persisté dans `wheel_configs` et rechargé à la réouverture.
- Given le commerçant tente de tout désactiver, when il sauvegarde, then au moins une action reste active (repli `instagram`) — jamais zéro.
- Given l'avis Google, when on configure les actions déclenchantes, then l'avis n'apparaît **jamais** comme action déclenchante récompensée.
- Given la migration `0045` non appliquée, when on sauvegarde, then le reste de la config s'enregistre sans erreur (persistance tolérante).

## Design Notes

- `trigger_actions` est volontairement **séparé** des legacy `instagram_enabled`/`review_enabled` : la story 9.2 réconciliera (le jeu consommera `trigger_actions` et retirera l'avis comme déclencheur). 9.1 se limite à la config + persistance, sans effet sur le jeu.
- `jsonb` (tableau) plutôt que 3 booléens : une seule colonne, extensible.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: 0 erreur
- `npm run lint` -- expected: 0 warning
- `npm test` -- expected: tous verts (dont `tests/wheel.test.ts`)
- `npm run build` -- expected: succès

**Manual checks:**
- Ouvrir `/dashboard/wheel` → section « Actions qui débloquent un tour » : activer/désactiver, sauvegarder, recharger → l'état persiste ; impossible de tout désactiver.
