-- Adresse du commerce (installation sur place, contact).
alter table businesses
  add column if not exists address text;
