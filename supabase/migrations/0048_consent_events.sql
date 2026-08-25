-- Kado — RGPD : journal d'audit du consentement (Art. 7(1) « démontrer »)
-- Table append-only qui trace chaque changement de consentement marketing
-- (ré-abonnement confirmé, désinscription) du périmètre fidélité.
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.
--
-- Sécurité : comme le reste du schéma Kado, RLS est activé SANS policy — aucun
-- accès client direct. L'application écrit uniquement côté serveur avec la clé
-- service_role (qui contourne RLS). Calqué sur `0043_prospection.sql` (events).

create extension if not exists "pgcrypto";

-- ---------- Journal d'événements de consentement (audit RGPD) ----------
create table if not exists consent_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  card_id uuid references loyalty_cards(id) on delete set null,
  email text not null,
  type text not null
    check (type in ('resubscribe_confirmed', 'unsubscribed')),
  source text,                          -- route/origine de l'événement
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists consent_events_business_email_idx
  on consent_events(business_id, email, created_at);
create index if not exists consent_events_created_idx
  on consent_events(created_at);

-- ---------- RLS (aucun accès client direct — serveur/service_role only) ----------
alter table consent_events enable row level security;
