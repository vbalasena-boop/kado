-- Kado 0088 — corrections issues de l'audit sécurité / RGPD.
-- À appliquer dans Supabase AVANT de déployer les routes qui appellent ces RPC.
-- Rejouable sans effet.

-- Réservation de file avec bail : deux crons ne prennent pas le même message.
update public.leads
   set email = lower(email)
 where email is not null and email <> lower(email);
alter table public.leads
  add column if not exists marketing_consented_at timestamptz,
  add column if not exists consent_source text;

alter table public.email_queue
  add column if not exists locked_until timestamptz,
  add column if not exists lock_token uuid;
comment on column public.email_queue.status is
  'pending | processing (avec bail) | sent | failed';

create index if not exists leads_created_at_idx on public.leads (created_at);
create index if not exists loyalty_cards_retention_idx on public.loyalty_cards (last_stamp_at, created_at);
create index if not exists orders_retention_idx on public.orders (created_at);
create index if not exists consent_events_card_retention_idx on public.consent_events (card_id, created_at);

-- Registre financier mensuel sans identifiants de client ni détail de commande.
create table if not exists public.order_monthly_archive (
  business_id uuid not null references public.businesses(id) on delete cascade,
  month date not null,
  order_count bigint not null default 0,
  completed_count bigint not null default 0,
  gross_cents bigint not null default 0,
  paid_cents bigint not null default 0,
  refunded_cents bigint not null default 0,
  primary key (business_id, month)
);
alter table public.order_monthly_archive enable row level security;

-- Trace financière minimale à accès restreint, sans coordonnées, détail de
-- panier ni référence de paiement ; durée maximale de dix ans.
create table if not exists public.order_financial_archive (
  source_order_id uuid primary key,
  business_id uuid not null,
  ordered_at timestamptz not null,
  status text not null,
  total_cents bigint not null,
  paid boolean not null default false,
  refunded boolean not null default false,
  archived_at timestamptz not null default now()
);
alter table public.order_financial_archive enable row level security;
create index if not exists order_financial_archive_retention_idx
  on public.order_financial_archive (ordered_at);

create table if not exists public.play_monthly_archive (
  business_id uuid not null references public.businesses(id) on delete cascade,
  month date not null,
  plays_total bigint not null default 0,
  insta bigint not null default 0,
  review bigint not null default 0,
  won bigint not null default 0,
  redeemed bigint not null default 0,
  primary key (business_id, month)
);
alter table public.play_monthly_archive enable row level security;
alter table public.business_play_totals alter column plays type bigint using plays::bigint;

create or replace function public.get_order_dashboard_totals(
  p_business_id uuid,
  p_today_start timestamptz,
  p_month_start timestamptz
)
returns table(
  total_orders bigint,
  total_cents bigint,
  today_orders bigint,
  today_cents bigint,
  month_orders bigint,
  month_cents bigint
)
language sql
security definer
set search_path = public
as $$
  with archived as (
    select coalesce(sum(order_count), 0)::bigint as orders,
           coalesce(sum(gross_cents), 0)::bigint as cents
      from public.order_monthly_archive
     where business_id = p_business_id
  ), current_orders as (
    select count(*)::bigint as orders,
           coalesce(sum(total_cents), 0)::bigint as cents,
           count(*) filter (where created_at >= p_today_start)::bigint as today_orders,
           coalesce(sum(total_cents) filter (where created_at >= p_today_start), 0)::bigint as today_cents,
           count(*) filter (where created_at >= p_month_start)::bigint as month_orders,
           coalesce(sum(total_cents) filter (where created_at >= p_month_start), 0)::bigint as month_cents
      from public.orders
     where business_id = p_business_id
       and status not in ('cancelled', 'awaiting_payment')
  )
  select archived.orders + current_orders.orders,
         archived.cents + current_orders.cents,
         current_orders.today_orders, current_orders.today_cents,
         current_orders.month_orders, current_orders.month_cents
    from archived cross join current_orders;
