
- source_spec: `_bmad-output/implementation-artifacts/spec-9-1-configurer-actions-declenchantes-non-avis.md`
  summary: Les blocs `update` « tolérants » de `app/api/dashboard/wheel/route.ts` (play_alerts, monthly_draw, draw, trigger_actions) avalent les erreurs Supabase renvoyées via `{ error }` (le client ne « throw » pas), donc le `try/catch` ne les capte pas — un échec réel (RLS, contrainte, connectivité) est silencieusement ignoré et la route renvoie quand même `{ ok: true }`.
  evidence: Pattern pré-existant (antérieur à la story 9.1, qui l'a seulement suivi pour trigger_actions). Réel : le client supabase-js résout la promesse avec `{ error }` au lieu de lever ; corriger en inspectant `error` et en n'ignorant que le code « colonne absente » (42703). À traiter globalement sur tous les blocs tolérants.

- source_spec: `_bmad-output/implementation-artifacts/spec-9-2-debloquer-les-tours-par-des-actions-non-avis.md`
  summary: Réconcilier l'éditeur commerçant (`app/dashboard/wheel/WheelEditor.tsx`) avec le modèle `trigger_actions` — le toggle legacy « Avis Google : un avis contre un tour » est désormais mensonger (l'avis ne débloque plus rien), le champ `instagram_url` peut devenir non éditable si le toggle legacy `instagram_enabled` est off alors qu'`instagram` est coché dans `trigger_actions`, et les avertissements « noChannel / 1 tour avis uniquement » ne reflètent plus le vrai nombre de tours.
  evidence: Constats revue 9.2 (Blind Hunter). Hors périmètre de 9.2 (Never : « ne pas toucher à l'éditeur 9.1 » ; présentation neutre de l'avis = story 9.3). À traiter en 9.3 (avis en CTA neutre) et/ou une story de nettoyage des toggles legacy.

- source_spec: `_bmad-output/implementation-artifacts/spec-9-2-debloquer-les-tours-par-des-actions-non-avis.md`
  summary: Le comptage du plafond quotidien (`daily_prize_limit`) dans `app/api/play/route.ts` compte encore les tours GAGNANTS historiques de type `review` du jour ; aucun nettoyage des lignes `plays` de type `review` orphelines n'est prévu.
  evidence: Constat revue 9.2 (Blind Hunter #15). Pré-existant et sans impact futur (plus aucun tour `review` n'est créé), mais à confirmer/traiter éventuellement lors de la migration des configs existantes (story 9.4).
