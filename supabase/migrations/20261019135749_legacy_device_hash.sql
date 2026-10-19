-- Verrou anti-rejeu secondaire : empreinte d'appareil.
--
-- Complète le verrou par cookie (player_id) pour attraper le cas
-- "même appareil en navigation privée / cookies vidés / autre navigateur",
-- où un nouveau player_id est créé et permettait de rejouer.
--
-- La vérification reste SOUPLE côté applicatif (pas de contrainte unique
-- dure) : deux appareils strictement identiques peuvent partager une même
-- empreinte, et on ne veut jamais faire échouer un tour légitime à cause de
-- ça. Le vrai garde-fou anti-fraude reste le code cadeau à usage unique
-- (redeemed_at) + le plafond quotidien de cadeaux.
alter table plays add column if not exists device_hash text;

create index if not exists plays_device_idx
  on plays (business_id, device_hash, play_type);
