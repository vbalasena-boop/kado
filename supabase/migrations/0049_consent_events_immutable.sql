-- Kado — RGPD : rendre le journal de consentement INFALSIFIABLE (append-only).
-- Complète 0048 : un événement d'audit ne doit JAMAIS être modifié, sinon la
-- preuve de consentement (Art. 7(1)) perd sa valeur.
--
-- Choix délibéré : on bloque seulement les UPDATE. Les DELETE restent possibles
-- car ils sont NÉCESSAIRES au RGPD lui-même :
--   - droit à l'effacement (Art. 17) : supprimer les événements d'un client qui
--     exerce son droit à l'oubli ;
--   - `on delete cascade` : quand un commerce (et ses loyalty_cards) est supprimé,
--     ses événements doivent partir avec (minimisation — pas d'e-mails orphelins).
-- Les INSERT restent évidemment autorisés (c'est le seul usage applicatif).
--
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

create or replace function consent_events_block_update()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'consent_events est append-only : UPDATE interdit (journal d''audit RGPD infalsifiable)';
end;
$$;

drop trigger if exists consent_events_no_update on consent_events;
create trigger consent_events_no_update
  before update on consent_events
  for each row
  execute function consent_events_block_update();
