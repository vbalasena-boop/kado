-- Kado 0066 — Relance de conversion « a joué, pas de carte de fidélité ».
--
-- Un joueur laisse son e-mail à la roue (lead) mais n'ouvre jamais sa carte de
-- fidélité. Si le commerçant l'active, on lui envoie UN e-mail l'invitant à
-- ouvrir sa carte — une seule fois, en respectant la désinscription.
--
--   - wheel_configs.convert_nudge : le commerçant a activé la relance
--   - leads.convert_nudge_at       : horodatage d'envoi (anti-doublon)
--
-- Colonnes lues de façon tolérante côté application.
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

alter table wheel_configs
  add column if not exists convert_nudge boolean not null default false;

alter table leads
  add column if not exists convert_nudge_at timestamptz;
