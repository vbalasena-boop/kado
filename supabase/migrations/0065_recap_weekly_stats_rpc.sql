-- Kado 0065 — Récap hebdo agrégé côté SQL (scalabilité).
--
-- Avant : le cron du lundi lançait 7 requêtes count PAR commerce actif
-- (O(7·N) requêtes), ce qui dépasse la fenêtre de 60 s vers ~2 500 commerces.
-- Ici, UNE seule requête agrège tout, groupé par commerce, et ne renvoie que
-- les commerces ACTIFS ayant eu de l'activité cette semaine (le filtre « rien à
-- raconter » est fait en SQL).
--
-- Fenêtres : `week_start` = il y a 7 j, `prev_start` = il y a 14 j.
-- `gagnes` reprend EXACTEMENT la sémantique de labelIsLosing (libellé nul ou ne
-- contenant pas « rien »), comme le repli JS.
--
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

create or replace function recap_weekly_stats(week_start timestamptz, prev_start timestamptz)
returns json
language sql
stable
as $$
  with p as (
    select business_id,
      count(*) filter (where created_at >= week_start) as tours,
      count(*) filter (
        where created_at >= week_start
          and (prize_label is null or lower(prize_label) not like '%rien%')
      ) as gagnes,
      count(*) filter (where redeemed_at is not null and redeemed_at >= week_start) as echanges,
      count(*) filter (where created_at >= prev_start and created_at < week_start) as prev_tours
    from plays
    where created_at >= prev_start or redeemed_at >= prev_start
    group by business_id
  ),
  l as (
    select business_id,
      count(*) filter (where created_at >= week_start) as emails,
      count(*) filter (where created_at >= prev_start and created_at < week_start) as prev_emails
    from leads
    where created_at >= prev_start
    group by business_id
  ),
  c as (
    select business_id,
      count(*) filter (where created_at >= week_start) as fid,
      count(*) filter (where created_at >= prev_start and created_at < week_start) as prev_fid
    from loyalty_cards
    where created_at >= prev_start
    group by business_id
  )
  select coalesce(json_agg(row_to_json(t)), '[]'::json)
  from (
    select
      b.id as business_id,
      coalesce(p.tours, 0)      as tours,
      coalesce(p.gagnes, 0)     as gagnes,
      coalesce(p.echanges, 0)   as echanges,
      coalesce(l.emails, 0)     as emails,
      coalesce(c.fid, 0)        as fid,
      coalesce(p.prev_tours, 0) as prev_tours,
      coalesce(l.prev_emails, 0) as prev_emails,
      coalesce(c.prev_fid, 0)   as prev_fid
    from businesses b
    left join p on p.business_id = b.id
    left join l on l.business_id = b.id
    left join c on c.business_id = b.id
    where b.status = 'active'
      and (coalesce(p.tours, 0) + coalesce(l.emails, 0) + coalesce(c.fid, 0)) > 0
  ) t;
$$;
