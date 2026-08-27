-- Kado 0070 — Confirmation de retrait client + rappel « commande prête ».
--
-- Le client peut confirmer lui-même qu'il a récupéré sa commande (bouton sur la
-- page de suivi). Un rappel « votre commande vous attend » n'est envoyé QUE si,
-- passé un délai, la commande est toujours « prête », NON confirmée par le
-- client ET non marquée « remise » par le commerçant — pour ne jamais relancer
-- quelqu'un qui a déjà récupéré.
--
--   - orders.picked_up_at       : le client a confirmé le retrait
--   - orders.pickup_reminder_at : rappel envoyé (anti-doublon)
--
-- Colonnes lues de façon tolérante côté application.
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

alter table orders
  add column if not exists picked_up_at timestamptz,
  add column if not exists pickup_reminder_at timestamptz;
