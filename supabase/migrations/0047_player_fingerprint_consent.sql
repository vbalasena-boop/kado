-- Explicit, per-business consent before the browser fingerprint is calculated
-- or used. The server accesses this table through the service-role client.
create table if not exists public.player_fingerprint_consents (
  business_id uuid not null references public.businesses(id) on delete cascade,
  player_id text not null,
  consented boolean not null,
  policy_version text not null,
  updated_at timestamptz not null default now(),
  primary key (business_id, player_id)
);

alter table public.player_fingerprint_consents enable row level security;
