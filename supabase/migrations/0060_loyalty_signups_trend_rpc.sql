-- Kado 0060 — Stats avancées : tendance des inscriptions fidélité.
--
-- Nombre de nouvelles cartes de fidélité créées par JOUR (agrégation côté SQL,
-- aucune ligne loyalty_cards transférée). Renvoie [[jour, nombre], …] pour les
-- jours ayant au moins une inscription depuis `since` ; les jours à zéro et le
-- regroupement mensuel sont gérés côté application.
--
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

create or replace function dashboard_loyalty_signups_trend(biz uuid, since timestamptz)
returns json
language sql
stable
as $$
  select coalesce(
    (
      select json_agg(json_build_array(d::text, c) order by d)
      from (
        select date_trunc('day', created_at)::date as d, count(*)::int as c
        from loyalty_cards
        where business_id = biz and created_at >= since
        group by 1
      ) t
    ),
    '[]'::json
  );
$$;
