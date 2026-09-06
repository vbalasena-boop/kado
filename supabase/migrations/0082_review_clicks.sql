-- Kado 0082 — Clics sur le lien « Laisser un avis Google ».
--
-- (Renumérotée de 0077 → 0082 : le préfixe 0077 était déjà pris par
--  0077_sms_on_ready.sql d'un autre chantier. Le CLI Supabase indexe les
--  migrations par ce préfixe — deux fichiers « 0077 » cassaient `db push`.)
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
