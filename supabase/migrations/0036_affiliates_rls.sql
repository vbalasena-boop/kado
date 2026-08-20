-- Correctif de sécurité : active la Row Level Security sur les tables affiliés.
--
-- Les tables `affiliates` (0032) et `affiliate_commissions` (0032) n'activaient
-- pas la RLS, contrairement aux 13 autres tables du schéma. Sous les défauts
-- Supabase (le rôle `anon` — la clé publique du navigateur — a accès aux tables
-- du schéma public), ces tables financières étaient potentiellement lisibles
-- publiquement : PII des vendeurs, montants de commissions, établissements
-- rattachés, et la colonne `stats_key` supposée secrète (0034).
--
-- Toute l'application lit ces tables via `getAdminClient()` (clé service_role,
-- qui CONTOURNE la RLS). Activer la RLS sans politique applique donc un
-- « default-deny » : le public ne peut plus rien lire, l'app côté serveur
-- continue de fonctionner à l'identique.

alter table affiliates enable row level security;
alter table affiliate_commissions enable row level security;
