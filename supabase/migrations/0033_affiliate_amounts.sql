-- Commissions vendeurs : montants ≈ 1er mois d'abonnement arrondi
-- (Fidélité 20 €, Jeux 30 €, Complet 45 €), versées à partir du 2e
-- prélèvement du client. Remplace les défauts initiaux 40/60/90.
alter table affiliates
  alter column commission_roue_cents set default 3000,
  alter column commission_fidelite_cents set default 2000,
  alter column commission_complet_cents set default 4500;

-- Vendeurs déjà créés avec les anciens défauts : on les aligne.
update affiliates set commission_roue_cents = 3000 where commission_roue_cents = 6000;
update affiliates set commission_fidelite_cents = 2000 where commission_fidelite_cents = 4000;
update affiliates set commission_complet_cents = 4500 where commission_complet_cents = 9000;
