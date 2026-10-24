-- Base de TEST uniquement, migrations appliquées. psql -v ON_ERROR_STOP=1 -f ...
begin;
insert into public.businesses(id,slug,name,owner_user_id) values
 ('b0000000-0000-4000-8000-000000000001','beeper-sql-test','Beeper test','a0000000-0000-4000-8000-000000000001'),
 ('b0000000-0000-4000-8000-000000000002','beeper-sql-other','Other','a0000000-0000-4000-8000-000000000002');
do $$
declare first_order record; repeated record; second_order record; n integer;
begin
 select * into first_order from public.claim_beeper('b0000000-0000-4000-8000-000000000001','device1','ip1');
 if first_order.number <> 1 then raise exception 'First number is not 1'; end if;
 select * into repeated from public.claim_beeper('b0000000-0000-4000-8000-000000000001','device1','ip1');
 if first_order.id <> repeated.id then raise exception 'Cookie not idempotent'; end if;
 select * into second_order from public.claim_beeper('b0000000-0000-4000-8000-000000000001','device2','ip1');
 if second_order.number <> 2 then raise exception 'Number collision'; end if;
 perform public.claim_beeper('b0000000-0000-4000-8000-000000000001','device3','ip1');
 begin
   perform public.claim_beeper('b0000000-0000-4000-8000-000000000001','device4','ip1');
   raise exception 'Fourth IP claim allowed';
 exception when raise_exception then
   if sqlerrm <> 'beeper_limit' then raise; end if;
 end;
 begin
   update public.beeper_orders set status='collected' where id=first_order.id;
   raise exception 'Skipped ready state';
 exception when raise_exception then
   if sqlerrm <> 'invalid_beeper_transition' then raise; end if;
 end;
 update public.beeper_orders set status='ready' where id=first_order.id;
 update public.beeper_orders set status='collected' where id=first_order.id;
 -- Même appareil, même après récupération et changements d'IP : trois par heure.
 for n in 1..2 loop
   select * into repeated from public.claim_beeper('b0000000-0000-4000-8000-000000000001','device1','other-ip-'||n);
   update public.beeper_orders set status='ready' where id=repeated.id;
   update public.beeper_orders set status='collected' where id=repeated.id;
 end loop;
 begin
   perform public.claim_beeper('b0000000-0000-4000-8000-000000000001','device1','new-ip');
   raise exception 'Fourth device claim allowed';
 exception when raise_exception then
   if sqlerrm <> 'beeper_limit' then raise; end if;
 end;
 -- Reprise à 1 à minuit UTC, avec un numéro de la veille toujours actif.
 delete from public.beeper_orders where business_id='b0000000-0000-4000-8000-000000000002';
 insert into public.beeper_orders(business_id,number,device_key,ip_key,created_at)
 values('b0000000-0000-4000-8000-000000000002',1,'yesterday','yesterday',date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' - interval '1 second');
 select * into repeated from public.claim_beeper('b0000000-0000-4000-8000-000000000002','today','today');
 if repeated.number <> 2 then raise exception 'Active yesterday number reused'; end if;
 delete from public.beeper_orders where business_id='b0000000-0000-4000-8000-000000000002';
 insert into public.beeper_orders(business_id,number,device_key,ip_key,created_at)
 values('b0000000-0000-4000-8000-000000000002',99,'expired','expired',now()-interval '25 hours');
 select * into repeated from public.claim_beeper('b0000000-0000-4000-8000-000000000002','today','today');
 if repeated.number <> 1 or exists(select 1 from public.beeper_orders where device_key='expired') then raise exception 'Daily reset/purge failed'; end if;
 -- Saturation commerce : 99 numéros actifs, jamais de collision ni de 100.
 insert into public.beeper_orders(business_id,number,device_key,ip_key)
 select 'b0000000-0000-4000-8000-000000000002',i,'d'||i,'i'||i from generate_series(2,99) i;
 begin
   perform public.claim_beeper('b0000000-0000-4000-8000-000000000002','overflow','overflow');
   raise exception 'Business capacity exceeded';
 exception when raise_exception then
   if sqlerrm <> 'beeper_limit' then raise; end if;
 end;
 if has_function_privilege('anon','public.claim_beeper(uuid,text,text)','execute')
 or has_function_privilege('authenticated','public.claim_beeper(uuid,text,text)','execute') then raise exception 'Public claim RPC'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
do $$
declare affected integer;
begin
 if not exists(select 1 from public.beeper_orders where business_id='b0000000-0000-4000-8000-000000000001') then raise exception 'Owner cannot read'; end if;
 if exists(select 1 from public.beeper_orders where business_id='b0000000-0000-4000-8000-000000000002') then raise exception 'Cross-tenant read'; end if;
 update public.beeper_orders set status='ready' where business_id='b0000000-0000-4000-8000-000000000002';
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'Cross-tenant update'; end if;
 update public.beeper_orders set status='ready' where business_id='b0000000-0000-4000-8000-000000000001' and status='preparing';
 get diagnostics affected = row_count;
 if affected <> 2 then raise exception 'Owner cannot mark ready'; end if;
 update public.beeper_orders set status='collected' where business_id='b0000000-0000-4000-8000-000000000001' and status='ready';
 begin
   update public.beeper_orders set number=50;
   raise exception 'Owner can alter number';
 exception when insufficient_privilege then null;
 end;
 begin
   perform device_key from public.beeper_orders;
   raise exception 'Owner can read device key';
 exception when insufficient_privilege then null;
 end;
end $$;
set local role anon;
do $$
begin
 begin
   perform number from public.beeper_orders;
   raise exception 'Anonymous read';
 exception when insufficient_privilege then null;
 end;
 begin
   update public.beeper_orders set status='ready';
   raise exception 'Anonymous write';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
