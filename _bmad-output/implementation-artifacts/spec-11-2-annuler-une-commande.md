---
title: 'Story 11.2 — Annuler une commande (remboursement + notification client)'
type: 'feature'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'abb2c6c331ac422701fa89b70bc21b132ef01d33'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** L'annulation d'une commande existe déjà (transition `→ cancelled` dans `app/api/dashboard/orders/route.ts`), mais elle laisse deux trous : une commande **payée en ligne** reste **encaissée** (le client n'est pas remboursé), et le **client n'est jamais prévenu** de l'annulation (la notif n'existe que pour « prête »).

**Approach:** Sur l'annulation, (1) **déclencher le remboursement** de la story 11.1 quand la commande a été payée en ligne, en **réutilisant** sa mécanique via un helper serveur partagé `performOrderRefund` (extrait de la route 11.1, zéro duplication du chemin argent), en **best-effort** (un échec de refund n'empêche pas l'annulation) ; (2) **notifier le client** (e-mail + push) que sa commande est annulée, en best-effort.

## Boundaries & Constraints

**Always:** l'annulation reste la **transition de statut** existante (`ALLOWED`, garde `already_cancelled`/`already_done`) ; le remboursement réutilise **exactement** la mécanique 11.1 (refund PLATEFORME `reverse_transfer`, **jamais** `{ stripeAccount }`, **clé d'idempotence** `order-refund-{id}`, garde `refunded=false`) via un helper pur d'effets `performOrderRefund` qui **ne jette jamais** et renvoie un résultat structuré ; refund et notifications sont **best-effort** (jamais bloquants pour l'annulation) ; lectures/écritures **tolérantes** ; le refund n'est tenté que si la commande est **éligible** (payée en ligne, non remboursée) **et** que l'état `refunded` est lisible (sinon on saute — pas de refund non traçable) ; isolation `business_id` sur toute lecture/écriture.

**Ask First:** refuser d'annuler une commande **déjà remboursée mais encore active** (cas limite improbable) ; envoyer un **reçu/motif** de remboursement au client (au-delà de la notif d'annulation).

**Never:** nouvelle migration (réutilise `refunded/refunded_at/stripe_refund_id` de 0047 ; statut `cancelled` déjà en place) ; changer les transitions autorisées ni la sémantique HTTP de la route 11.1 (comportement **préservé**, couvert par ses tests) ; rembourser une commande payée **sur place** ; double refund (la clé d'idempotence protège le clic manuel « Rembourser » ultérieur) ; bloquer l'annulation sur un échec Stripe ou d'e-mail/push.

## I/O & Edge-Case Matrix

`performOrderRefund(db, stripe, order)` (effets, ne jette jamais) :

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Éligible | payée en ligne, non remboursée, session→PI ok | crée le refund plateforme (idempotent) + écrit le drapeau → `{status:"refunded", stripeRefundId}` | — |
| Non éligible | non payée en ligne **ou** déjà remboursée | aucun appel Stripe → `{status:"skipped", code}` | — |
| Pas de PaymentIntent | session sans `payment_intent` | aucun refund → `{status:"no_payment_intent"}` | pas d'écriture |
| Échec Stripe | `retrieve`/`refunds.create` lève | `{status:"failed", detail}` | pas d'écriture |
| Refund OK, écriture KO | update échoue | `{status:"record_failed", stripeRefundId}` | refund conservé (id renvoyé) |

Route `POST /api/dashboard/orders` avec `status:"cancelled"` :

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Annuler payée en ligne | commande `new`/`ready`, `paid`, session présente | statut `cancelled`, refund **déclenché** (best-effort), client notifié ; réponse `{ok, refund, notified}` | refund/notif best-effort |
| Annuler payée sur place | commande active, `paid` faux | statut `cancelled`, **aucun** refund, client notifié | — |
| Échec refund à l'annulation | Stripe échoue | commande **reste** `cancelled`, `refund.status:"failed"` remonté | annulation non bloquée |

</frozen-after-approval>

## Code Map

- `lib/order-refund.ts` (nouveau) -- `performOrderRefund(db, stripe, order)` : cœur d'effets extrait de la route 11.1 (éligibilité `refundEligibility` → `checkout.sessions.retrieve` → `refunds.create({payment_intent, reverse_transfer:true, refund_application_fee:true},{idempotencyKey:"order-refund-"+id})` → `update({refunded,refunded_at,stripe_refund_id}).eq(id).eq(business_id).eq("refunded",false)`). **Ne jette jamais** ; renvoie l'union `RefundOutcome` (voir matrice). Reçoit `business_id` via `order.business_id` (ajouté au select appelant).
- `app/api/dashboard/orders/refund/route.ts` -- refactor : garde son select fail-closed (503) + mapping HTTP, mais **délègue** le cœur à `performOrderRefund` (200 `refunded` ; 400 `skipped`→`already_refunded`/`not_online_paid` ; 400 `no_payment_intent` ; 502 `failed`→`refund_failed` ; 502 `record_failed`→`refund_recorded_partially`). Comportement identique (tests 11.1 inchangés).
- `app/api/dashboard/orders/route.ts` (POST) -- brancher l'annulation : étendre le select tolérant avec `paid, stripe_session_id, refunded, business_id` ; quand `next==="cancelled"` **après** update OK → si `refunded` lisible et éligible, `performOrderRefund` (best-effort, capturer l'outcome) ; puis notifier le client (e-mail + push best-effort, calqué sur la branche `ready`, texte « annulée »). Réponse enrichie `{ ok, refund, notified }`.
- `app/dashboard/orders/OrdersClient.tsx` -- `setStatus` : à l'annulation, message de résultat « annulée » + issue refund/notif ; le `confirm()` d'annulation (l.905, + zone historique) mentionne le remboursement quand `o.paid && !o.refunded`. Le bouton « Rembourser » (11.1) reste le repli manuel.
- `tests/order-refund.test.ts` -- ajouter la matrice `performOrderRefund` (helper) ; garder les tests de route 11.1 verts (comportement préservé).
- `tests/order-cancel.test.ts` (nouveau) -- annulation : refund déclenché si payée en ligne, aucun si payée sur place, annulation non bloquée si refund échoue, client notifié.

