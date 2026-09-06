-- Kado 0081 — Produit « épuisé aujourd'hui » (Click & Collect).
--
-- Rupture TEMPORAIRE : le commerçant marque un produit indisponible sans le
-- supprimer ni le masquer (`active`). Le produit reste affiché sur la page
-- commande, mais non commandable ; le commerçant le repasse dispo d'un clic.
--
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

alter table products
  add column if not exists sold_out boolean not null default false;
