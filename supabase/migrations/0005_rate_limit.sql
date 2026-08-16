-- Limitation de débit (anti-abus) appuyée sur Postgres.
-- Fenêtre glissante par clé (ex. "play:<ip>"), atomique et sans dépendance externe.

create table if not exists rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count int not null default 0
);

alter table rate_limits enable row level security;

-- Incrémente le compteur pour une clé et renvoie TRUE si la requête est autorisée.
-- Réinitialise automatiquement quand la fenêtre est dépassée.
create or replace function rate_limit_hit(
  p_key text,
  p_limit int,
  p_window_seconds int
)
returns boolean
language plpgsql
as $$
declare
  v_now timestamptz := now();
  v_count int;
begin
  insert into rate_limits (key, window_start, count)
    values (p_key, v_now, 1)
  on conflict (key) do update
    set
      count = case
        when rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
          then 1
        else rate_limits.count + 1
      end,
      window_start = case
        when rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
          then v_now
        else rate_limits.window_start
      end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;
