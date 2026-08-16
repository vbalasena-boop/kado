-- Option « Installation clé en main » achetée à la souscription.
alter table businesses
  add column if not exists setup_option text,
  add column if not exists setup_paid_at timestamptz;
-- setup_option : 'remote' (à distance) | 'onsite' (sur place) | null
