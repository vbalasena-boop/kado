-- Kado — notifications push CLIENTS (offres promo des campagnes)
-- Un même appareil peut suivre plusieurs commerces.
-- À exécuter dans Supabase > SQL Editor.

create table if not exists client_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (business_id, endpoint)
);
alter table client_push_subscriptions enable row level security;
create index if not exists client_push_business_idx
  on client_push_subscriptions (business_id);
