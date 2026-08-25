-- Actions déclenchantes (non-avis) : sous-ensemble de {instagram, loyalty, optin}
-- persisté par commerçant. La story 9.2 fera consommer cette config par le jeu ;
-- 9.1 se limite à la config + persistance, sans effet sur la mécanique.
-- Idempotente : `add column if not exists`. Défaut = au moins une action active.
alter table wheel_configs
  add column if not exists trigger_actions jsonb not null default '["instagram"]'::jsonb;
