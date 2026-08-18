-- Personnalisation gérée par l'admin (formule « Installation clé en main »).
-- theme_locked = true : la page a été personnalisée par notre équipe ;
-- le commerçant ne peut plus la remplacer via les 3 thèmes standard.
alter table wheel_configs
  add column if not exists theme_locked boolean not null default false;
