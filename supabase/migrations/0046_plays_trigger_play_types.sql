-- Story 9.2 : les tours du jeu sont pilotés par les actions non-avis
-- (`trigger_actions` ⊆ {instagram, loyalty, optin}) au lieu des canaux
-- historiques {instagram, review}. On élargit donc le CHECK de plays.play_type
-- pour accepter les nouveaux types de tours.
--
-- `review` est CONSERVÉ dans la liste autorisée : l'avis ne débloque plus de
-- tour (le code ne l'insère plus jamais), mais les lignes historiques déjà en
-- base restent valides et la contrainte ne les rejette pas.
--
-- Idempotente : on retire d'abord la contrainte existante si présente, puis on
-- (re)crée la version élargie.
alter table plays
  drop constraint if exists plays_play_type_check;

alter table plays
  add constraint plays_play_type_check
  check (play_type in ('instagram', 'loyalty', 'optin', 'review'));
