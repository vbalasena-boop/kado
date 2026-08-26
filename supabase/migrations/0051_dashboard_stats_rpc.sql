-- Kado 0051 — Agrégats du tableau de bord côté SQL.
--
-- Avant : /dashboard récupérait TOUTES les lignes `plays` (et `loyalty_cards`)
-- du commerce pour les agréger en JS → scan complet + transfert de milliers de
-- lignes à chaque affichage. On délègue l'agrégation à Postgres.
--
-- Les chiffres sont STRICTEMENT ceux d'avant (cf. lib/dashboard-stats.ts qui
-- sert de repli à l'identique) :
--   - `won` = tours NON perdants au sens du LIBELLÉ (labelIsLosing : le libellé
--     contient « rien », insensible à la casse). On NE tient PAS compte du
--     drapeau `is_losing` ici, pour ne pas changer le nombre déjà affiché.
--   - `distribution` ignore les libellés nuls, triée par fréquence décroissante
--     puis libellé (déterministe).
--
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

create or replace function dashboard_play_stats(biz uuid, since timestamptz)
returns json
language sql
stable
as $$
  select json_build_object(
    'total',    count(*),
    'insta',    count(*) filter (where play_type = 'instagram'),
    'review',   count(*) filter (where play_type = 'review'),
    'last30',   count(*) filter (where created_at >= since),
    -- NON perdant = libellé nul OU libellé ne contenant pas « rien »
    'won',      count(*) filter (
                  where prize_label is null
                     or lower(prize_label) not like '%rien%'
                ),
    'redeemed', count(*) filter (where redeemed_at is not null),
    'distribution', coalesce((
      select json_agg(json_build_array(prize_label, c) order by c desc, prize_label)
      from (
        select prize_label, count(*)::int as c
        from plays
        where business_id = biz and prize_label is not null
        group by prize_label
      ) d
    ), '[]'::json)
  )
  from plays
  where business_id = biz;
$$;

create or replace function dashboard_loyalty_stats(biz uuid)
returns json
language sql
stable
as $$
  select json_build_object(
    'cards',   count(*),
    'stamps',  coalesce(sum(stamps), 0),
    'rewards', coalesce(sum(rewards_earned), 0)
  )
  from loyalty_cards
  where business_id = biz;
$$;
