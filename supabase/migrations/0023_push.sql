-- Kado — notifications push (téléphone verrouillé) pour les commerçants
-- À exécuter dans Supabase > SQL Editor.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;
create index if not exists push_subs_business_idx on push_subscriptions (business_id);
