
- source_spec: `_bmad-output/implementation-artifacts/spec-9-1-configurer-actions-declenchantes-non-avis.md`
  summary: Les blocs `update` « tolérants » de `app/api/dashboard/wheel/route.ts` (play_alerts, monthly_draw, draw, trigger_actions) avalent les erreurs Supabase renvoyées via `{ error }` (le client ne « throw » pas), donc le `try/catch` ne les capte pas — un échec réel (RLS, contrainte, connectivité) est silencieusement ignoré et la route renvoie quand même `{ ok: true }`.
  evidence: Pattern pré-existant (antérieur à la story 9.1, qui l'a seulement suivi pour trigger_actions). Réel : le client supabase-js résout la promesse avec `{ error }` au lieu de lever ; corriger en inspectant `error` et en n'ignorant que le code « colonne absente » (42703). À traiter globalement sur tous les blocs tolérants.

- source_spec: `_bmad-output/implementation-artifacts/spec-9-2-debloquer-les-tours-par-des-actions-non-avis.md`
  summary: Réconcilier l'éditeur commerçant (`app/dashboard/wheel/WheelEditor.tsx`) avec le modèle `trigger_actions` — le toggle legacy « Avis Google : un avis contre un tour » est désormais mensonger (l'avis ne débloque plus rien), le champ `instagram_url` peut devenir non éditable si le toggle legacy `instagram_enabled` est off alors qu'`instagram` est coché dans `trigger_actions`, et les avertissements « noChannel / 1 tour avis uniquement » ne reflètent plus le vrai nombre de tours.
  evidence: Constats revue 9.2 (Blind Hunter). Hors périmètre de 9.2 (Never : « ne pas toucher à l'éditeur 9.1 » ; présentation neutre de l'avis = story 9.3). À traiter en 9.3 (avis en CTA neutre) et/ou une story de nettoyage des toggles legacy.

- source_spec: `_bmad-output/implementation-artifacts/spec-9-2-debloquer-les-tours-par-des-actions-non-avis.md`
  summary: Le comptage du plafond quotidien (`daily_prize_limit`) dans `app/api/play/route.ts` compte encore les tours GAGNANTS historiques de type `review` du jour ; aucun nettoyage des lignes `plays` de type `review` orphelines n'est prévu.
  evidence: Constat revue 9.2 (Blind Hunter #15). Pré-existant et sans impact futur (plus aucun tour `review` n'est créé), mais à confirmer/traiter éventuellement lors de la migration des configs existantes (story 9.4).

- source_spec: `_bmad-output/implementation-artifacts/spec-9-3-avis-google-cta-neutre.md`
  summary: Le garde de sauvegarde `noChannel` de l'éditeur (`app/dashboard/wheel/WheelEditor.tsx`, ~l.336 + bouton Enregistrer l.1109) compte encore `review_enabled` comme un « canal à tour » et ignore `trigger_actions` : un commerçant n'activant que l'avis peut enregistrer alors que les joueurs n'ont aucun tour, et un commerçant n'utilisant que loyalty/optin (via trigger_actions) est bloqué à l'enregistrement ; l'avertissement « activez au moins un canal, sinon aucun tour » est devenu faux.
  evidence: Constats revue 9.3 (les 3 relecteurs). Réel, mais marqué **Ask-First / hors périmètre** dans le spec 9.3 (ne pas toucher au garde `noChannel`). À traiter dans une story dédiée de réconciliation de l'éditeur : baser « au moins un tour » sur `trigger_actions` et non sur `instagram_enabled`/`review_enabled`.

- source_spec: `_bmad-output/implementation-artifacts/spec-9-3-avis-google-cta-neutre.md`
  summary: Deux sources de vérité pour Instagram non synchronisées — le toggle legacy `instagram_enabled` (éditeur) vs `"instagram" ∈ trigger_actions` (modèle de jeu 9.2) : désactiver le toggle ne retire pas `instagram` de `trigger_actions`, donc le jeu peut encore proposer le tour Instagram.
  evidence: Constat revue 9.3 (Blind Hunter). Pré-existant au découpage 9.1/9.2. À unifier lors de la réconciliation de l'éditeur (mêmes travaux que le point noChannel ci-dessus).

- source_spec: `_bmad-output/implementation-artifacts/spec-9-3-avis-google-cta-neutre.md`
  summary: La FAQ d'aide commerçant (`app/dashboard/aide/page.tsx`, ~l.88) est obsolète : « Est-ce légal d'offrir un cadeau contre un avis ? » — sous le modèle option A, le cadeau n'est plus lié à l'avis (CTA neutre non récompensé). Reformuler pour ne plus suggérer un cadeau conditionné à un avis.
  evidence: Constat revue 9.3 (Blind Hunter). Hors Code Map de 9.3 (fichier d'aide non touché). Mise à jour documentaire à planifier.

- source_spec: `_bmad-output/implementation-artifacts/spec-9-4-banniere-migration-avis.md`
  summary: La fermeture de la bannière de migration avis n'est persistée que côté navigateur (`localStorage`, par établissement). Pour une communication de conformité, il n'y a ni accusé de réception côté serveur ni mesure de portée (le bandeau réapparaît sur un nouvel appareil/navigateur).
  evidence: Constat revue 9.4 (Blind Hunter / Edge Case). Choix assumé (spec 9.4 = dismiss localStorage, pas d'email/serveur). Enhancement possible si l'on veut prouver que les commerçants ont été informés : flag serveur `avis_notice_ack` + éventuelle analytics.

- source_spec: `_bmad-output/implementation-artifacts/spec-editor-reconcile-trigger-actions.md`
  summary: L'action déclenchante « Fidélité » est sélectionnable dès que le MODULE est dans la formule (`showFidelite`), sans vérifier que la carte de fidélité est réellement activée (`loyalty_enabled`). Un commerçant avec le module mais la carte désactivée peut offrir un tour « fidélité » renvoyant vers une carte non active.
  evidence: Constat revue (Blind Hunter). Raffinement UX : gater aussi sur `loyalty_enabled`, ou prompter l'activation de la carte. Hors périmètre immédiat (le point demandé était le gating par formule).

- source_spec: `_bmad-output/implementation-artifacts/spec-editor-reconcile-trigger-actions.md`
  summary: `app/api/dashboard/wheel/route.ts` (l.76-80) force encore `instagram_enabled/review_enabled` à true si les deux sont faux (« au moins un canal ») — remnant serveur du garde retiré de l'UI. Inerte aujourd'hui (l'UI n'envoie plus `instagram_enabled` → défaut true), mais incohérent avec le nettoyage.
  evidence: Constat revue (Blind Hunter). Nettoyage serveur à faire (hors Code Map de cette story).

- source_spec: `_bmad-output/implementation-artifacts/spec-editor-reconcile-trigger-actions.md`
  summary: Aucun backfill ne dérive `trigger_actions` des anciens `instagram_enabled=false` : un commerçant qui avait désactivé Instagram (ancien modèle) mais garde `trigger_actions=["instagram"]` (défaut 0045) débloque désormais des tours Instagram. Pré-existant à cette story (issu du découpage 9.1/9.2/9.4).
  evidence: Constat revue (Blind Hunter). Migration data éventuelle, ou informer via la bannière 9.4.
