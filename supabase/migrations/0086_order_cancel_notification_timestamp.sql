-- Trace la notification envoyée après l'annulation d'une commande.
alter table orders
  add column if not exists notified_cancelled_at timestamptz;
