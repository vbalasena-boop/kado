-- Kado — Click & collect : e-mail du client (bon de commande)
-- À exécuter dans Supabase > SQL Editor.

alter table orders
  add column if not exists customer_email text;
