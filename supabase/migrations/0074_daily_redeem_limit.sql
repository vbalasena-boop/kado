-- Kado 0074 — Limite « 1 cadeau récupéré par jour et par client ».
--
-- Option par établissement : quand elle est active, un client peut gagner
-- plusieurs cadeaux (un par action déclenchante) mais n'en fait valider
-- qu'UN SEUL par jour en caisse. Les autres codes restent valables un autre
-- jour (jusqu'à expiration). Contrôle appliqué à la validation en caisse
-- (app/api/dashboard/redeem), identification du client via le player_id du tour.
--
-- Colonne lue de façon tolérante côté application (défaut : désactivée).
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

alter table wheel_configs
  add column if not exists one_prize_per_day boolean not null default false;
