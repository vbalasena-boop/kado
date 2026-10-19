-- Kado — Remboursement d'une commande click & collect payée en ligne.
-- Le paiement C&C est une charge « destination » (transfert vers le compte
-- connecté du commerçant) : le refund se fait sur le compte PLATEFORME avec
-- reverse_transfer, jamais avec { stripeAccount }. Ces colonnes ne portent que
-- le suivi côté Kado ; l'argent est repris chez le commerçant par Stripe.
-- Le remboursement est un DRAPEAU DISTINCT : il ne remplace pas `status`
-- (new/ready/done/cancelled) — une commande « retirée » peut être remboursée.
-- À exécuter dans Supabase > SQL Editor.

alter table orders
  add column if not exists refunded boolean not null default false,
  add column if not exists refunded_at timestamptz,
  add column if not exists stripe_refund_id text;
