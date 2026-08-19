-- Espace promoteur avec connexion : un vendeur peut se rattacher à un compte
-- utilisateur (même connexion par code que les commerçants) et s'inscrire
-- lui-même depuis la page « Devenir promoteur ». Un seul profil par compte.
alter table affiliates
  add column if not exists owner_user_id uuid;
create unique index if not exists affiliates_owner
  on affiliates (owner_user_id) where owner_user_id is not null;
