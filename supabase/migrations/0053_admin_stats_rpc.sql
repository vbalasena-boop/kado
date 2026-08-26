-- Kado 0053 — Agrégats de la console admin côté SQL.
--
-- Avant : /admin récupérait TOUTES les lignes `plays` de TOUS les commerces
-- pour les agréger en JS (stats plateforme + nombre de tours par commerce) —
-- la requête la plus lourde de l'app, qui grossit sans borne. On délègue à
-- Postgres. Chiffres STRICTEMENT identiques (cf. lib/admin-stats.ts, repli).
--
-- `won` = tours NON perdants au sens du LIBELLÉ (labelIsLosing), comme la page.
-- L'index plays(business_id, created_at) (migration 0001) sert le group by.
--
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

-- Statistiques plateforme. Les bornes mois/jour sont passées par l'appelant
-- (mêmes instants que le calcul JS d'origine, fuseau serveur).
create or replace function admin_play_stats(month_start timestamptz, day_start timestamptz)
returns json
language sql
stable
as $$
  select json_build_object(
    'playsTotal', count(*),
    'playsMonth', count(*) filter (where created_at >= month_start),
    'playsToday', count(*) filter (where created_at >= day_start),
    'insta',      count(*) filter (where play_type = 'instagram'),
    'review',     count(*) filter (where play_type = 'review'),
    'won',        count(*) filter (
                    where prize_label is null
                       or lower(prize_label) not like '%rien%'
                  ),
    'redeemed',   count(*) filter (where redeemed_at is not null)
  )
  from plays;
$$;

-- Nombre de tours par commerce : [[business_id, n], …].
create or replace function admin_business_play_counts()
returns json
language sql
stable
as $$
  select coalesce(
    (select json_agg(json_build_array(business_id, c))
     from (
       select business_id, count(*)::int as c
       from plays
       group by business_id
     ) d),
    '[]'::json
  );
$$;
