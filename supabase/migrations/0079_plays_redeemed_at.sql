-- Horodatage de récupération d'un cadeau en caisse (plays.redeemed_at).
--
-- RÉGULARISATION : la colonne est utilisée depuis longtemps par le code
-- (app/api/dashboard/redeem : validation atomique via `.is("redeemed_at", null)`
-- puis pose de l'horodatage ; stats admin/tableau de bord ; index 0064) mais
-- aucune migration ne la créait — elle avait été ajoutée à la main en prod.
-- Sans ce fichier, un déploiement NEUF de la base serait cassé (redeem en 500).
-- `add column if not exists` : sans effet là où elle existe déjà (prod), crée
-- la colonne sur une base vierge. NULL = cadeau non encore récupéré.
alter table plays
  add column if not exists redeemed_at timestamptz;
