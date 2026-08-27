-- Kado 0069 — File d'attente d'e-mails (scalabilité).
--
-- Avant : le cron quotidien envoyait tous les e-mails de masse (relances,
-- invitations avis, conversion, anniversaires) DANS sa fenêtre de 60 s → au-delà
-- d'un certain volume, la fonction était tuée et la fin de liste n'était jamais
-- envoyée. On découple : le cron ENFILE, un drain (même run + cron fréquent)
-- envoie au rythme autorisé par Resend, avec réessais.
--
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

create table if not exists email_queue (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  to_addr text not null,
  subject text not null,
  html text not null,
  from_name text,
  marketing boolean not null default false,
  status text not null default 'pending', -- pending | sent | failed
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- Les en-attente, du plus ancien au plus récent (FIFO). Index partiel léger.
create index if not exists email_queue_pending_idx
  on email_queue (created_at)
  where status = 'pending';
