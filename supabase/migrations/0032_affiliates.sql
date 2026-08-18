-- Vendeurs / apporteurs d'affaires : chacun a un code et un lien
-- (kado-app.fr?ref=code). Commission FIXE par client signé, versée après le
-- premier paiement réel (jamais pendant l'essai gratuit).
create table if not exists affiliates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  code text not null unique,
  -- montants par formule signée (modifiables par vendeur)
  commission_roue_cents int not null default 6000,      -- Jeux 29 €/mois  → 60 €
  commission_fidelite_cents int not null default 4000,  -- Fidélité 19 €  → 40 €
  commission_complet_cents int not null default 9000,   -- Complet 44 €   → 90 €
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Rattachement du commerçant à son vendeur (posé à l'inscription via cookie)
alter table businesses
  add column if not exists affiliate_id uuid references affiliates(id);

-- Une commission par client, créée au premier paiement (anti-doublon : index
-- unique sur business_id).
create table if not exists affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id),
  business_id uuid not null references businesses(id),
  amount_cents int not null,
  plan text,
  status text not null default 'due', -- due | paid
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create unique index if not exists affiliate_commissions_once
  on affiliate_commissions (business_id);
