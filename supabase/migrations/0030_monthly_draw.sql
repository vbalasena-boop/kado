-- Tirage au sort mensuel (option). Jeu-concours gratuit sans obligation
-- d'achat : un gagnant tiré au hasard chaque 1er du mois parmi les clients
-- ayant laissé leur e-mail le mois précédent.
alter table wheel_configs
  add column if not exists monthly_draw boolean not null default false,
  add column if not exists monthly_draw_prize text,
  add column if not exists monthly_draw_at timestamptz;
