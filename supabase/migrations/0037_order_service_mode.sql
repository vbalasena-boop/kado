-- Kado — Click & collect : mode de service (sur place / à emporter) + table.
-- Un client déjà sur place commande depuis sa table, évite la file, et reçoit
-- l'alerte quand c'est prêt. À exécuter dans Supabase > SQL Editor.

alter table orders
  add column if not exists service_mode text,   -- 'sur_place' | 'emporter'
  add column if not exists table_label text;     -- ex. "Table 5"
