-- Kado 0071 — Feedback privé « avant Google ».
--
-- Un client peut signaler un souci EN PRIVÉ (sur la page jeu ou fidélité) pour
-- que le commerçant le rattrape avant qu'il ne laisse un avis Google public.
-- Ouvert à TOUS les clients (jamais conditionné à la satisfaction : pas de
-- review gating). Opt-in commerçant via `feedback_enabled`.
--
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

alter table wheel_configs
  add column if not exists feedback_enabled boolean not null default false;

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  message text not null,
  email text,
  created_at timestamptz not null default now()
);
create index if not exists feedback_business_idx on feedback (business_id, created_at desc);

-- Accès serveur uniquement (service_role), comme le reste.
alter table feedback enable row level security;
