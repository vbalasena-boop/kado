-- Kado 0080 — Client arrivé au comptoir (Click & Collect).
--
-- Le client peut signaler son arrivée depuis la page de suivi (bouton
-- « Je suis arrivé »). Jusqu'ici on n'envoyait qu'un push au commerçant ; on
-- persiste désormais l'horodatage pour AFFICHER un indicateur « client arrivé »
-- sur le tableau des commandes, même si le push a été manqué.
--
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

alter table orders
  add column if not exists arrived_at timestamptz;
