-- Kado — module Click & collect (v1, paiement sur place)
-- Activé commerce par commerce, uniquement par l'admin.
-- À exécuter dans Supabase > SQL Editor.

alter table businesses
  add column if not exists click_collect boolean not null default false;

-- Catalogue de produits du commerçant
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  price_cents int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table products enable row level security;
create index if not exists products_business_idx on products (business_id);

-- Commandes des clients (retrait et paiement sur place)
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  code text not null,
  customer_name text not null,
  customer_phone text not null,
  pickup_at text,
  note text,
  items jsonb not null,
  total_cents int not null default 0,
  status text not null default 'new',
  created_at timestamptz not null default now()
);
alter table orders enable row level security;
create index if not exists orders_business_idx on orders (business_id, created_at desc);
