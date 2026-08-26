-- Kado 0055 — « À la une » : bloc de contenu éditable par le commerçant,
-- affiché aux clients sur la page de jeu et la carte de fidélité (menu du jour,
-- événement à venir, actu…). Un seul message, avec expiration optionnelle.
--
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

alter table wheel_configs
  add column if not exists highlight_title text,
  add column if not exists highlight_text  text,
  add column if not exists highlight_url   text,
  add column if not exists highlight_until date;