$$;
revoke all on function public.get_order_dashboard_totals(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_order_dashboard_totals(uuid, timestamptz, timestamptz)
  to service_role;

create or replace function public.get_order_top_products(
  p_business_id uuid,
  p_since timestamptz,
  p_limit integer default 5
)
returns table(name text, qty bigint, cents bigint)
language sql
security definer
set search_path = public
as $$
  select line.value ->> 'name' as name,
         sum(case when (line.value ->> 'qty') ~ '^[0-9]+$'
                  then (line.value ->> 'qty')::bigint else 0 end)::bigint as qty,
         sum((case when (line.value ->> 'qty') ~ '^[0-9]+$'
                   then (line.value ->> 'qty')::bigint else 0 end) *
             (case when (line.value ->> 'price_cents') ~ '^[0-9]+$'
                   then (line.value ->> 'price_cents')::bigint else 0 end))::bigint as cents
    from public.orders o
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end
    ) as line(value)
   where o.business_id = p_business_id
     and o.created_at >= p_since
     and o.status not in ('cancelled', 'awaiting_payment')
     and nullif(btrim(line.value ->> 'name'), '') is not null
   group by line.value ->> 'name'
   order by qty desc, cents desc, name asc
   limit greatest(1, least(coalesce(p_limit, 5), 20));
$$;
revoke all on function public.get_order_top_products(uuid, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.get_order_top_products(uuid, timestamptz, integer)
  to service_role;

create or replace function public.claim_email_queue(batch_size integer default 800)
returns setof public.email_queue
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select id
    from public.email_queue
    where status = 'pending'
       or (status = 'processing' and (locked_until is null or locked_until < now()))
    order by created_at asc
    limit greatest(1, least(coalesce(batch_size, 800), 1000))
    for update skip locked
  ), claimed as (
    update public.email_queue q
       set status = 'processing',
           locked_until = now() + interval '10 minutes',
           lock_token = gen_random_uuid()
      from candidates c
     where q.id = c.id
    returning q.*
  )
  select * from claimed order by created_at asc;
$$;
revoke all on function public.claim_email_queue(integer) from public, anon, authenticated;
grant execute on function public.claim_email_queue(integer) to service_role;

create or replace function public.has_active_marketing_consent(
  p_business_id uuid,
  p_email text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.loyalty_cards c
     where c.business_id = p_business_id
       and lower(c.email) = lower(p_email)
       and c.marketing_ok = true
       and c.unsubscribed_at is null
  ) or exists (
    select 1 from public.leads l
     where l.business_id = p_business_id
       and lower(l.email) = lower(p_email)
       and l.marketing_consented_at is not null
       and l.unsubscribed_at is null
  );
$$;
revoke all on function public.has_active_marketing_consent(uuid, text)
  from public, anon, authenticated;
grant execute on function public.has_active_marketing_consent(uuid, text)
  to service_role;

-- Garde atomique : compteur journalier + insertion du tour dans une transaction.
-- Une violation de l'unicité annule aussi la réservation du compteur.
create or replace function public.record_play_with_daily_prize_limit(
  p_business_id uuid,
  p_player_id text,
  p_play_type text,
  p_prize_label text,
  p_prize_code text,
  p_is_losing boolean,
  p_device_hash text,
  p_daily_limit integer
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
      business_id, player_id, play_type, prize_label, prize_code, is_losing, device_hash
    ) values (
      p_business_id, p_player_id, p_play_type, p_prize_label, p_prize_code,
      coalesce(p_is_losing, false), p_device_hash
    );
    return 'inserted';
  exception when unique_violation then
    return 'already_played';
  end;
end;
$$;
revoke all on function public.record_play_with_daily_prize_limit(uuid, text, text, text, text, boolean, text, integer)
  from public, anon, authenticated;
grant execute on function public.record_play_with_daily_prize_limit(uuid, text, text, text, text, boolean, text, integer)
  to service_role;
