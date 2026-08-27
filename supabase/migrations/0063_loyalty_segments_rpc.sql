-- Kado 0063 — Segmentation des clients fidélité (agrégat côté SQL).
--
-- Répartit les cartes d'un commerce en 4 segments mutuellement exclusifs, par
-- priorité d'action (cf. lib/segments.ts qui sert de repli à l'identique) :
--   - dormant « à réveiller » : dernière activité < seuil (`cutoff`)
--   - loyal   « fidèles »     : a déjà gagné ≥ 1 récompense
--   - active  « en cours »    : a des tampons sur sa carte en cours
--   - new     « nouveaux »    : inscrit, pas encore de tampon
--
-- Agrégation côté Postgres (aucune ligne loyalty_cards transférée).
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

create or replace function dashboard_loyalty_segments(biz uuid, cutoff timestamptz)
returns json
language sql
stable
as $$
  select json_build_object(
    'dormant', count(*) filter (
      where last_stamp_at is not null and last_stamp_at < cutoff
    ),
    'loyal', count(*) filter (
      where (last_stamp_at is null or last_stamp_at >= cutoff)
        and coalesce(rewards_earned, 0) >= 1
    ),
    'active', count(*) filter (
      where (last_stamp_at is null or last_stamp_at >= cutoff)
        and coalesce(rewards_earned, 0) = 0
        and coalesce(stamps, 0) > 0
    ),
    'new', count(*) filter (
      where (last_stamp_at is null or last_stamp_at >= cutoff)
        and coalesce(rewards_earned, 0) = 0
        and coalesce(stamps, 0) = 0
    ),
    'total', count(*)
  )
  from loyalty_cards
  where business_id = biz;
$$;
