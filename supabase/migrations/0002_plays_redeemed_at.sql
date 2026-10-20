-- Horodatage de récupération d'un cadeau en caisse (plays.redeemed_at).
--
-- RÉGULARISATION : la colonne est utilisée par le code (validation en caisse,
-- stats) et par les migrations 0051, 0053, 0064… mais aucune migration ne la
-- créait : elle avait été ajoutée à la main en production.
-- Numérotée 0002 pour passer AVANT ces migrations sur une base neuve.
-- `add column if not exists` : sans effet là où elle existe (prod).
-- NULL = cadeau non encore récupéré.
alter table plays
  add column if not exists redeemed_at timestamptz;
