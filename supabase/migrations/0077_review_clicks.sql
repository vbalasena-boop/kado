-- Kado 0077 — Clics sur le lien « Laisser un avis Google ».
--
-- Le lien avis est NEUTRE (facultatif, non récompensé) mais on veut mesurer
-- s'il est réellement cliqué — l'ancien compteur du tableau de bord comptait
-- les tours `play_type = 'review'` qui n'existent plus (figé/trompeur depuis
-- l'epic 9). On enregistre donc chaque clic, sans aucune donnée personnelle.
--
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

create table if not exists review_clicks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists review_clicks_business_idx
  on review_clicks (business_id, created_at desc);

-- Accès serveur uniquement (service_role), comme le reste.
alter table review_clicks enable row level security;
