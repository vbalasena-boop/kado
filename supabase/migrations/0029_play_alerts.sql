-- Alerte push au commerçant à chaque cadeau gagné (temps réel).
-- Désactivée par défaut pour ne pas surprendre / spammer.
alter table wheel_configs
  add column if not exists play_alerts boolean not null default false;
