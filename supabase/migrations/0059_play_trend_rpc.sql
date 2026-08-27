-- Kado 0059 — Stats avancées : tendance d'activité (tours par jour).
--
-- Agrégation par JOUR côté SQL (pas de transfert de toutes les lignes plays).
-- Renvoie [[jour, nombre], …] pour les jours ayant au moins un tour depuis
-- `since` ; les jours à zéro sont complétés côté application.
--
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

create or replace function dashboard_play_trend(biz uuid, since timestamptz)
returns json
language sql
stable
as $$
  select coalesce(
    (
      select json_agg(json_build_array(d::text, c) order by d)
      from (
        select date_trunc('day', created_at)::date as d, count(*)::int as c
        from plays
        where business_id = biz and created_at >= since
        group by 1
      ) t
    ),
    '[]'::json
  );
$$;
