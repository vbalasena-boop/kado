-- Suivi des installations clé en main réalisées (espace admin).
alter table businesses
  add column if not exists setup_done_at timestamptz;
