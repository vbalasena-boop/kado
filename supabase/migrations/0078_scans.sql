-- Kado 0078 — Scans de la page de jeu (ouverture du QR).
--
-- Complète l'entonnoir du tableau de bord : on mesure combien de clients
-- OUVRENT la page de jeu (≈ scan du QR), pour voir la 1re marche « scan → jeu »
-- (beaucoup scannent puis repartent sans jouer). Aucune donnée personnelle.
--
-- Anti-gonflement : le client ne « beacone » qu'une fois par appareil et par
-- jour (dédup localStorage). Ici on stocke simplement business_id + horodatage.
--
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists scans_business_idx
  on scans (business_id, created_at desc);

-- Accès serveur uniquement (service_role), comme le reste.
alter table scans enable row level security;