## Tasks & Acceptance

**Execution:**
- [x] `lib/order-refund.ts` -- `performOrderRefund` + type `RefundOutcome` (extraction du cœur 11.1, ne jette jamais)
- [x] `app/api/dashboard/orders/refund/route.ts` -- déléguer à `performOrderRefund` en préservant la sémantique HTTP
- [x] `app/api/dashboard/orders/route.ts` -- annulation : refund best-effort (si payée en ligne) + notif client best-effort
- [x] `app/dashboard/orders/OrdersClient.tsx` -- confirmation/messages d'annulation (mention remboursement si payée en ligne)
- [x] `tests/order-refund.test.ts` -- matrice `performOrderRefund` + routes 11.1 préservées
- [x] `tests/order-cancel.test.ts` -- annulation : refund conditionnel, non bloquant, notif client

**Acceptance Criteria:**
- Given une commande active **payée en ligne**, when le commerçant l'annule, then le statut passe à `cancelled`, un refund Stripe est **déclenché** (mécanique 11.1, idempotent) et le client est **notifié**.
- Given une commande active **payée sur place**, when elle est annulée, then statut `cancelled`, **aucun** refund, client notifié.
- Given un **échec** du remboursement à l'annulation, when l'annulation est demandée, then la commande est **quand même** `cancelled` (refund non bloquant) et l'échec est remonté au commerçant (le bouton « Rembourser » reste disponible pour réessayer).
- Given la route de remboursement 11.1, when elle est appelée, then son comportement (codes/statuts) est **inchangé** après refactor.

## Design Notes

- « Proposé/déclenché » : le « proposé » est déjà couvert par la 11.1 (bouton « Rembourser » visible sur les commandes annulées de l'historique) ; la 11.2 ajoute le « déclenché » (auto au moment de l'annulation) pour ne pas laisser un client payé encaissé. Les deux coexistent grâce à la clé d'idempotence Stripe.
- Best-effort : refund et notif sont enveloppés — l'annulation (transition de statut) est la seule opération qui peut échouer la requête.

## Suffix — Post-Review Fix

Revue à 3 relecteurs (chemin argent + RGPD/UX). Le refactor de la route 11.1 vers le helper `performOrderRefund` **préserve** sa sémantique HTTP (re-vérifié par ses tests). **Correctifs appliqués (patches) :** le résumé UI d'annulation gère désormais **toutes** les issues de remboursement (`no_payment_intent`, `already_refunded`) — le commerçant n'est plus laissé croire à un remboursement qui n'a pas eu lieu ; la **note e-mail** au client n'affirme « remboursé » **que** si le refund a réellement réussi (sinon message neutre) ; `emailResult` n'est marqué « sent » qu'**après** l'envoi ; `switch` du refund rendu explicitement exhaustif (`never`). **Tests ajoutés :** le contenu « annulée » de l'e-mail/push est asserté (une inversion de branche échouerait), et l'annulation reste actée même si `getStripe()` **lève** (config absente). **Reporté :** réconciliation webhook du refund (pending→failed) + horodatage `notified_cancelled_at` (mutualisé avec le defer 11.1). **Rejetés :** détails Stripe côté commerçant (dashboard authentifié, utile), double contrôle d'éligibilité (pur, inoffensif), 400 vs 409 (préserver la sémantique 11.1).

## Suggested Review Order

**Cœur d'effets partagé (extraction 11.1, zéro duplication)**

- `performOrderRefund` : ne jette jamais, renvoie un outcome structuré (mécanique refund plateforme identique).
  [`order-refund.ts:36`](../../lib/order-refund.ts#L36)

**Route 11.1 refactorée (comportement préservé)**

- Délègue au helper, mappe l'outcome → même sémantique HTTP (200/400/502/503).
  [`refund/route.ts:68`](../../app/api/dashboard/orders/refund/route.ts#L68)

**Branchement de l'annulation (best-effort)**

- Refund déclenché seulement si `refunded` lisible + éligible ; `try/catch` pour ne jamais bloquer l'annulation.
  [`route.ts:133`](../../app/api/dashboard/orders/route.ts#L133)
- Notification client « annulée » (e-mail + push), calquée sur la branche « prête ».
  [`route.ts:161`](../../app/api/dashboard/orders/route.ts#L161)

**Tests (cœur Stripe / annulation)**

- Matrice `performOrderRefund` + annulation (refund conditionnel, non bloquant, contenu notifié).
  [`order-cancel.test.ts:129`](../../tests/order-cancel.test.ts#L129)

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: 0 erreur
- `npm run lint` -- expected: 0 warning
- `npm test` -- expected: tous verts (dont `order-refund` préservés + `order-cancel`)
- `npm run build` -- expected: succès

**Manual checks:**
- Dashboard commandes → commande « Payé en ligne » active → « Annuler » (confirmation mentionne le remboursement) → statut annulée + refund visible dans Stripe (test, compte connecté) + badge « Remboursée » + client prévenu ; commande payée sur place → annulée sans refund ; 2ᵉ tentative de refund manuel → « déjà remboursée » (pas de double refund).
