-- One-time game passes handed out by the merchant at the point of sale.
-- Existing businesses keep the current flow until they enable the option.
alter table public.wheel_configs
  add column if not exists play_pass_required boolean not null default false;

create table if not exists public.play_passes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  redeemed_at timestamptz,
  redeemed_by text
);

create index if not exists play_passes_available_idx
  on public.play_passes (business_id, expires_at)
  where redeemed_at is null;

alter table public.play_passes enable row level security;

-- Consume the bearer code and record the play in one transaction. A failed
-- insert rolls back the redemption, so a transient server/database error does
-- not destroy a customer's pass.
create or replace function public.play_with_pass(
  p_business_id uuid,
  p_code_hash text,
  p_player_id text,
  p_play_type text,
  p_prize_label text,
  p_prize_code text,
  p_is_losing boolean,
  p_device_hash text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pass_id uuid;
begin
  update public.play_passes
     set redeemed_at = now(), redeemed_by = p_player_id
   where business_id = p_business_id
     and code_hash = p_code_hash
     and redeemed_at is null
     and expires_at > now()
  returning id into v_pass_id;

  if v_pass_id is null then
    return false;
  end if;

  insert into public.plays (
    business_id, player_id, play_type, prize_label, prize_code,
    is_losing, device_hash
  ) values (
    p_business_id, p_player_id, p_play_type, p_prize_label, p_prize_code,
    p_is_losing, p_device_hash
  );

  return true;
end;
$$;

revoke all on function public.play_with_pass(uuid, text, text, text, text, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.play_with_pass(uuid, text, text, text, text, text, boolean, text)
  to service_role;
