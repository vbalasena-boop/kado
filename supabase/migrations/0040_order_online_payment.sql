-- Kado — Paiement en ligne du click & collect via Stripe Connect.
-- L'argent va DIRECTEMENT au commerçant (compte Stripe connecté). Optionnel :
-- désactivé par défaut, le commerçant l'active après avoir connecté Stripe.
-- À exécuter dans Supabase > SQL Editor.

alter table businesses
  add column if not exists stripe_account_id text,
  add column if not exists stripe_account_ready boolean not null default false,
  add column if not exists online_payment boolean not null default false;

alter table orders
  add column if not exists paid boolean not null default false,
  add column if not exists stripe_session_id text;
