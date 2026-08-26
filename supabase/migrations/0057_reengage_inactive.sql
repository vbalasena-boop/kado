-- Kado 0057 — Relances automatiques (fidélité), Story 2 : « client inactif ».
--
-- reengage_inactive      : interrupteur commerçant (désactivé par défaut).
-- reengage_inactive_days : délai d'inactivité avant relance (défaut 30 jours).
-- nudge_inactive_at       : anti-doublon par carte (une relance par période
--   d'inactivité ; un nouveau passage rouvre l'éligibilité pour plus tard).
--
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

alter table wheel_configs
  add column if not exists reengage_inactive boolean not null default false,
  add column if not exists reengage_inactive_days int not null default 30;

alter table loyalty_cards
  add column if not exists nudge_inactive_at timestamptz;
