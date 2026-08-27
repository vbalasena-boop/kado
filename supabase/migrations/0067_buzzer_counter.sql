-- Kado 0067 — Numéro de bipeur ATOMIQUE (remis à zéro chaque jour).
--
-- Avant : le prochain numéro était `max(buzzer_no du jour) + 1` en
-- lecture-puis-écriture → deux clients simultanés obtenaient le MÊME numéro.
-- On sérialise via un compteur (business_id, jour) incrémenté atomiquement,
-- sur le modèle de `claim_daily_prize` (0054).
--
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

create table if not exists buzzer_counters (
  business_id uuid not null references businesses(id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (business_id, day)
);

-- Réserve et renvoie le prochain numéro du jour pour ce commerce (1, 2, 3, …).
-- Deux appels concurrents ne peuvent jamais renvoyer le même numéro.
create or replace function next_buzzer_no(biz uuid)
returns int
language plpgsql
as $$
declare
  n int;
begin
  insert into buzzer_counters (business_id, day, count)
    values (biz, current_date, 1)
  on conflict (business_id, day) do update
    set count = buzzer_counters.count + 1
  returning count into n;
  return n;
end;
$$;
