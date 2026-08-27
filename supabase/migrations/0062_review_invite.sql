-- Kado 0062 — Invitation à laisser un avis Google (conforme, non récompensée).
--
-- Un commerçant peut inviter ses clients FIDÈLES (ayant complété au moins une
-- carte) à laisser un avis Google. L'e-mail est neutre, envoyé UNE SEULE FOIS
-- par client, sans aucune récompense liée à l'avis et sans sélection par
-- satisfaction : conforme à la politique Google (pas de « review gating »).
--
--   - wheel_configs.review_invite   : le commerçant a activé l'invitation
--   - loyalty_cards.review_invite_at : horodatage d'envoi (anti-doublon)
--
-- Colonnes lues de façon tolérante côté application (jamais dans le hot-path).
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

alter table wheel_configs
  add column if not exists review_invite boolean not null default false;

alter table loyalty_cards
  add column if not exists review_invite_at timestamptz;
