-- Note interne (visible uniquement dans l'espace admin).
alter table businesses
  add column if not exists admin_note text;
