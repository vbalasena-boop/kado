-- Téléphone du commerçant (contact installation, accompagnement).
alter table businesses
  add column if not exists phone text;
