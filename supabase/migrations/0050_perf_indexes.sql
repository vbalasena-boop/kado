-- Kado — Index de performance (audit perf). Aucun changement de schéma logique,
-- uniquement des index pour supprimer des seq-scans sur les chemins chauds.
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

-- 1) Chemin le PLUS chaud : getMyBusinesses() filtre businesses.owner_user_id
--    sur CHAQUE page/route dashboard authentifiée. Aucun index → seq scan.
create index if not exists businesses_owner_idx
  on businesses(owner_user_id);

-- Attribution vendeur : lib/affiliates + admin/vendeurs filtrent affiliate_id.
create index if not exists businesses_affiliate_idx
  on businesses(affiliate_id);

-- 2) Table campaigns : AUCUN index jusqu'ici.
--    - liste dashboard : .eq(business_id).order(created_at desc).limit(20)
create index if not exists campaigns_biz_created_idx
  on campaigns(business_id, created_at desc);
--    - cron : campagnes planifiées non envoyées / avec destinataires en attente
create index if not exists campaigns_pending_scheduled_idx
  on campaigns(scheduled_for)
  where sent_at is null;

-- 3) Cron « tirage mensuel » (inversion N+1) : sélectionner directement les
--    configs à tirer au lieu de scanner tous les commerces actifs un par un.
create index if not exists wheel_configs_draw_idx
  on wheel_configs(draw_next_at)
  where monthly_draw;

-- 4) Prospection (admin/cron) : filtres fréquents sans support.
create index if not exists prospect_messages_chan_status_step_idx
  on prospect_messages(channel, status, step);
create index if not exists prospect_events_type_created_idx
  on prospect_events(type, created_at);
