-- Trace l'acteur et le motif normalisé des remboursements déclenchés dans Kado.
alter table orders
  add column if not exists refunded_by uuid references auth.users(id) on delete set null,
  add column if not exists refund_reason text;
