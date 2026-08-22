-- Kado — Option « Suivi client au comptoir » (bipeur digital + commande caisse).
-- Le commerçant active/désactive lui-même cette option depuis son espace.
-- À exécuter dans Supabase > SQL Editor.

alter table businesses
  add column if not exists order_tracking boolean not null default false;
