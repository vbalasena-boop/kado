-- Ajoute la notion de formule (plan) à chaque établissement
-- et un tampon emoji personnalisable sur les cartes de fidélité.

alter table businesses
  add column if not exists plan text not null default 'roue';
-- valeurs possibles : 'roue', 'fidelite', 'complet'

-- Tampon emoji (affiché sur la grille de la carte client)
alter table wheel_configs
  add column if not exists loyalty_stamp_emoji text not null default '⭐';
