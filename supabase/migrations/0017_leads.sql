-- Kado — table des e-mails capturés (leads)
-- Cette table existe déjà en production (créée à la main au début du projet) ;
-- ce fichier la documente et permet de recréer la base de zéro si besoin.
-- À exécuter dans Supabase > SQL Editor (sans effet si la table existe déjà).

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  email text,
  phone text,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table leads enable row level security;

create index if not exists leads_business_idx on leads (business_id);
