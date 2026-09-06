-- Kado 0079 — Invitation avis élargie à TOUS les clients (leads).
--
-- L'invitation à laisser un avis Google (0062) ne visait que les clients
-- FIDÈLES (au moins une carte complétée). Ce nouvel opt-in permet d'inviter
-- AUSSI les clients ayant simplement laissé leur e-mail (leads) — audience
-- opt-in déjà emailée (campagnes/relances) avec désinscription gérée.
--
-- Conforme : e-mail neutre, non récompensé, envoi UNIQUE par client
-- (`review_invite_leads_at`), respect de la désinscription. Les leads déjà
-- fidèles sont exclus (ils relèvent de l'invitation 0062) : pas de doublon.
--
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

alter table wheel_configs
  add column if not exists review_invite_leads boolean not null default false;

alter table leads
  add column if not exists review_invite_leads_at timestamptz;
