-- Kado — durée de validité des cadeaux gagnés (choisie par le commerçant)
-- En jours ; null = illimité. Les commerces existants restent à 30 jours
-- (comportement inchangé).
-- À exécuter dans Supabase > SQL Editor.

alter table wheel_configs
  add column if not exists prize_validity_days int default 30;
