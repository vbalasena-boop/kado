-- Identité anti-rejeu sans conservation de l'adresse e-mail.
alter table public.plays add column email_hash text;
create unique index plays_business_email_type_unique
  on public.plays (business_id, email_hash, play_type) where email_hash is not null;

create table public.play_email_challenges (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  email_hash text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  verified_at timestamptz
);
alter table public.play_email_challenges enable row level security;
revoke all on public.play_email_challenges from public, anon, authenticated;
grant all on public.play_email_challenges to service_role;

create function public.verify_play_email_challenge(p_id uuid, p_business_id uuid, p_code_hash text)
returns text language plpgsql security invoker set search_path = public as $$
declare challenge public.play_email_challenges%rowtype;
begin
  select * into challenge from public.play_email_challenges
    where id = p_id and business_id = p_business_id for update;
  if not found or challenge.expires_at <= now() or challenge.attempts >= 5
     or challenge.verified_at is not null then
    return null;
  end if;
  update public.play_email_challenges set attempts = attempts + 1 where id = p_id;
  if challenge.code_hash <> p_code_hash then return null; end if;
  update public.play_email_challenges set verified_at = now() where id = p_id;
  return challenge.email_hash;
end;
$$;
revoke all on function public.verify_play_email_challenge(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.verify_play_email_challenge(uuid, uuid, text) to service_role;

-- Supprime l'ancienne signature pour éviter une surcharge PostgREST ambiguë.
drop function public.record_play_with_daily_prize_limit(uuid, text, text, text, text, boolean, text, integer);
create or replace function public.record_play_with_daily_prize_limit(
  p_business_id uuid,
  p_player_id text,
  p_play_type text,
  p_prize_label text,
  p_prize_code text,
  p_is_losing boolean,
  p_device_hash text,
  p_daily_limit integer,
  p_email_hash text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if not coalesce(p_is_losing, false)
       and p_daily_limit is not null
       and p_daily_limit > 0
       and not public.claim_daily_prize(p_business_id, p_daily_limit) then
      return 'daily_prize_limit_reached';
    end if;

    insert into public.plays (
      business_id, player_id, play_type, prize_label, prize_code, is_losing, device_hash, email_hash
    ) values (
      p_business_id, p_player_id, p_play_type, p_prize_label, p_prize_code,
      coalesce(p_is_losing, false), p_device_hash, p_email_hash
    );
    return 'inserted';
  exception when unique_violation then
    return 'already_played';
  end;
end;
$$;
revoke all on function public.record_play_with_daily_prize_limit(uuid, text, text, text, text, boolean, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.record_play_with_daily_prize_limit(uuid, text, text, text, text, boolean, text, integer, text)
  to service_role;
