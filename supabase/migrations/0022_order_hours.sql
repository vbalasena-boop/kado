-- Kado — Click & collect : horaires de commande du commerçant
-- jsonb : { "0".."6": ["HH:MM","HH:MM"] ou null } — clé = jour JS
-- (0 = dimanche). Colonne vide = commandes acceptées en permanence.
-- À exécuter dans Supabase > SQL Editor.

alter table businesses
  add column if not exists order_hours jsonb;
