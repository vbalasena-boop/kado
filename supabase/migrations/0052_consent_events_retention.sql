-- Kado 0052 — RGPD : purge de rétention du journal de consentement.
--
-- Principe (minimisation, Art. 5(1)(e)) : on ne conserve pas indéfiniment
-- l'HISTORIQUE des changements de consentement. Au-delà de la fenêtre de
-- rétention (défaut 1095 j ≈ 3 ans), un événement est purgé.
--
-- MAIS on ne supprime JAMAIS la PREUVE de l'état de consentement le plus
-- récent d'une personne : pour chaque sujet (business_id + email), le dernier
-- événement est toujours conservé, même s'il a plus de 3 ans — c'est lui qui
-- prouve le consentement (ou la désinscription) encore en vigueur (Art. 7(1)).
-- On ne purge donc qu'un événement ANCIEN *et* déjà remplacé par un plus récent.
--
-- DELETE est autorisé (0049 ne bloque que UPDATE). L'index
-- consent_events(business_id, email, created_at) sert la sous-requête.
--
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.
-- La fonction est appelée quotidiennement par le cron (app/api/cron/daily).

create or replace function purge_old_consent_events(retention_days int default 1095)
returns integer
language plpgsql
as $$
declare
  deleted integer;
begin
  with victims as (
    delete from consent_events e
    where e.created_at < now() - make_interval(days => retention_days)
      -- garde-fou : uniquement si un événement PLUS RÉCENT existe pour ce
      -- même sujet (business_id + email) → le dernier état est préservé.
      and exists (
        select 1
        from consent_events e2
        where e2.business_id = e.business_id
          and e2.email = e.email
          and e2.created_at > e.created_at
      )
    returning 1
  )
  select count(*) into deleted from victims;
  return deleted;
end;
$$;
