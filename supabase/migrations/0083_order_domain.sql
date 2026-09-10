-- Kado 0083 — Commande en ligne sur le domaine du commerçant.
--
-- Deux réglages sur `businesses` :
--   • website_url  : le site vitrine du commerçant (Wix, Shopify, autre). La
--                    page de commande affiche un lien « Retour au site ».
--   • order_domain : sous-domaine « commander.<son-domaine> » qui sert la
--                    page /<slug>/commander (réécriture par le middleware).
--                    Unique : un hôte ne peut désigner qu'un seul commerce.
--
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

alter table businesses add column if not exists website_url text;
alter table businesses add column if not exists order_domain text;

create unique index if not exists businesses_order_domain_key
  on businesses (order_domain)
  where order_domain is not null;
