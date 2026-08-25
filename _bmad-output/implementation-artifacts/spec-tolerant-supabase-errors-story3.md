---
title: 'Durcissement erreurs Supabase — Story 3 (observabilité webhook/cron/commande)'
type: 'bugfix'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 0
baseline_commit: '25de0a23a42bb1f740368b650dfdf414e03e687e'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Dernière tranche du durcissement « erreurs Supabase avalées ». Des writes Supabase sur des routes **qui doivent rester 200 / continuer** (webhook Stripe, cron, chemin commande client) sont enveloppés dans `try {} catch {}` inopérants → une vraie panne DB est silencieusement gobée (le client résout `{ error }` sans throw).

**Approach:** **Observabilité pure, ZÉRO changement de flux** : inspecter `{ error }`, ignorer « colonne/table absente » (`isMissingColumnError`), `reportError` sur toute autre erreur, ne **jamais** renvoyer 500 ni interrompre. Audit par bloc : seuls les 6 blocs confirmés comme write Supabase gobant `{ error }` sont touchés ; les gardes larges (parrainage/affiliation), appels Stripe et *reads* sont laissés tels quels.

## Boundaries & Constraints

**Always:** réutiliser `isMissingColumnError` ; motif `const { error } = await …; if (error && !isMissingColumnError(error)) reportError(error, { where })` + `catch (e) { reportError(e, { where }) }` ; **jamais** de 500 ni d'interruption (webhook/cron/commande restent 200/continuent) ; préserver la tolérance « migration absente ».

**Never:** toucher les blocs qui n'enveloppent pas un write Supabase gobé (webhook ~l.182 appel Stripe, ~l.230/308 gardes larges parrainage/affiliation, ~l.342 *read*) ; convertir un « colonne absente » en erreur ; changer un statut/flux ; replis message-regex (reportés).

## I/O & Edge-Case Matrix

| Bloc | Erreur simulée | Attendu |
|---|---|---|
| tout site | `{ code:"42703" }` (absente) | ignoré, flux inchangé |
| tout site | vraie erreur `{ code }` | `reportError`, flux inchangé (pas de 500) |
| tout site | throw réseau | `reportError` (catch), flux inchangé |

</frozen-after-approval>

## Code Map (6 sites confirmés, tous reportError-only)

- `app/api/order/route.ts` -- (a) update `orders.stripe_session_id` (~l.174) ; (b) update `orders.status='cancelled'` dans la recovery paiement (~l.191). `where: "order.session"` / `"order.cancel"`.
- `app/api/dashboard/orders/route.ts` -- update `orders.notified_ready_at` (~l.247). `where: "dashboard/orders.notified_ready"`.
- `app/api/cron/daily/route.ts` -- update `campaigns.pushed_count` (~l.246). `where: "cron/daily.pushed_count"`.
- `app/api/billing/webhook/route.ts` -- (a) update `businesses.order_tracking=false` (~l.85) ; (b) update `orders.status='new', paid=true` (~l.126, complétion de paiement). `where: "webhook.order_tracking"` / `"webhook.order_paid"`. **Ne pas toucher** les autres catch (Stripe/gardes larges/read).
- `tests/db-story3.test.ts` (nouveau, best-effort) -- au moins un bloc webhook/cron : vraie erreur DB → `reportError` appelé, statut/flux inchangé (200/continue). Le chemin commande client peut être plus dur à mocker → au minimum tsc/lint/build.

## Tasks & Acceptance

**Execution:**
- [x] `app/api/order/route.ts` -- 2 blocs reportError-only
- [x] `app/api/dashboard/orders/route.ts` -- notified_ready_at reportError-only
- [x] `app/api/cron/daily/route.ts` -- pushed_count reportError-only
- [x] `app/api/billing/webhook/route.ts` -- order_tracking + order_paid reportError-only (autres blocs intacts)
- [x] `tests/db-story3.test.ts` -- au moins un bloc couvert (reportError sur vraie erreur, flux inchangé)

**Acceptance Criteria:**
- Given une vraie erreur DB sur un de ces writes, when la route s'exécute, then l'erreur part à `reportError` **et** la route renvoie/continue exactement comme avant (aucun 500 introduit, webhook 200, cron poursuit).
- Given une colonne/table absente, when la route s'exécute, then le bloc est ignoré (tolérance préservée).

## Suffix — Post-Review

Auto-audit par bloc (le point délicat de cette story). Sur les 6 blocs `catch{}` recensés dans le webhook, seuls **2** enveloppent réellement un write Supabase gobant `{error}` (`order_tracking`, `order_paid`) → traités ; les 4 autres (appel Stripe coupon ~l.182, gardes larges parrainage/affiliation ~l.230/308, *read* phone/address ~l.342) ont été **laissés intacts** (pas des writes gobés). order.ts (2), dashboard/orders (1), cron/daily (1) confirmés et traités. Traitement uniforme **reportError-only, zéro changement de flux** (webhook 200, cron poursuit, commande client non bloquée). Test ajouté : webhook `paid=true` — vraie erreur DB → reportError + 200 ; colonne absente → tolérée sans reportError. 294 tests. **Reporté** : replis message-regex `/decor_emojis/` + `theme` (déjà Shape B, surfacent) et bare-awaits onboarding (phone/referred_by/affiliate_id).

## Verification

**Commands:**
- `npx tsc --noEmit` -- 0 erreur
- `npm run lint` -- 0 warning
- `npm test` -- tous verts
- `npm run build` -- succès
