-- Campagnes programmées : envoi différé par le cron quotidien.
alter table campaigns
  add column if not exists scheduled_for date,
  add column if not exists sent_at timestamptz;

-- Les campagnes déjà existantes ont toutes été envoyées à leur création.
update campaigns set sent_at = created_at where sent_at is null;

-- Les campagnes sont une OPTION payante (+15 €/mois), hors essai gratuit.
alter table businesses
  add column if not exists campaigns_addon boolean not null default false;
