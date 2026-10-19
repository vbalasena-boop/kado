-- Ferme l'ancienne fonction SECURITY DEFINER comme RPC public.
-- Elle n'est plus utilisée : les politiques lisent directement owner_user_id.
revoke execute on function public.owns_business(uuid) from public, anon, authenticated;
grant execute on function public.owns_business(uuid) to service_role;

-- Évalue auth.uid() une fois par requête plutôt qu'une fois par ligne.
alter policy businesses_owner_select on public.businesses
  to authenticated
  using (owner_user_id = (select auth.uid()));

-- Indexes sur les clés étrangères signalées par le linter Supabase.
create index if not exists affiliate_commissions_affiliate_id_idx
  on public.affiliate_commissions (affiliate_id);
create index if not exists email_queue_business_id_idx
  on public.email_queue (business_id);
create index if not exists orders_refunded_by_idx
  on public.orders (refunded_by);
create index if not exists referral_blocks_filleul_business_id_idx
  on public.referral_blocks (filleul_business_id);

-- consent_events_business_email_idx couvre déjà ces trois colonnes.
-- Supprime l'index strictement identique pour réduire les coûts d'écriture.
drop index if exists public.consent_events_biz_email_idx;
