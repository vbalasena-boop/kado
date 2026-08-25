---
title: 'Story 11.1 — Rembourser une commande payée en ligne (Stripe Connect)'
type: 'feature'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'fbfdaea33ca2c46303cb292c94f4b8af734f6536'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Une commande click & collect payée en ligne (`orders.paid=true`, `stripe_session_id` présent) n'a aucun moyen d'être remboursée : le dashboard ne propose pas l'action et aucune route Stripe ne crée le refund. Le commerçant ne peut donc pas gérer une erreur ou un retour client.

**Approach:** Ajouter une action « Rembourser » au dashboard commandes qui, via une nouvelle route `merchantRoute`, crée le **refund Stripe** puis marque la commande remboursée. Le paiement C&C étant une **charge destination** (transfert vers le compte connecté), le refund est émis **sur le compte plateforme** avec `reverse_transfer: true` (et `refund_application_fee: true`), jamais avec `{ stripeAccount }`. L'état commande n'est écrit **qu'après** succès Stripe.

## Boundaries & Constraints

**Always:** route protégée par `merchantRoute` (auth commerçant) ; commande relue et écrite **filtrée par `business_id`** (isolation multi-tenant) ; **ordre strict** : (1) contrôler l'éligibilité, (2) récupérer le `payment_intent` depuis la Checkout Session, (3) créer le refund Stripe, (4) **seulement en cas de succès** écrire `refunded=true, refunded_at, stripe_refund_id` ; **idempotence** via clé d'idempotence Stripe dérivée de `order.id` **et** garde `refunded=false` (avant appel + filtre à l'écriture) ; un échec Stripe → **erreur claire** (message FR) et **aucune** modification de la commande ; refund **total** ; montants en **centimes** ; migration idempotente `0047` (colonnes `if not exists`).

**Ask First:** rembourser un **montant partiel** ; rembourser une commande **payée sur place** (pas de charge Stripe) ; changer le mécanisme (direct charge au lieu de destination).

**Never:** passer `{ stripeAccount }` / en-tête `Stripe-Account` au refund (le C&C est une charge destination — le refund est plateforme) ; rembourser sans `reverse_transfer` (l'argent resterait chez le commerçant) ; écrire l'état « remboursée » avant le succès Stripe ; écraser le `status` de fulfilment (new/ready/done/cancelled) — le remboursement est un **drapeau distinct** ; toucher au webhook d'encaissement, au tirage/jeu, ou aux flux d'abonnement Stripe ; double-rembourser une commande déjà remboursée.

## I/O & Edge-Case Matrix

`refundEligibility(order)` (logique pure, `lib/orders.ts`) :

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Éligible | `paid=true`, `stripe_session_id` non vide, `refunded` falsy | `{ ok: true }` | N/A |
| Non payée en ligne | `paid` falsy **ou** `stripe_session_id` vide | `{ ok: false, code: "not_online_paid" }` | route → 400 message clair |
| Déjà remboursée | `refunded=true` | `{ ok: false, code: "already_refunded" }` | route → 400 message clair |

Route `POST /api/dashboard/orders/refund` :

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Succès | commande éligible, refund Stripe OK | refund créé (plateforme, `reverse_transfer`), commande `refunded=true` ; `{ ok: true }` | N/A |
| Échec Stripe | `refunds.create` lève | **aucune écriture** ; `{ error: "refund_failed", detail }` 502 | catch → réponse erreur, état intact |
| Rejeu (déjà remboursée) | `refunded=true` | pas d'appel Stripe ; 400 `already_refunded` | garde d'éligibilité |
| Commande absente / autre tenant | `id` inconnu sous ce `business_id` | 404 `not_found` | filtre `business_id` |

</frozen-after-approval>

## Code Map

- `supabase/migrations/0047_order_refund.sql` (nouveau) -- `alter table orders add column if not exists refunded boolean not null default false, refunded_at timestamptz, stripe_refund_id text`. Prochain numéro séquentiel (plus haut distinct = 0046).
- `lib/orders.ts` -- ajouter `refundEligibility(order)` (pur, exporté). Voir `createOrderCheckout` l.117-149 : preuve de la **charge destination** (`payment_intent_data.transfer_data.destination`, pas de `{ stripeAccount }`, `application_fee_amount` optionnel via `KADO_ORDER_FEE_BPS`).
- `app/api/dashboard/orders/refund/route.ts` (nouveau, **cœur**) -- `merchantRoute` + `rateLimit` ; zod `{ id: string }` ; relire la commande scoping `business_id` (colonnes tolérantes `id,status,paid,stripe_session_id,refunded,code,total_cents`) ; `refundEligibility` → 400 clair ; `getStripe().checkout.sessions.retrieve(stripe_session_id)` → `payment_intent` (absent → erreur claire) ; `stripe.refunds.create({ payment_intent, reverse_transfer: true, refund_application_fee: true }, { idempotencyKey: \`order-refund-\${order.id}\` })` ; **puis** `update({refunded:true, refunded_at, stripe_refund_id}).eq("id").eq("business_id").eq("refunded", false)`. Squelette = `app/api/dashboard/orders/route.ts` (POST, l.62-113). Forme de l'appel refund/erreurs = `app/api/admin/business/[id]/refund/route.ts` (l.57-84) **mais** plateforme + `reverse_transfer`.
- `lib/stripe.ts` -- `getStripe()` (client plateforme ; pas de `{ stripeAccount }`).
- `app/dashboard/orders/page.tsx` -- ajouter `refunded` au select tolérant des commandes (l.115) et le passer au client.
- `app/dashboard/orders/OrdersClient.tsx` -- type `Order` (l.151-166) : ajouter `refunded?: boolean | null` ; handler `refundOrder(id)` (calque `setStatus` l.612) → `POST /api/dashboard/orders/refund` ; dans `OrderCard` (l.775-863) : si `o.paid && !o.refunded` bouton « Rembourser » (avec `confirm()`), si `o.refunded` badge « ↩️ Remboursée ».
- `tests/order-refund.test.ts` (nouveau) -- matrice `refundEligibility` + tests de route (succès écrit / échec Stripe n'écrit pas / déjà remboursée sans appel). Calque de mocks = `tests/stripe-webhook.test.ts` (l.5-17) : `vi.mock("@/lib/stripe")`, `vi.mock("@/lib/supabase/admin")`, `vi.mock("@/lib/api")` pour injecter `business`.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/0047_order_refund.sql` -- colonnes `refunded` / `refunded_at` / `stripe_refund_id` (idempotent). **Signaler l'application manuelle en prod.**
- [x] `lib/orders.ts` -- `refundEligibility(order)` pur exporté
- [x] `app/api/dashboard/orders/refund/route.ts` -- route refund : éligibilité → retrieve session → refund plateforme `reverse_transfer` → écriture post-succès, idempotente, erreurs claires
- [x] `app/dashboard/orders/page.tsx` -- exposer `refunded` (select tolérant)
- [x] `app/dashboard/orders/OrdersClient.tsx` -- bouton « Rembourser » (si `paid && !refunded`) + badge « Remboursée » + handler
- [x] `tests/order-refund.test.ts` -- matrice éligibilité + tests de route (cœur Stripe/état)

**Acceptance Criteria:**
- Given une commande `paid=true` avec `stripe_session_id`, when le commerçant clique « Rembourser », then un refund Stripe est créé sur le compte connecté (via `reverse_transfer`), la commande devient `refunded=true`, et l'UI affiche « Remboursée ».
- Given un échec Stripe au refund, when l'action est déclenchée, then un message d'erreur clair est renvoyé et la commande **reste inchangée** (`refunded` toujours falsy, pas de `stripe_refund_id`).
- Given une commande déjà remboursée, when on relance le refund, then **aucun** nouvel appel Stripe et la réponse indique « déjà remboursée » (idempotent).
- Given une commande d'un autre commerçant, when le refund est appelé avec son id, then 404 (isolation `business_id`).

## Design Notes

- **Charge destination → refund plateforme.** Le paiement C&C transfère au compte connecté via `transfer_data.destination` sur le compte **plateforme**. Le refund se fait donc avec `getStripe()` **sans** `{ stripeAccount }`, `reverse_transfer: true` (reprend l'argent au commerçant) et `refund_application_fee: true` (rend la commission plateforme si prélevée). Passer `{ stripeAccount }` viserait le mauvais compte.
- **Seul `stripe_session_id` est stocké** (Checkout Session, pas le PaymentIntent). Il faut `sessions.retrieve(...)` pour lire `payment_intent`, puis rembourser via `{ payment_intent }`.
- **Drapeau distinct, pas de surcharge de `status`.** `status` porte le fulfilment (new/ready/done/cancelled) ; un `done` ou un `cancelled` peut être remboursé. Écraser `status='refunded'` perdrait cette info et casserait la story 11.2 (annulation + remboursement). D'où `refunded boolean`.
- **Anti-corruption = ordre + idempotence.** Refund Stripe d'abord, écriture ensuite ; clé d'idempotence `order-refund-{id}` (un rejeu réseau ne double-rembourse pas) + garde/filtre `refunded=false`.
- Exemple d'appel :
  ```ts
  const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!pi) return Response.json({ error: "no_payment_intent" }, { status: 400 });
  const refund = await stripe.refunds.create(
    { payment_intent: pi, reverse_transfer: true, refund_application_fee: true },
    { idempotencyKey: `order-refund-${order.id}` }
  );
  ```

## Suffix — Post-Review Fix

Revue à 3 relecteurs (chemin argent Stripe). **Fait notable :** `paid=true` n'est écrit **que** par le webhook Stripe (kind:order) — il implique donc toujours un paiement en ligne avec `stripe_session_id` → plusieurs findings (bouton sur commande cash, `service_mode` non vérifié) sont des faux positifs (garde UI `o.paid` correcte).

**Correctif appliqué (patch) :** la route **échoue proprement (503 `refund_unavailable`)** si l'état `refunded` ne peut être lu (colonne absente = migration 0047 non appliquée), **avant** tout appel Stripe — remplace le fallback tolérant qui aurait pu **émettre un refund non enregistrable et re-déclenchable** pendant la fenêtre pré-migration. Tests ajoutés (9→12) : lecture en échec → 503 sans Stripe ; `retrieve` lève → 502 ; refund OK mais écriture DB échoue → 502 `refund_recorded_partially` (id conservé) ; assertion des filtres d'`update` (`business_id` + `refunded=false`).

**Reportés** (`deferred-work.md`, non bloquants) : réconciliation du statut réel du refund via webhook (`charge.refund.updated`) + audit `refunded_by`/motif ; notification client au remboursement (la notif est requise par 11.2). **Rejetés** : refund partiel (Ask First, hors périmètre) ; `refund_application_fee: true` inconditionnel (ignoré par Stripe s'il n'y a pas de commission) ; refund indépendant du `status` (voulu — drapeau distinct pour 11.2).

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: 0 erreur
- `npm run lint` -- expected: 0 warning
- `npm test` -- expected: tous verts (dont `tests/order-refund.test.ts`)
- `npm run build` -- expected: succès

**Manual checks:**
- Dashboard commandes → commande « Payé en ligne » → bouton « Rembourser » → confirmation → refund visible dans Stripe (test) sur le compte connecté, badge « Remboursée » ; 2ᵉ clic → « déjà remboursée », pas de double refund ; commande payée sur place → pas de bouton.

## Suggested Review Order

**Mécanique du remboursement (chemin argent)**

- Point d'entrée : refund PLATEFORME `reverse_transfer` (jamais `{ stripeAccount }`), clé d'idempotence.
  [`route.ts:112`](../../app/api/dashboard/orders/refund/route.ts#L112)
- Fail-closed : lecture `refunded` impossible (migration absente) → 503 avant tout Stripe.
  [`route.ts:55`](../../app/api/dashboard/orders/refund/route.ts#L55)
- Garde d'éligibilité/idempotence avant appel Stripe.
  [`route.ts:67`](../../app/api/dashboard/orders/refund/route.ts#L67)

**Logique pure d'éligibilité**

- Payée en ligne + non remboursée, indépendante du `status`.
  [`orders.ts:43`](../../lib/orders.ts#L43)

**Schéma**

- Colonnes de suivi (drapeau distinct, idempotent).
  [`0047_order_refund.sql:11`](../../supabase/migrations/0047_order_refund.sql#L11)

**UI dashboard**

- Handler de remboursement + messages FR.
  [`OrdersClient.tsx:644`](../../app/dashboard/orders/OrdersClient.tsx#L644)

**Tests (cœur Stripe / état)**

- Matrice d'éligibilité + route : succès filtré, 502/503, idempotence.
  [`order-refund.test.ts:165`](../../tests/order-refund.test.ts#L165)
