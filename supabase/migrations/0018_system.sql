-- Kado — état système (auto-surveillance)
-- Petite table clé/valeur : heartbeat du cron quotidien, dernier résultat
-- des vérifications de santé, etc.
-- À exécuter dans Supabase > SQL Editor.

create table if not exists system_state (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table system_state enable row level security;
