-- Parrainage client : le bonus du parrain n'est accordé qu'au premier
-- achat du filleul (premier tampon validé en caisse).
alter table loyalty_cards
  add column if not exists referred_reward_granted_at timestamptz;
