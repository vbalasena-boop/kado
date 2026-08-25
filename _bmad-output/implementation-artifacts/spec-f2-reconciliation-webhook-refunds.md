---
title: 'F2 — Réconcilier le statut réel des remboursements via webhook Stripe'
type: 'feature'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 0
baseline_commit: '90c2d29ac31a0040e7a77f6ecc29bf8c06ad7c03'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le remboursement d'une commande marque `refunded=true` dès la **création** du refund Stripe. Deux angles morts « chemin argent » (action item F2 de la rétro Epic 11) : (1) si l'écriture DB échoue après un refund Stripe réussi (`record_failed`), `refunded` reste `false` **et** `stripe_refund_id` n'est **jamais** écrit → le bouton « Rembourser » reste re-cliquable et, passé la fenêtre d'idempotence Stripe (24 h), un **second refund réel** peut partir ; (2) un refund peut revenir `pending` puis basculer `failed`/`canceled` (ex. solde négatif empêchant le `reverse_transfer`), laissant une commande marquée remboursée alors qu'elle ne l'est pas.

**Approach:** Réconcilier l'état via le **webhook plateforme existant** (`refund.updated` + `charge.refund.updated`) : `succeeded` → `refunded=true` (idempotent, écrit aussi `stripe_refund_id` → ferme l'angle mort record_failed) ; `failed`/`canceled` → annuler le drapeau optimiste (`refunded=false`) pour que le commerçant sache que ça n'a pas marché. Comme `stripe_refund_id` peut manquer (cas record_failed), on **ajoute `metadata:{ order_id }`** au `refunds.create` pour retrouver la commande de façon fiable par `order.id` (PK globalement unique).

## Boundaries & Constraints

**Always:** étendre le **webhook existant** `app/api/billing/webhook/route.ts` (mêmes vérif de signature `STRIPE_WEBHOOK_SECRET`, même lecture `req.text()`, même style tolérant renvoyant 200) ; mapper l'événement→commande par `refund.metadata.order_id` **en priorité**, repli `stripe_refund_id = refund.id` ; réconciliation **idempotente** (filtres `.eq`) et **tolérante** (try/catch, colonnes 0047 peuvent manquer → ne pas jeter) ; `succeeded` écrit `refunded=true, refunded_at, stripe_refund_id=refund.id` ; `failed`/`canceled` remet `refunded=false` **uniquement** si la ligne correspond à CE refund (par `order_id`) ; ajouter `metadata:{ order_id: order.id }` au `refunds.create` de `lib/order-refund.ts` ; `order.id` (UUID PK) suffit à l'isolation (pas de fuite multi-tenant).

**Ask First:** ajouter une colonne d'état riche `refund_status` (migration 0048) — par défaut on s'en tient au booléen `refunded` ; modifier la mécanique d'idempotence du `refunds.create` (clé par tentative pour permettre un retry après échec) — hors périmètre F2.

**Never:** surcharger le case `charge.refunded` existant (déjà utilisé pour le clawback parrainage) ; nouvelle route/endpoint ou nouveau secret ; nouvelle migration (les colonnes 0047 suffisent) ; toucher au `status` de fulfilment ; scoper la réconciliation sur autre chose que l'identité de la commande (l'événement Stripe signé est la source de vérité) ; faire échouer le webhook (toujours 200 sauf signature invalide, comme l'existant).

## I/O & Edge-Case Matrix

Handler `reconcileRefundEvent(db, refund)` (logique de réconciliation, tolérante) :

| Scenario | Input / State | Expected Output / Behavior |
|---|---|---|
| Refund réussi | `refund.status="succeeded"`, `metadata.order_id` connu | `update({refunded:true, refunded_at, stripe_refund_id:refund.id}).eq("id",order_id).eq("refunded",false)` — ferme record_failed |
| Refund réussi, déjà enregistré | idem, `refunded` déjà true | 0 ligne modifiée, aucun effet (idempotent) |
| Refund échoué/annulé | `status="failed"`/`"canceled"` | `update({refunded:false, refunded_at:null, stripe_refund_id:null}).eq("id",order_id)` — annule le drapeau optimiste |
| Refund pending | `status="pending"` | no-op |
| Pas de order_id, repli | `metadata` absent | mapper par `stripe_refund_id = refund.id` ; si introuvable → no-op tolérant |
| Colonnes 0047 absentes | update lève/`{error}` | avalé (try/catch), 200 renvoyé |

</frozen-after-approval>

## Code Map

- `app/api/billing/webhook/route.ts` -- ajouter au `switch` (l.112) les cases `refund.updated` et `charge.refund.updated` → appeler un helper `reconcileRefundEvent(db, refund)`. Récupérer l'objet `Refund` : pour `refund.updated`, `event.data.object` EST le refund ; pour `charge.refund.updated`, idem (l'objet est un refund). Toujours renvoyer 200 (style existant). NE PAS toucher `charge.refunded` (l.442, clawback).
- `lib/order-refund.ts` -- `performOrderRefund` : ajouter `metadata: { order_id: order.id }` au premier argument de `stripe.refunds.create` (l.75-82). Aucune autre modif (comportement inchangé).
- `lib/refund-reconcile.ts` (nouveau) -- `reconcileRefundEvent(db, refund)` : logique pure d'effets (ne jette pas), map `order_id` (metadata) sinon `stripe_refund_id`, applique la matrice ci-dessus. Renvoie un petit résultat structuré (`{action:"confirmed"|"reverted"|"noop", orderId?}`) pour le log/test.
- `tests/stripe-webhook.test.ts` -- étendre : enrichir le mock `getAdminClient` (builder `update().eq()...` capturant payload+filtres, cf. `tests/order-refund.test.ts`) ; asserts sur `refund.updated` succeeded → refunded=true ; failed → refunded=false ; pending → no-op ; mapping par metadata puis par stripe_refund_id.
- `tests/refund-reconcile.test.ts` (nouveau, optionnel si logique dans le helper) -- matrice directe de `reconcileRefundEvent`.