-- La RPC historique est désormais appelée uniquement depuis la fonction
-- transactionnelle ci-dessus. Un appel public pouvait épuiser les compteurs.
revoke all on function public.claim_daily_prize(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_daily_prize(uuid, integer) to service_role;

-- Applique les durées publiées sur les données clients. Les commandes
-- identifiantes sont remplacées par un résumé mensuel sans coordonnées ni
-- références client/paiement après 13 mois.
create or replace function public.purge_expired_customer_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_plays integer := 0;
  deleted_leads integer := 0;
  deleted_cards integer := 0;
  deleted_fingerprint_consents integer := 0;
  archived_orders integer := 0;
  archived_financial_orders integer := 0;
  deleted_financial_orders integer := 0;
  deleted_emails integer := 0;
  archived_plays integer := 0;
begin
  with victims as materialized (
    select id, business_id, created_at, play_type, prize_label, is_losing, redeemed_at
      from public.plays
     where created_at < now() - interval '13 months'
     order by created_at asc
     limit 5000
     for update skip locked
  ), archived as (
    insert into public.play_monthly_archive (
      business_id, month, plays_total, insta, review, won, redeemed
    )
    select business_id, date_trunc('month', created_at)::date,
           count(*),
           count(*) filter (where play_type = 'instagram'),
           count(*) filter (where play_type = 'review'),
           count(*) filter (
             where not coalesce(is_losing, prize_label ilike '%rien%', false)
           ),
           count(*) filter (where redeemed_at is not null)
      from victims
     group by business_id, date_trunc('month', created_at)::date
    on conflict (business_id, month) do update
      set plays_total = play_monthly_archive.plays_total + excluded.plays_total,
          insta = play_monthly_archive.insta + excluded.insta,
          review = play_monthly_archive.review + excluded.review,
          won = play_monthly_archive.won + excluded.won,
          redeemed = play_monthly_archive.redeemed + excluded.redeemed
    returning 1
  ), gone as (
    delete from public.plays p using victims v where p.id = v.id returning 1
  ) select count(*) into archived_plays from gone;
  deleted_plays := archived_plays;

  with victims as (
    select id from public.leads
     where coalesce(unsubscribed_at, created_at) < now() - interval '3 years'
     limit 5000
  ), gone as (
    delete from public.leads l using victims v where l.id = v.id returning 1
  ) select count(*) into deleted_leads from gone;

  with victims as (
    select id from public.loyalty_cards
     where greatest(created_at, coalesce(last_stamp_at, created_at), coalesce(unsubscribed_at, created_at))
           < now() - interval '3 years'
       and not exists (
         select 1 from public.consent_events e
          where e.card_id = loyalty_cards.id
            and e.created_at >= now() - interval '3 years'
       )
     limit 5000
  )
  delete from public.consent_events e using victims v where e.card_id = v.id;

  with victims as (
    select id from public.loyalty_cards
     where greatest(created_at, coalesce(last_stamp_at, created_at), coalesce(unsubscribed_at, created_at))
           < now() - interval '3 years'
       and not exists (
         select 1 from public.consent_events e
          where e.card_id = loyalty_cards.id
            and e.created_at >= now() - interval '3 years'
       )
     limit 5000
  ), gone as (
    delete from public.loyalty_cards c using victims v where c.id = v.id returning 1
  ) select count(*) into deleted_cards from gone;

  with victims as (
    select c.business_id, c.player_id
      from public.player_fingerprint_consents c
     where c.updated_at < now() - interval '13 months'
       and not exists (
         select 1 from public.plays p
          where p.business_id = c.business_id and p.player_id = c.player_id
       )
     limit 5000
  ), gone as (
    delete from public.player_fingerprint_consents c using victims v
     where c.business_id = v.business_id and c.player_id = v.player_id
     returning 1
  ) select count(*) into deleted_fingerprint_consents from gone;

  with victims as materialized (
    select id, business_id, created_at, status, paid, refunded, total_cents
      from public.orders
     where created_at < now() - interval '13 months'
     order by created_at asc
     limit 2000
     for update skip locked
  ), archived as (
    insert into public.order_monthly_archive (
      business_id, month, order_count, completed_count, gross_cents, paid_cents, refunded_cents
    )
    select business_id, date_trunc('month', created_at)::date,
           count(*) filter (where status not in ('cancelled', 'awaiting_payment')),
           count(*) filter (where status = 'done'),
           coalesce(sum(total_cents) filter (where status not in ('cancelled', 'awaiting_payment')), 0),
           coalesce(sum(total_cents) filter (
             where status not in ('cancelled', 'awaiting_payment')
               and (paid or status = 'done') and not refunded
           ), 0),
           coalesce(sum(total_cents) filter (where refunded), 0)
      from victims
     group by business_id, date_trunc('month', created_at)::date
    on conflict (business_id, month) do update
      set order_count = order_monthly_archive.order_count + excluded.order_count,
          completed_count = order_monthly_archive.completed_count + excluded.completed_count,
          gross_cents = order_monthly_archive.gross_cents + excluded.gross_cents,
          paid_cents = order_monthly_archive.paid_cents + excluded.paid_cents,
          refunded_cents = order_monthly_archive.refunded_cents + excluded.refunded_cents
    returning 1
  ), financial as (
    insert into public.order_financial_archive (
      source_order_id, business_id, ordered_at, status, total_cents, paid, refunded
    )
    select id, business_id, created_at, status, total_cents,
           coalesce(paid, false), coalesce(refunded, false)
      from victims
    on conflict (source_order_id) do nothing
    returning 1
  ), gone as (
    delete from public.orders o using victims v where o.id = v.id returning 1
  ) select (select count(*) from gone), (select count(*) from financial)
      into archived_orders, archived_financial_orders;

  with victims as (
    select source_order_id from public.order_financial_archive
     where ordered_at < now() - interval '10 years'
     order by ordered_at asc
     limit 5000
     for update skip locked
  ), gone as (
    delete from public.order_financial_archive a using victims v
     where a.source_order_id = v.source_order_id
    returning 1
  ) select count(*) into deleted_financial_orders from gone;

  with victims as (
    select id from public.email_queue where created_at < now() - interval '90 days' limit 5000
  ), gone as (
    delete from public.email_queue q using victims v where q.id = v.id returning 1
  ) select count(*) into deleted_emails from gone;

  return jsonb_build_object(
    'plays_deleted', deleted_plays,
    'plays_archived', archived_plays,
    'leads_deleted', deleted_leads,
    'loyalty_cards_deleted', deleted_cards,
    'fingerprint_consents_deleted', deleted_fingerprint_consents,
    'orders_archived', archived_orders,
    'order_financial_records_archived', archived_financial_orders,
    'order_financial_records_deleted', deleted_financial_orders,
    'email_queue_deleted', deleted_emails
  );
end;
$$;
revoke all on function public.purge_expired_customer_data() from public, anon, authenticated;
grant execute on function public.purge_expired_customer_data() to service_role;

-- Maintient les métriques historiques après purge des parties identifiantes.
create or replace function public.refresh_admin_stats()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with totals as (
    select count(*)::bigint as plays_total,
           count(*) filter (where play_type = 'instagram')::bigint as insta,
           count(*) filter (where play_type = 'review')::bigint as review,
           count(*) filter (where not coalesce(is_losing, prize_label ilike '%rien%', false))::bigint as won,
           count(*) filter (where redeemed_at is not null)::bigint as redeemed
      from public.plays
    union all
    select coalesce(sum(plays_total), 0), coalesce(sum(insta), 0),
           coalesce(sum(review), 0), coalesce(sum(won), 0), coalesce(sum(redeemed), 0)
      from public.play_monthly_archive
  )
  insert into public.admin_stats_cache (id, plays_total, insta, review, won, redeemed, refreshed_at)
  select 1, sum(plays_total), sum(insta), sum(review), sum(won), sum(redeemed), now()
    from totals
  on conflict (id) do update set
    plays_total = excluded.plays_total,
    insta = excluded.insta,
    review = excluded.review,
    won = excluded.won,
    redeemed = excluded.redeemed,
    refreshed_at = excluded.refreshed_at;

  delete from public.business_play_totals;
  insert into public.business_play_totals (business_id, plays)
  select business_id, sum(plays)::bigint
    from (
      select business_id, count(*)::bigint as plays
        from public.plays group by business_id
      union all
      select business_id, sum(plays_total)
        from public.play_monthly_archive group by business_id
    ) all_plays
   group by business_id;
end;
$$;
revoke all on function public.refresh_admin_stats() from public, anon, authenticated;
grant execute on function public.refresh_admin_stats() to service_role;

-- Après trois ans, conserve uniquement la preuve d'un opt-in encore actif.
create or replace function public.purge_old_consent_events(retention_days integer default 1095)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted integer;
begin
  with victims as (
    select e.id
      from public.consent_events e
     where e.created_at < now() - make_interval(days => greatest(1, retention_days))
       and not exists (
         select 1
           from public.loyalty_cards c
          where c.business_id = e.business_id
            and lower(c.email) = lower(e.email)
            and c.marketing_ok = true
            and c.unsubscribed_at is null
            and e.id = (
              select e2.id from public.consent_events e2
               where e2.business_id = e.business_id and lower(e2.email) = lower(e.email)
               order by e2.created_at desc, e2.id desc limit 1
            )
       )
     order by e.created_at asc
     limit 5000
     for update skip locked
  ), gone as (
    delete from public.consent_events e using victims v
     where e.id = v.id
    returning 1
  ) select count(*) into deleted from gone;
  return deleted;
end;
$$;
revoke all on function public.purge_old_consent_events(integer) from public, anon, authenticated;
grant execute on function public.purge_old_consent_events(integer) to service_role;
