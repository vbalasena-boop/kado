-- Kado — « Bipeur digital » : le client scanne un QR au comptoir, Kado lui
-- attribue un numéro de suivi (indépendant de la caisse). Le commerçant écrit
-- ce numéro sur la commande et tape « prêt » quand c'est fait.
-- À exécuter dans Supabase > SQL Editor.

alter table orders
  add column if not exists buzzer_no int;

create index if not exists orders_buzzer_idx
  on orders (business_id, created_at desc)
  where buzzer_no is not null;
