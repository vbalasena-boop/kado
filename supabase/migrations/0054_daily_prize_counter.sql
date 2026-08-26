-- Kado 0054 — Plafond de cadeaux/jour ATOMIQUE.
--
-- Avant : la route de jeu comptait les tours gagnants du jour puis décidait —
-- « compte-puis-écrit » non atomique → sous forte affluence, deux tours
-- concurrents pouvaient tous deux passer le test et dépasser le plafond.
--
-- On sérialise la décision via un compteur (business_id, jour) et une
-- réservation atomique (INSERT … ON CONFLICT … DO UPDATE … WHERE count < lim).
-- Un seul appel peut faire passer le compteur de N à N+1 tant que N < lim.
--
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

create table if not exists daily_prize_counters (
  business_id uuid not null references businesses(id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (business_id, day)
);

-- Réserve un « slot » de cadeau pour aujourd'hui. Renvoie true si un cadeau
-- peut être accordé (et incrémente le compteur), false si le plafond est
-- atteint. `lim <= 0` (ou null) = pas de plafond → toujours true, sans écrire.
create or replace function claim_daily_prize(biz uuid, lim int)
returns boolean
language plpgsql
as $$
declare
  ok boolean;
begin
  if lim is null or lim <= 0 then
    return true;
  end if;
  insert into daily_prize_counters (business_id, day, count)
    values (biz, current_date, 1)
  on conflict (business_id, day) do update
    set count = daily_prize_counters.count + 1
    where daily_prize_counters.count < lim
  returning true into ok;
  -- Pas de ligne renvoyée = conflit avec count >= lim (plafond atteint).
  return coalesce(ok, false);
end;
$$;
