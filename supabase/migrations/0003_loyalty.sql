-- Kado — Carte de fidélité digitale (à tampons), identifiée par e-mail.
-- À exécuter dans Supabase > SQL Editor.

-- 1) Réglages de fidélité, portés par la config de roue
alter table wheel_configs
  add column if not exists loyalty_enabled boolean not null default false,
  add column if not exists loyalty_goal int not null default 10,
  add column if not exists loyalty_reward text not null default 'Une récompense offerte',
  add column if not exists loyalty_reward_emoji text not null default '🎁';

-- 2) Cartes de fidélité (une par e-mail et par établissement)
create table if not exists loyalty_cards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  email text not null,
  code text not null,
  stamps int not null default 0,
  rewards_earned int not null default 0,
  reward_code text,
  reward_ready boolean not null default false,
  created_at timestamptz not null default now(),
  last_stamp_at timestamptz,
  unique (business_id, email)
);
create unique index if not exists loyalty_cards_code_idx
  on loyalty_cards(business_id, code);
create index if not exists loyalty_cards_biz_idx on loyalty_cards(business_id);

-- Accès uniquement côté serveur (clé service_role), comme le reste.
alter table loyalty_cards enable row level security;
