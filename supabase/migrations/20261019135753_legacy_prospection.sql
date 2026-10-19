-- Kado — Prospection (Epic A, story A1)
-- Tables du module interne de prospection (acquisition de commerces clients).
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.
--
-- Sécurité : comme le reste du schéma Kado, RLS est activé SANS policy — aucun
-- accès client direct. L'application lit/écrit uniquement côté serveur avec la
-- clé service_role (qui contourne RLS), dans des routes réservées à l'admin.

create extension if not exists "pgcrypto";

-- ---------- Prospects (commerces à démarcher) ----------
create table if not exists prospects (
  id uuid primary key default gen_random_uuid(),
  place_id text unique,                 -- identifiant Google Places (déduplication)
  name text not null,
  category text,                        -- segment: resto | beaute | boutique | sport | autre
  city text,
  address text,
  google_rating numeric(2,1),           -- note moyenne (0.0–5.0)
  google_reviews_count int,             -- nombre d'avis (signal central)
  google_last_review_at date,           -- fraîcheur (si disponible)
  website text,
  email text,                           -- si trouvable
  instagram_handle text,                -- si trouvable (sans @)
  instagram_active boolean,             -- activité détectée
  score int,                            -- score de priorité calculé
  score_factors jsonb,                  -- explication du score
  status text not null default 'new'
    check (status in (
      'new', 'queued', 'emailed', 'dm_pending', 'dm_sent',
      'replied', 'interested', 'client', 'excluded'
    )),
  exclude_reason text,
  note text,                            -- note libre opérateur
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists prospects_status_idx on prospects(status);
create index if not exists prospects_score_idx on prospects(score desc);
create index if not exists prospects_city_category_idx on prospects(city, category);

-- ---------- Messages générés (email + DM) par prospect ----------
create table if not exists prospect_messages (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  channel text not null check (channel in ('email', 'instagram')),
  step int not null default 1,          -- 1 = initial, 2 = relance
  subject text,                         -- (email uniquement)
  body text not null,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'sent', 'skipped')),
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists prospect_messages_prospect_idx
  on prospect_messages(prospect_id);

-- ---------- Journal d'événements (audit + idempotence) ----------
create table if not exists prospect_events (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  type text not null,                   -- sourced | scored | approved | email_sent
                                        -- | email_bounced | email_replied | dm_sent
                                        -- | unsubscribed | excluded
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists prospect_events_prospect_idx
  on prospect_events(prospect_id, created_at);

-- ---------- Liste de suppression (ne JAMAIS recontacter) ----------
create table if not exists suppression_list (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  reason text not null default 'manual'
    check (reason in ('unsubscribed', 'bounced', 'manual')),
  created_at timestamptz not null default now()
);

-- ---------- RLS (aucun accès client direct — serveur/service_role only) ----------
alter table prospects enable row level security;
alter table prospect_messages enable row level security;
alter table prospect_events enable row level security;
alter table suppression_list enable row level security;
