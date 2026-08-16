-- Type de jeu choisi par le commerçant.
alter table wheel_configs
  add column if not exists game_type text not null default 'wheel';
-- valeurs : 'wheel' (roue) | 'scratch' (carte à gratter) | 'slot' (machine à sous)