## Tasks & Acceptance

**Execution:**
- [x] `lib/refund-reconcile.ts` -- `reconcileRefundEvent(db, refund)` (matrice, idempotent, tolérant, mapping metadata→stripe_refund_id, anti-clobber, observable)
- [x] `lib/order-refund.ts` -- ajouter `metadata:{ order_id }` au `refunds.create`
- [x] `app/api/billing/webhook/route.ts` -- cases `refund.updated` + `refund.failed` + `charge.refund.updated` → `reconcileRefundEvent`
- [x] `tests/refund-reconcile.test.ts` + extension `tests/stripe-webhook.test.ts` -- matrice (faux DB modélisant les lignes) + intégration webhook

**Acceptance Criteria:**
- Given un refund `succeeded` dont l'écriture DB initiale avait échoué (`refunded=false`, `stripe_refund_id` absent), when le webhook `refund.updated` arrive, then la commande passe `refunded=true` avec `stripe_refund_id` renseigné (bouton « Rembourser » disparaît → plus de double-refund) ; rejouer l'événement ne change rien (idempotent).
- Given un refund initialement marqué `refunded=true` puis `failed`/`canceled`, when le webhook arrive, then la commande repasse `refunded=false` (le commerçant voit que le remboursement n'a pas abouti).
- Given un refund `pending`, when le webhook arrive, then aucun changement.
- Given la signature webhook invalide, when la requête arrive, then 400 (comportement existant inchangé) ; un refund d'un événement inconnu/introuvable → 200 sans effet.

## Design Notes

- **Pourquoi metadata est requis (pas optionnel) :** dans le cas `record_failed`, `stripe_refund_id` n'a jamais été écrit sur la commande → un mapping par `stripe_refund_id` échouerait justement dans le cas qu'on veut réparer. `refund.metadata.order_id` (posé à la création) est le seul lien fiable. On garde `stripe_refund_id` en repli pour les refunds créés avant cette story.
- **Isolation :** `order.id` est un UUID PK globalement unique ; matcher dessus est sûr sans filtre `business_id` (l'événement Stripe signé est déjà la source de vérité).
- **Pas de migration :** le booléen `refunded` + `refunded_at` + `stripe_refund_id` (0047) suffisent. Un état `refund_status` plus fin est explicitement Ask-First.

## Suffix — Post-Review Fix

Revue à 3 relecteurs (chemin argent / webhook). **Correctif majeur (bug argent) :** la révocation `failed`/`canceled` ciblait la commande par `order_id` sans lier l'update à CE refund → un événement `failed` tardif d'un 1er refund, livré **hors-ordre** après le `succeeded` d'un 2ᵉ, aurait effacé un bon remboursement. Corrigé : la révocation est **gardée par `stripe_refund_id = refund.id` + `refunded = true`** (anti-clobber + idempotent) et **conserve** `stripe_refund_id` (audit). **Autres correctifs :** `refunded_at` horodaté depuis `refund.created` (pas l'heure de traitement) ; `.select("id")` → `noop` honnête sur 0 ligne (ne prétend plus « confirmed »/« reverted » à tort) ; `case "refund.failed"` ajouté (assurance selon la version d'API) ; `reportError` sur échec DB (observabilité). **Tests renforcés :** faux DB modélisant les lignes + `.eq()` → l'**anti-clobber** et l'**idempotence 0-ligne** sont vérifiés comportementalement (pas seulement la requête). **Reportés :** garde remboursement partiel, table de dédup d'événements + désambiguïsation « 0 ligne » (déjà-réconcilié vs introuvable). **Rejeté :** `getAdminClient()` hors try (le try/catch externe du webhook renvoie 500 → retry Stripe, acceptable).

## Suggested Review Order

**Cœur de réconciliation (chemin argent)**

- `reconcileRefundEvent` : mapping metadata→fallback, ne jette jamais, idempotent, observable.
  [`refund-reconcile.ts:51`](../../lib/refund-reconcile.ts#L51)
- Anti-clobber de la révocation (garde `stripe_refund_id` + `refunded=true`).
  [`refund-reconcile.ts:26`](../../lib/refund-reconcile.ts#L26)

**Lien fiable événement→commande**

- `metadata:{ order_id }` posé à la création (seul lien dans le cas record_failed).
  [`order-refund.ts:84`](../../lib/order-refund.ts#L84)

**Branchement webhook (endpoint existant, toujours 200)**

- Cases `refund.updated` / `refund.failed` / `charge.refund.updated` → helper ; `charge.refunded` intact.
  [`webhook/route.ts:515`](../../app/api/billing/webhook/route.ts#L515)

**Tests (anti-clobber vérifié au niveau ligne)**

- Faux DB modélisant les lignes ; clobber, idempotence, repli, tolérance.
  [`refund-reconcile.test.ts:1`](../../tests/refund-reconcile.test.ts#L1)

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: 0 erreur
- `npm run lint` -- expected: 0 warning
- `npm test` -- expected: tous verts (dont réconciliation + webhook)
- `npm run build` -- expected: succès

**Manual checks:**
- En mode Stripe test : provoquer un refund `succeeded` (webhook) → commande `refunded=true` ; simuler un `refund.updated` `failed` (CLI Stripe `stripe trigger`) → `refunded=false`. Vérifier qu'un refund sans `order_id` (créé avant cette story) est réconcilié par `stripe_refund_id`.
