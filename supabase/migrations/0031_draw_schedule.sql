-- Tirage au sort programmable : le commerçant choisit la fréquence (en jours)
-- et la date du prochain tirage. Le cron quotidien déclenche le tirage dès que
-- draw_next_at est atteint, puis reprogramme le suivant.
alter table wheel_configs
  add column if not exists draw_period_days int not null default 30,
  add column if not exists draw_next_at timestamptz;
