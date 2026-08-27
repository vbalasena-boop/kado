-- Kado 0068 — Pré-calcul des stats admin (scalabilité).
--
-- Les agrégats PLATEFORME non bornés (total des tours, gagnés, récupérés, par
-- canal, et nombre de tours PAR commerce) scannaient toute la table `plays` à
-- chaque ouverture de /admin — la requête la plus lourde de l'app. On les
-- pré-calcule dans un cache rafraîchi une fois par jour par le cron.
--
-- Les compteurs bornés dans le temps (aujourd'hui / ce mois-ci) restent en
-- direct : ils sont servis par un index sur created_at (ajouté ici), donc peu
-- coûteux même à grande échelle.
--
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

-- Index pour les comptes bornés (aujourd'hui / ce mois) côté plateforme.
create index if not exists plays_created_at_idx on plays (created_at);

-- Cache des agrégats plateforme (une seule ligne, id = 1).
create table if not exists admin_stats_cache (
  id int primary key,
  plays_total bigint not null default 0,
  insta bigint not null default 0,
  review bigint not null default 0,
  won bigint not null default 0,
  redeemed bigint not null default 0,
  refreshed_at timestamptz,
  constraint admin_stats_cache_single check (id = 1)
);

-- Nombre de tours par commerce (pré-calculé).
create table if not exists business_play_totals (
  business_id uuid primary key references businesses(id) on delete cascade,
  plays int not null default 0
);

-- Recalcule le cache. Appelée par le cron quotidien (best-effort). Tout est
-- fait dans la transaction de la fonction : les lecteurs voient l'ancien état
-- jusqu'au commit (pas de fenêtre vide).
create or replace function refresh_admin_stats()
returns void
language plpgsql
as $$
begin
  insert into admin_stats_cache (id, plays_total, insta, review, won, redeemed, refreshed_at)
  select
    1,
    count(*),
    count(*) filter (where play_type = 'instagram'),
    count(*) filter (where play_type = 'review'),
    count(*) filter (where prize_label is null or lower(prize_label) not like '%rien%'),
    count(*) filter (where redeemed_at is not null),
    now()
  from plays
  on conflict (id) do update set
    plays_total = excluded.plays_total,
    insta       = excluded.insta,
    review      = excluded.review,
    won         = excluded.won,
    redeemed    = excluded.redeemed,
    refreshed_at = excluded.refreshed_at;

  delete from business_play_totals;
  insert into business_play_totals (business_id, plays)
    select business_id, count(*)::int
    from plays
    group by business_id;
end;
$$;
