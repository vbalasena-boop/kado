-- Kado — choix des canaux par le commerçant
-- Permet d'activer/désactiver le tour Instagram et/ou le tour Avis Google.
-- Par défaut les deux sont activés (comportement inchangé pour l'existant).
-- À exécuter dans Supabase > SQL Editor.

alter table wheel_configs
  add column if not exists instagram_enabled boolean not null default true,
  add column if not exists review_enabled boolean not null default true;
