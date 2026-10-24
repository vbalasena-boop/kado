-- Pilote activé côté serveur par BEEPER_PILOT_SLUG. Aucun nom, e-mail ou IP brute.
create table public.beeper_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  number integer not null check (number between 1 and 99),
  status text not null default 'preparing' check (status in ('preparing','ready','collected')),
  device_key text not null,
  ip_key text not null,
  created_at timestamptz not null default now()
);
create unique index beeper_active_number on public.beeper_orders(business_id, number) where status <> 'collected';
create unique index beeper_active_device on public.beeper_orders(business_id, device_key) where status <> 'collected';
create index beeper_recent on public.beeper_orders(business_id, created_at);
alter table public.beeper_orders enable row level security;

create function public.beeper_is_owner(biz uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from businesses where id = biz and owner_user_id = auth.uid());
$$;
revoke all on function public.beeper_is_owner(uuid) from public;
grant execute on function public.beeper_is_owner(uuid) to authenticated;
revoke all on public.beeper_orders from public, anon, authenticated;
grant select, insert, update, delete on public.beeper_orders to service_role;
grant select (id, business_id, number, status, created_at), update(status) on public.beeper_orders to authenticated;
create policy beeper_owner_read on public.beeper_orders for select to authenticated
  using (public.beeper_is_owner(business_id));
create policy beeper_owner_update on public.beeper_orders for update to authenticated
  using (public.beeper_is_owner(business_id)) with check (public.beeper_is_owner(business_id));

create function public.beeper_transition() returns trigger
language plpgsql set search_path = public as $$
begin
  if not ((old.status = 'preparing' and new.status = 'ready') or
          (old.status = 'ready' and new.status = 'collected')) then
    raise exception 'invalid_beeper_transition';
  end if;
  return new;
end;
$$;
create trigger beeper_transition before update on public.beeper_orders
for each row execute function public.beeper_transition();

create function public.purge_beeper_orders() returns void
language sql security definer set search_path = public as $$
  delete from beeper_orders where created_at < now() - interval '24 hours';
$$;
revoke all on function public.purge_beeper_orders() from public;
grant execute on function public.purge_beeper_orders() to service_role;

create function public.claim_beeper(biz uuid, device text, ip text)
returns table(id uuid, number integer, status text)
language plpgsql security definer set search_path = public as $$
declare chosen integer;
begin
  -- Verrou par commerce : limite, reprise cookie et attribution dans une transaction.
  perform 1 from businesses where businesses.id = biz for update;
  if not found then raise exception 'unknown_business'; end if;
  perform purge_beeper_orders();
  return query select b.id,b.number,b.status from beeper_orders b
    where b.business_id = biz and b.device_key = device and b.status <> 'collected';
  if found then return; end if;
  if (select count(*) from beeper_orders b where b.business_id = biz and b.status <> 'collected') >= 99
    or (select count(*) from beeper_orders b where b.business_id = biz and b.device_key = device and b.created_at > now() - interval '1 hour') >= 3
    or (select count(*) from beeper_orders b where b.business_id = biz and b.ip_key = ip and b.created_at > now() - interval '1 hour') >= 3 then
    raise exception 'beeper_limit';
  end if;
  -- Séquence quotidienne UTC, rebouclant à 1, sans réutiliser un numéro actif.
  select n into chosen from generate_series(1,99) n
    where not exists(select 1 from beeper_orders b where b.business_id = biz and b.number = n and b.status <> 'collected')
    order by case when n > coalesce((select b.number from beeper_orders b where b.business_id = biz
      and b.created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
      order by b.created_at desc, b.number desc limit 1), 0) then 0 else 1 end, n limit 1;
  return query insert into beeper_orders(business_id,number,device_key,ip_key)
    values(biz,chosen,device,ip) returning beeper_orders.id,beeper_orders.number,beeper_orders.status;
end;
$$;
revoke all on function public.claim_beeper(uuid,text,text) from public;
grant execute on function public.claim_beeper(uuid,text,text) to service_role;
