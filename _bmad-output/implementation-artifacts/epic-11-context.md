# Epic 11 Context: Commandes — remboursements & litiges

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Doter les commandes click & collect (déjà livrées en Epic 3) de la gestion des
**erreurs et retours** : annuler une commande et rembourser une commande payée en ligne
via **Stripe Connect**, en couvrant le cas des litiges. C'est l'unique brique manquante
(FR27 🔶) d'un domaine par ailleurs livré — le catalogue, la commande avec total
recalculé serveur, le code de retrait, les statuts de commande, le paiement en ligne
Stripe Connect optionnel et les notifications e-mail/push existent déjà. L'epic ajoute le
remboursement sur le **compte connecté** du commerçant et la transition de statut associée,
sans corrompre l'état de la commande en cas d'échec Stripe.

## Stories

- Story 11.1: Rembourser une commande payée en ligne
- Story 11.2: Annuler une commande

## Requirements & Constraints

- FR27 : remboursement / annulation / litige d'une commande. Le paiement en ligne (FR25)
  se fait via **Stripe Connect** et reste **optionnel** — une commande peut être payée sur
  place, auquel cas il n'y a rien à rembourser côté Stripe.
- Le remboursement doit être créé sur le **compte connecté** du commerçant (pas sur le
  compte plateforme), cohérent avec la façon dont le paiement a été encaissé.
- **Robustesse d'état** : un échec Stripe affiche une erreur claire et ne doit **jamais**
  laisser la commande dans un état corrompu / incohérent (pas de statut « remboursée » sans
  refund réellement créé).
- **Notifications best-effort** (NFR5) : informer le client d'une annulation par e-mail/push
  est non bloquant — un échec d'envoi ne casse pas l'opération.
- **Statuts de commande** (FR26) déjà en place : l'epic ajoute les transitions
  « remboursée » et « annulée ».
- Sécurité (NFR3) : signature webhook vérifiée, rate-limit fail-closed, en-têtes — à
  respecter pour toute route touchant Stripe.

## Technical Decisions

- **Stack imposée** (brownfield, app Next.js 14 déjà existante) : Next.js 14 App Router,
  Supabase (Auth/Postgres/Storage), Stripe + **Stripe Connect** (NFR4), web-push, Resend
  (e-mail), Sentry, Vercel.
- **Wrapper de route obligatoire** `lib/api.ts` : toute nouvelle route l'utilise. Le
  déclenchement du remboursement/annulation se fait depuis le **dashboard commerçant** →
  route protégée par le wrapper commerçant (`merchantRoute`).
- **Accès données** via `service_role` avec **filtre `business_id` explicite** (isolation
  multi-tenant, RLS default-deny + policies SELECT). Ne jamais lire/écrire une commande sans
  filtrer par tenant.
- **Modèle de commande** (champs cités par les critères d'acceptation) : `paid` (booléen) et
  `stripe_session_id` déterminent l'éligibilité au remboursement Stripe ; le statut de
  commande porte les valeurs « remboursée » / « annulée ».
- **Migrations SQL** versionnées via CLI Supabase (`supabase db push`), numérotation
  séquentielle et idempotentes, si un nouveau statut/colonne est nécessaire.
- **Tests** : vitest ; les chemins Stripe sont des **cibles sensibles** explicitement citées
  (au même titre que le webhook Stripe et l'anti-fraude) — couvrir la création du refund,
  l'échec Stripe et la non-corruption de l'état.

## UX & Interaction Patterns

- Le remboursement et l'annulation se déclenchent **depuis le dashboard commerçant** sur une
  commande existante.
- En cas d'échec Stripe : **message d'erreur clair** au commerçant, état de la commande
  inchangé.
- À l'annulation d'une commande payée en ligne, proposer / déclencher le remboursement
  (story 11.1) et notifier le client (e-mail/push best-effort).

## Cross-Story Dependencies

- **11.2 dépend de 11.1** : l'annulation d'une commande payée en ligne réutilise le
  mécanisme de remboursement défini en 11.1 (proposé ou déclenché lors de l'annulation).
