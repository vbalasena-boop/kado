-- Kado 0058 — Relances automatiques (fidélité), Story 3 : « récompense débloquée ».
--
-- reengage_reward : interrupteur commerçant (désactivé par défaut). Quand une
--   carte se complète, le client reçoit immédiatement un e-mail « bravo, votre
--   récompense vous attend » (transactionnel — envoi respectant la
--   désinscription, mais pas conditionné au consentement marketing).
--
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

alter table wheel_configs
  add column if not exists reengage_reward boolean not null default false;
