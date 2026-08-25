-- Journal des refus de parrainage (anti-fraude de la boucle produit).
-- Chaque tentative d'attribution refusée (parrain et filleul partageant un
-- identifiant) y laisse une trace pour revue admin.
create table if not exists referral_blocks (
  id uuid primary key default gen_random_uuid(),
  filleul_business_id uuid references businesses(id) on delete cascade,
  parrain_slug text,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists referral_blocks_created_idx
  on referral_blocks (created_at desc);

-- Accès serveur uniquement (service_role contourne RLS), comme les autres tables.
alter table referral_blocks enable row level security;
