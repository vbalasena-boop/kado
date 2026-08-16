-- Croissance : anniversaires, parrainage (clients + commerçants), campagnes.

-- Anniversaire + consentement marketing + parrainage sur les cartes de fidélité
alter table loyalty_cards
  add column if not exists birthday_day int,
  add column if not exists birthday_month int,
  add column if not exists birthday_sent_at timestamptz,
  add column if not exists marketing_ok boolean not null default false,
  add column if not exists unsubscribed_at timestamptz,
  add column if not exists referred_by_card uuid;

-- Réglages fidélité supplémentaires
alter table wheel_configs
  add column if not exists birthday_enabled boolean not null default false,
  add column if not exists birthday_reward text not null default 'Une surprise offerte',
  add column if not exists referral_enabled boolean not null default false;

-- Parrainage entre commerçants
alter table businesses
  add column if not exists referred_by uuid,
  add column if not exists referral_rewarded_at timestamptz;

-- Désinscription des e-mails capturés par la roue
alter table leads
  add column if not exists unsubscribed_at timestamptz;

-- Historique des campagnes e-mail
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  subject text not null,
  body text not null,
  sent_count int not null default 0,
  created_at timestamptz not null default now()
);
alter table campaigns enable row level security;
