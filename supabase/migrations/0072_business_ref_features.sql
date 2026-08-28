-- Kado 0072 — Identifiant lisible + fonctions au cas par cas par établissement.
--
-- Deux besoins « flotte de commerces » :
--
--   1. businesses.ref  : un identifiant COURT et LISIBLE (KADO-0001, KADO-0002…)
--      attribué automatiquement à chaque établissement, pour les retrouver
--      facilement quand on en a beaucoup (recherche admin, support téléphone).
--      Le `slug` et l'`id` UUID restent les identifiants techniques ; `ref` est
--      un repère humain, unique, séquentiel.
--
--   2. businesses.features : un sac de drapeaux JSON ({ "clef": true }) pour
--      activer/personnaliser des fonctions OPTIONNELLES sur UN seul établissement
--      sans toucher aux autres (extensible sans nouvelle migration).
--
-- Colonnes lues de façon tolérante côté application.
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

-- 1) Identifiant lisible séquentiel -----------------------------------------

alter table businesses
  add column if not exists ref text;

-- Compteur global partagé (attribution atomique, jamais deux fois le même).
create sequence if not exists business_ref_seq;

-- Attribution automatique à l'insertion (si non fourni).
create or replace function set_business_ref()
returns trigger
language plpgsql
as $$
begin
  if new.ref is null then
    new.ref := 'KADO-' || lpad(nextval('business_ref_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_business_ref on businesses;
create trigger trg_set_business_ref
  before insert on businesses
  for each row execute function set_business_ref();

-- Rattrapage des établissements existants (ordre de création), sans écraser
-- ceux qui auraient déjà un ref.
do $$
declare r record;
begin
  for r in
    select id from businesses where ref is null order by created_at asc, id asc
  loop
    update businesses
      set ref = 'KADO-' || lpad(nextval('business_ref_seq')::text, 4, '0')
      where id = r.id;
  end loop;
end $$;

-- Unicité (après rattrapage pour éviter tout conflit).
create unique index if not exists businesses_ref_key on businesses(ref);

-- 2) Fonctions optionnelles au cas par cas ----------------------------------

alter table businesses
  add column if not exists features jsonb not null default '{}'::jsonb;
