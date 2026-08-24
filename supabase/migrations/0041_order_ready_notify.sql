-- Kado — Click & collect : prévenir le client quand sa commande est PRÊTE.
-- Le client peut, au moment de commander, demander à être averti (push).
-- Son abonnement push est stocké sur la commande ; l'e-mail (0021) sert aussi.
-- À exécuter dans Supabase > SQL Editor.

alter table orders
  add column if not exists notify_push jsonb,
  add column if not exists notified_ready_at timestamptz;
