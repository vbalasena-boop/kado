-- À exécuter sur une base de test après les migrations ; aucune donnée persistée.
-- Ce test n'est pas exécuté par Vitest (qui double la RPC).
begin;
do $$
declare
  biz uuid := gen_random_uuid();
  challenge uuid := gen_random_uuid();
  expired uuid := gen_random_uuid();
  valid uuid := gen_random_uuid();
  result text;
begin
  insert into public.businesses(id, slug, name) values (biz, 'email-test-' || biz, 'Test e-mail');
  insert into public.play_email_challenges(id, business_id, email_hash, code_hash, expires_at)
  values (challenge, biz, 'email-hmac', 'correct-hmac', now() + interval '10 minutes'),
         (expired, biz, 'email-hmac', 'correct-hmac', now() - interval '1 second'),
         (valid, biz, 'email-hmac', 'correct-hmac', now() + interval '10 minutes');
  for i in 1..5 loop
    result := public.verify_play_email_challenge(challenge, biz, 'wrong-hmac');
    if result is not null then raise exception 'Code erroné accepté'; end if;
  end loop;
  if (select attempts from public.play_email_challenges where id = challenge) <> 5 then
    raise exception 'Les cinq essais ne sont pas comptabilisés';
  end if;
  if public.verify_play_email_challenge(challenge, biz, 'correct-hmac') is not null then
    raise exception 'Sixième essai accepté';
  end if;
  if public.verify_play_email_challenge(expired, biz, 'correct-hmac') is not null then
    raise exception 'Code expiré accepté';
  end if;
  if public.verify_play_email_challenge(valid, gen_random_uuid(), 'correct-hmac') is not null then
    raise exception 'Mauvais commerce accepté';
  end if;
  if public.verify_play_email_challenge(valid, biz, 'correct-hmac') is distinct from 'email-hmac' then
    raise exception 'Code valide refusé';
  end if;
  if public.verify_play_email_challenge(valid, biz, 'correct-hmac') is not null then
    raise exception 'Code réutilisé';
  end if;
  result := public.record_play_with_daily_prize_limit(biz, 'player1', 'instagram', 'Café', 'TEST1', false, null, null, 'email-hmac');
  if result <> 'inserted' then raise exception 'Premier tour refusé'; end if;
  result := public.record_play_with_daily_prize_limit(biz, 'player2', 'instagram', 'Café', 'TEST2', false, null, null, 'email-hmac');
  if result <> 'already_played' then raise exception 'Rejeu e-mail accepté'; end if;
  result := public.record_play_with_daily_prize_limit(biz, 'player3', 'instagram', 'Café', 'TEST3', false, null, null, 'other-hmac');
  if result <> 'inserted' then raise exception 'Autre e-mail bloqué'; end if;
  if has_table_privilege('anon', 'public.play_email_challenges', 'SELECT')
     or has_table_privilege('authenticated', 'public.play_email_challenges', 'SELECT')
     or has_function_privilege('anon', 'public.verify_play_email_challenge(uuid,uuid,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.verify_play_email_challenge(uuid,uuid,text)', 'EXECUTE') then
    raise exception 'Accès public aux challenges';
  end if;
end;
$$;
rollback;
