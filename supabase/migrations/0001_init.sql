-- Kado — schéma initial (Epic 1)
-- À exécuter dans Supabase > SQL Editor.

create extension if not exists "pgcrypto";

-- ---------- Établissements (tenants) ----------
create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  logo_url text,
  status text not null default 'active'
    check (status in ('active', 'suspended')),
  subscription_status text not null default 'trial'
    check (subscription_status in ('trial', 'active', 'suspended')),
  subscription_ends_at timestamptz,
  owner_user_id uuid,
  created_at timestamptz not null default now()
);

-- ---------- Configuration de la roue (1-1 avec business) ----------
create table if not exists wheel_configs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references businesses(id) on delete cascade,
  primary_color text not null default '#ffc24d',
  accent_color text not null default '#ff5d73',
  bg_color text not null default '#150c29',
  instagram_url text,
  review_url text,
  compliance_note text
    default 'Le cadeau n''est pas conditionné à la note laissée.'
);

-- ---------- Cadeaux (n par business) ----------
create table if not exists prizes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  label text not null,
  emoji text not null default '🎁',
  weight int not null default 10 check (weight >= 0),
  color text not null default '#ff5d73',
  position int not null default 0
);
create index if not exists prizes_business_idx on prizes(business_id, position);

-- ---------- Tours joués (verrou serveur des 2 tours) ----------
create table if not exists plays (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  player_id text not null,
  play_type text not null check (play_type in ('instagram', 'review')),
  prize_label text,
  prize_code text,
  created_at timestamptz not null default now(),
  unique (business_id, player_id, play_type)
);
create index if not exists plays_business_idx on plays(business_id, created_at);

-- ---------- RLS ----------
-- On bloque tout accès client direct : l'application accède aux données
-- uniquement côté serveur avec la clé service_role (qui contourne RLS),
-- en filtrant explicitement par business_id.
alter table businesses enable row level security;
alter table wheel_configs enable row level security;
alter table prizes enable row level security;
alter table plays enable row level security;
