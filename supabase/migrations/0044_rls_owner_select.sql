-- Kado — Policies RLS de lecture (SELECT) par propriétaire (défense en profondeur)
-- ========================================================================
-- CONTEXTE. Jusqu'ici, les 15 tables avaient la RLS activée SANS policy →
-- « default-deny » total : seul le rôle `service_role` (serveur, qui contourne
-- la RLS) accédait aux données. Cette migration ajoute des policies **SELECT
-- uniquement**, scopées au **propriétaire connecté** (`auth.uid()`), pour le rôle
-- `authenticated`.
--
-- ⚠️ CE QUE ÇA CHANGE. Cela OUVRE une nouvelle surface : un commerçant
-- authentifié peut désormais lire SES PROPRES lignes via l'API REST PostgREST
-- (clé anon + son JWT). Le rôle `anon` (sans JWT) ne lit toujours RIEN. Les
-- écritures restent interdites (aucune policy INSERT/UPDATE/DELETE) : elles
-- passent toujours par le serveur en `service_role`. L'application actuelle
-- n'est donc pas affectée — ces policies sont un filet de sécurité et préparent
-- une éventuelle migration des lectures vers le client `ssr`.
--
-- GARDE-FOUS.
--  • SELECT seulement, rôle `authenticated` seulement (jamais `anon`/`public`).
--  • Scoping via `owns_business()` (SECURITY DEFINER, search_path figé) : la
--    vérification de propriété est faite une seule fois, sans récursion RLS.
--  • Tables SENSIBLES laissées en default-deny (AUCUNE policy, donc illisibles
--    même par un authentifié) : `affiliates`, `affiliate_commissions`
--    (PII vendeurs + stats_key secret), `rate_limits`, `system_state` (interne).
-- ========================================================================

-- Vérifie que le business appartient à l'utilisateur courant. SECURITY DEFINER :
-- lit `businesses` sans être soumis à sa propre RLS (pas de récursion), et ne
-- renvoie qu'un booléen (aucune donnée exposée).
create or replace function public.owns_business(bid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from businesses
    where id = bid and owner_user_id = auth.uid()
  );
$$;

revoke all on function public.owns_business(uuid) from public;
grant execute on function public.owns_business(uuid) to authenticated;

-- ── Table tenant racine ─────────────────────────────────────────────────
drop policy if exists businesses_owner_select on businesses;
create policy businesses_owner_select on businesses
  for select to authenticated
  using (owner_user_id = auth.uid());

-- ── Tables enfant (scopées par business_id) ─────────────────────────────
drop policy if exists wheel_configs_owner_select on wheel_configs;
create policy wheel_configs_owner_select on wheel_configs
  for select to authenticated using (owns_business(business_id));

drop policy if exists prizes_owner_select on prizes;
create policy prizes_owner_select on prizes
  for select to authenticated using (owns_business(business_id));

drop policy if exists plays_owner_select on plays;
create policy plays_owner_select on plays
  for select to authenticated using (owns_business(business_id));

drop policy if exists loyalty_cards_owner_select on loyalty_cards;
create policy loyalty_cards_owner_select on loyalty_cards
  for select to authenticated using (owns_business(business_id));

drop policy if exists leads_owner_select on leads;
create policy leads_owner_select on leads
  for select to authenticated using (owns_business(business_id));

drop policy if exists campaigns_owner_select on campaigns;
create policy campaigns_owner_select on campaigns
  for select to authenticated using (owns_business(business_id));

drop policy if exists products_owner_select on products;
create policy products_owner_select on products
  for select to authenticated using (owns_business(business_id));

drop policy if exists orders_owner_select on orders;
create policy orders_owner_select on orders
  for select to authenticated using (owns_business(business_id));

drop policy if exists push_subscriptions_owner_select on push_subscriptions;
create policy push_subscriptions_owner_select on push_subscriptions
  for select to authenticated using (owns_business(business_id));

drop policy if exists client_push_subscriptions_owner_select on client_push_subscriptions;
create policy client_push_subscriptions_owner_select on client_push_subscriptions
  for select to authenticated using (owns_business(business_id));

-- ── Tables SENSIBLES : volontairement AUCUNE policy (default-deny) ───────
-- affiliates, affiliate_commissions, rate_limits, system_state restent
-- illisibles hors service_role. Ne pas ajouter de policy ici sans analyse.
