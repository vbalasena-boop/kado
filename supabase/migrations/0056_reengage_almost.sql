-- Kado 0056 — Relances automatiques (fidélité), Story 1 : « plus qu'un tampon ».
--
-- reengage_almost : interrupteur commerçant (désactivé par défaut — aucun envoi
--   sans son accord explicite).
-- nudge_almost_at : anti-doublon par carte. Une relance est postérieure au
--   dernier tampon → tant que la carte ne bouge pas, on ne relance pas ; quand
--   le client repasse (nouveau cycle), last_stamp_at redevient > nudge_almost_at
--   et la carte redevient éligible.
--
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

alter table wheel_configs
  add column if not exists reengage_almost boolean not null default false;

alter table loyalty_cards
  add column if not exists nudge_almost_at timestamptz;
