-- Kado — décor animé de la page de jeu (emojis flottants choisis par le
-- commerçant, ex. 🍝🍅🌿 pour une trattoria). Vide = aucun décor.
-- À exécuter dans Supabase > SQL Editor.

alter table wheel_configs
  add column if not exists decor_emojis text;
