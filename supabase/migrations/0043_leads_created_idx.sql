-- Kado — Index composite sur les leads pour les requêtes du cron quotidien
-- (participants au tirage au sort et récap hebdomadaire) qui filtrent par
-- établissement ET fenêtre de date. L'index simple `leads_business_idx` (0017)
-- ne couvrait que business_id. À exécuter dans Supabase > SQL Editor.

create index if not exists leads_biz_created_idx
  on leads (business_id, created_at);
