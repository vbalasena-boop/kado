---
title: 'Durcissement erreurs Supabase — sweep observabilité (push / onboarding / connect)'
type: 'bugfix'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 0
baseline_commit: '3029e6b6f5a7525dfe6f12ef440f83ff2cc32290'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Suite de la Story 1. Plusieurs routes enveloppent un write Supabase dans `try { await … } catch {}` **sans lire l'`error`** : comme supabase-js résout `{ error }` (ne « throw » pas), le `catch` ne capte rien → une vraie panne (RLS, contrainte, connectivité) est **silencieusement avalée**. Contrairement au wheel route (Story 1, où le write EST le but → 500), ici la plupart sont des écritures **secondaires** (onboarding, recovery Stripe) qu'il ne faut **pas** faire échouer le flux principal.

**Approach:** Passe d'**observabilité** sur 3 routes commerçant : lire l'`error` retourné, ignorer le cas « colonne/table absente » (`isMissingColumnError`, helper Story 1), et **`reportError`** sur toute autre erreur — **sans changer le flux** (pas de 500), **sauf** là où le write est le but même de la requête (désabonnement push → réponse d'échec au client). Fin des échecs silencieux, zéro régression de flux.

## Boundaries & Constraints

**Always:** réutiliser `lib/db-errors.ts` `isMissingColumnError` (ne pas le redéfinir) ; pour chaque bloc ciblé, remplacer le `catch {}` inopérant par une inspection `const { error } = await …` : `error && !isMissingColumnError(error)` → `reportError(error, { where })` ; **conserver un `catch (e)` autour** pour un throw réseau (→ `reportError`, flux inchangé) ; préserver la tolérance « migration non appliquée » (colonne/table absente → ignoré) ; **ne pas changer le flux/le statut** des routes onboarding et connect (écritures secondaires) ; pour `push` (le delete EST le but de `body.remove`), sur une vraie erreur → réponse `{ error: "remove_failed" }` 500 (au lieu du faux `{ ok: true }`).

**Ask First:** élargir à `order.ts`/`dashboard/orders` (chemin client/commande) ; toucher `webhook`/`cron` (traitement reportError-only spécifique, sensibles) ; convertir les replis message-regex `/decor_emojis/`.

**Never:** faire échouer une inscription (onboarding) ou la recovery Stripe (connect) sur une écriture secondaire ; nouvelle migration ; modifier la logique métier (valeurs écrites inchangées) ; transformer un « colonne/table absente » en erreur (régression de tolérance).

## I/O & Edge-Case Matrix

| Route / bloc | Erreur simulée | Attendu |
|---|---|---|
| `push` remove (delete) | `{ code:"42P01" }` (table absente) | ignoré, `{ ok:true }` |
| `push` remove (delete) | `{ code:"23514" }` (vraie) | `reportError` + `{ error:"remove_failed" }` 500 |
| `onboarding` referral_blocks / order_tracking | vraie erreur `{ code }` | `reportError` ; **inscription poursuit** (flux inchangé) |
| `onboarding` / `connect` | colonne/table absente | ignoré (tolérance migration) |
| `connect` clear stripe acct | vraie erreur | `reportError` ; **recovery poursuit** (`{ connected:false }`) |
| tous | throw réseau | `reportError` (catch), flux inchangé |

</frozen-after-approval>

## Code Map

- `app/api/dashboard/push/route.ts` -- bloc `body.remove` delete `push_subscriptions` (~l.37-45) : inspecter `{ error }` ; colonne/table absente → ignoré ; autre → `reportError({where:"dashboard/push.remove"})` + `Response.json({ error:"remove_failed" }, { status:500 })` (le delete est le but). Garder `catch (e)` → reportError + 500.
- `app/api/onboarding/route.ts` -- (a) insert `referral_blocks` (~l.112-119) ; (b) update `businesses.order_tracking` (~l.165-172). Inspecter `{ error }` → `reportError` sur vraie erreur ; **ne pas** interrompre l'inscription. Colonne/table absente → ignoré.
- `app/api/billing/connect/route.ts` -- update `businesses` (clear stripe acct) dans le catch `resource_missing` (~l.119-126) : inspecter `{ error }` → `reportError` sur vraie erreur ; **conserver** le retour `{ connected:false }` (recovery).
- `tests/db-sweep.test.ts` (nouveau) -- push remove : table absente → `{ok:true}` ; vraie erreur → 500 `remove_failed` ; (spy `reportError`). Mock `@/lib/supabase/admin` (builder `{ error }` pilotable), `@/lib/api` (publicRoute/merchantRoute), `@/lib/report`.

## Tasks & Acceptance

**Execution:**
- [x] `app/api/dashboard/push/route.ts` -- delete remove : inspecter `{ error }` (missing→ignore, autre→reportError+500)
- [x] `app/api/onboarding/route.ts` -- 2 blocs : reportError sur vraie erreur, inscription non interrompue
- [x] `app/api/billing/connect/route.ts` -- clear stripe acct : reportError sur vraie erreur, recovery préservée
- [x] `tests/db-sweep.test.ts` -- push remove (missing→ok, vraie→500) + spy reportError

**Acceptance Criteria:**
- Given une vraie erreur DB sur une écriture secondaire (onboarding, connect), when la route s'exécute, then l'erreur part à `reportError` **et** le flux principal aboutit quand même (aucun 500 introduit).
- Given le désabonnement push échoue pour une vraie raison, when `body.remove`, then la route renvoie **500 `remove_failed`** (plus de faux `{ ok:true }`).
- Given une colonne/table absente (migration non appliquée), when ces routes s'exécutent, then le bloc est ignoré (tolérance préservée).

## Design Notes

- **Pourquoi pas de 500 partout :** contrairement au wheel route (le write EST la sauvegarde), ces écritures sont secondaires ; un 500 casserait une inscription ou une recovery Stripe. L'objectif ici est de **ne plus avaler en silence** (→ Sentry via `reportError`), pas de bloquer.
- Reste reporté (Story 3) : `order.ts`, `dashboard/orders`, `webhook`/`cron` (reportError-only), replis message-regex.

## Suffix — Post-Review

Auto-revue adversariale des 3 fichiers (changement à faible risque, mirroir exact du pattern wheel de la Story 1 déjà revu à 3 relecteurs). Vérifié : onboarding et connect logguent la vraie erreur SANS `return` (flux d'inscription / recovery Stripe inchangés) ; push renvoie 500 `remove_failed` sur vraie erreur (seul changement de comportement, couvert par 3 tests) ; tolérance « migration absente » préservée partout. Reste **reporté en Story 3** (`deferred-work.md`) : order.ts, dashboard/orders, webhook/cron (reportError-only), replis message-regex, bare-awaits onboarding.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: 0 erreur
- `npm run lint` -- expected: 0 warning
- `npm test` -- expected: tous verts (dont db-sweep)
- `npm run build` -- expected: succès
