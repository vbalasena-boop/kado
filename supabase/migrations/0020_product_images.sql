-- Kado — Click & collect : photos et descriptions de produits
-- À exécuter dans Supabase > SQL Editor.

alter table products
  add column if not exists image_url text,
  add column if not exists description text;
