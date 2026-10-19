-- Fix the mutable search_path warnings on SECURITY INVOKER functions.
-- Keep public before pg_temp so temporary objects cannot shadow application objects.
ALTER FUNCTION public.admin_business_play_counts() SET search_path = public, pg_temp;
ALTER FUNCTION public.admin_play_stats(timestamptz, timestamptz) SET search_path = public, pg_temp;
ALTER FUNCTION public.claim_daily_prize(uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.consent_events_block_update() SET search_path = public, pg_temp;
ALTER FUNCTION public.dashboard_loyalty_segments(uuid, timestamptz) SET search_path = public, pg_temp;
ALTER FUNCTION public.dashboard_loyalty_signups_trend(uuid, timestamptz) SET search_path = public, pg_temp;
ALTER FUNCTION public.dashboard_loyalty_stats(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.dashboard_play_stats(uuid, timestamptz) SET search_path = public, pg_temp;
ALTER FUNCTION public.dashboard_play_trend(uuid, timestamptz) SET search_path = public, pg_temp;
ALTER FUNCTION public.next_buzzer_no(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.rate_limit_hit(text, integer, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.recap_weekly_stats(timestamptz, timestamptz) SET search_path = public, pg_temp;
ALTER FUNCTION public.set_business_ref() SET search_path = public, pg_temp;
