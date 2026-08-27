-- Kado 0064 — Index de scalabilité (revue de structure).
--
-- Ajoute les index qui manquaient sur les chemins qui deviennent coûteux quand
-- le nombre de cartes de fidélité grandit. Gain immédiat, aucun changement de
-- comportement. Rejouable (`if not exists`).
--
-- NOTE : sur une base DÉJÀ volumineuse, préférer `create index concurrently`
-- (à lancer hors transaction) pour éviter un verrou d'écriture le temps de la
-- construction. À l'échelle actuelle, un `create index` simple est instantané.
--
-- À exécuter dans Supabase > SQL Editor.

-- 1) Anniversaires : le cron balaie chaque jour loyalty_cards par
--    (birthday_month, birthday_day) SANS business_id → sans index = scan complet
--    quotidien de toute la table. (app/api/cron/daily/route.ts, bloc 2)
create index if not exists loyalty_cards_birthday_idx
  on loyalty_cards (birthday_month, birthday_day);

-- 2) Compteurs de parrainage : 2 counts par ouverture de carte filtrent
--    referred_by_card dans un commerce. (app/api/loyalty/card/route.ts)
create index if not exists loyalty_cards_referred_by_idx
  on loyalty_cards (business_id, referred_by_card);

-- 3) Récap hebdo : count des cadeaux « échangés » filtre redeemed_at.
--    Index partiel (les lignes non échangées sont majoritaires et inutiles ici).
create index if not exists plays_business_redeemed_idx
  on plays (business_id, redeemed_at)
  where redeemed_at is not null;

-- 4) Relances fidélité (inactifs / « plus qu'un tampon ») : filtrent par
--    business_id + marketing_ok + last_stamp_at. (cron, blocs 2b/2c)
create index if not exists loyalty_cards_reengage_idx
  on loyalty_cards (business_id, marketing_ok, last_stamp_at);
