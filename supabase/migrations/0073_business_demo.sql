-- Kado 0073 — Établissement en mode « démo ».
--
-- Un établissement de démonstration (ex. « Café Lumière ») ne doit PAS être
-- compté dans les statistiques admin (nombre de commerces, MRR, parties…) : ce
-- sont des données de test. On ajoute un drapeau `demo` :
--
--   - les comptes créés depuis l'admin démarrent en démo ;
--   - l'admin les « passe en essai » (14 j) quand le commerçant démarre vraiment ;
--   - les établissements en démo sont exclus des agrégats du tableau de bord admin.
--
-- Colonne lue de façon tolérante côté application.
-- À exécuter dans Supabase > SQL Editor. Rejouable sans effet si déjà appliqué.

alter table businesses
  add column if not exists demo boolean not null default false;
