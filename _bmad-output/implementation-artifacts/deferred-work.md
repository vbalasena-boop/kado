
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

- source_spec: `_bmad-output/implementation-artifacts/spec-optin-email-collect.md`
  summary: L'action « Fidélité » (loyalty) n'ouvre plus la page carte `/{slug}/fidelite` au clic (elle montre l'étape e-mail à la place, conforme au spec gelé). La carte reste accessible via le lien persistant « 🎟️ Ma carte de fidélité » — mais celui-ci est gaté sur `config.loyalty_enabled`, indépendant du fait que `loyalty` soit une action déclenchante. Si loyalty est un déclencheur mais `loyalty_enabled` faux, la carte est inatteignable.
  evidence: Constat revue (Blind Hunter). Décision produit à confirmer : après collecte e-mail, faut-il aussi ouvrir/rendre visible la carte pour l'action Fidélité ? À traiter avec le point déjà reporté sur le gating `loyalty_enabled`.

- source_spec: `_bmad-output/implementation-artifacts/spec-optin-email-collect.md`
  summary: L'étape « collect » poste l'e-mail à `/api/lead` SANS case de consentement explicite (choix utilisateur : consentement facultatif), alors que le formulaire post-victoire l'exige. Une mention de consentement IMPLICITE a été ajoutée à l'écran, mais la table `leads` reçoit désormais des opt-ins avec et sans consentement explicitement horodaté.
  evidence: Constat revue (Blind Hunter) — considération RGPD/traçabilité. Choix produit assumé (fluidité). À revoir si besoin de preuve de consentement : enregistrer un flag consent côté `/api/lead`.

- source_spec: `_bmad-output/implementation-artifacts/spec-10-1-demander-confirmation-reabonnement.md`
  summary: Pas de journal d'audit du consentement (RGPD Art. 7(1) « démontrer » le consentement) : la confirmation ne fait que basculer `unsubscribed_at`/`marketing_ok`, sans enregistrer un événement horodaté (source, IP/UA, `resubscribed_at`). Idem, un jeton reste valide 48 h et n'est pas à usage unique (rejeu possible dans la fenêtre si le client se re-désinscrit).
  evidence: Constats revue (Blind/Edge). Nécessite une colonne/table d'événements de consentement + éventuel nonce à usage unique (lié à l'`unsubscribed_at` courant). Migration → hors périmètre de cette story.

- source_spec: `_bmad-output/implementation-artifacts/spec-10-1-demander-confirmation-reabonnement.md`
  summary: Le secret de signature des jetons repose sur `PLAYER_COOKIE_SECRET` (repli `SUPABASE_SERVICE_ROLE_KEY`, comme lib/unsub.ts) : couple la signature du consentement à la clé DB la plus privilégiée ; une rotation invaliderait tous les liens en cours. La confirmation ne re-vérifie pas le statut « active » du commerce. Timing d'énumération résiduel côté demande (travail conditionnel).
  evidence: Constats revue. Améliorations possibles : secret dédié `RESUB_SECRET` rotable indépendamment ; re-check statut business à la confirmation ; normaliser le timing. Non bloquant.

- source_spec: `_bmad-output/implementation-artifacts/spec-10-1-demander-confirmation-reabonnement.md`
  summary: `app/api/loyalty/extra` peut encore mettre `marketing_ok=true` côté serveur alors que `unsubscribed_at` est renseigné (l'UI masque la case, mais la garde est cliente). État incohérent possible ; en pratique les crons respectent `unsubscribed_at`, donc le désinscrit reste protégé.
  evidence: Constat revue (Blind). Pré-existant. À durcir : refuser `marketing_ok=true` côté `extra` tant que `unsubscribed_at` non nul (forcer le passage par le double opt-in).

- source_spec: `_bmad-output/implementation-artifacts/spec-11-1-rembourser-commande-payee.md`
  summary: Pas de réconciliation du statut réel du refund Stripe. `stripe.refunds.create` peut revenir `pending` puis basculer `failed`/`canceled` (ex. solde négatif du compte connecté empêchant le `reverse_transfer`) ; la commande est marquée `refunded=true` dès la création, sans handler webhook `charge.refund.updated`/`refund.updated` pour corriger l'état. Idem, aucun `refunded_by` (acteur) ni motif n'est enregistré (traçabilité financière).
  evidence: Constats revue (Blind/Edge). L'AC de 11.1 exige « un refund est créé » (création, pas règlement) → conforme, mais une réconciliation via webhook + une colonne `refunded_by`/`reason` durciraient le chemin argent. Migration + webhook → hors périmètre de la story.

- source_spec: `_bmad-output/implementation-artifacts/spec-11-1-rembourser-commande-payee.md`
  summary: Aucune notification au client lors d'un remboursement (e-mail/reçu). Stripe peut envoyer un reçu selon la configuration du compte, mais l'app n'informe pas explicitement le client remboursé.
  evidence: Constat revue (Blind). Hors AC de 11.1 (la notif client est requise par 11.2 à l'annulation). À considérer comme amélioration UX, éventuellement mutualisée avec la notif d'annulation de 11.2.

- source_spec: `_bmad-output/implementation-artifacts/spec-11-2-annuler-une-commande.md`
  summary: Le remboursement déclenché à l'annulation (comme le refund manuel 11.1) n'est pas réconcilié : statut commande + drapeau `refunded` écrits séparément, sans handler webhook `charge.refund.updated` pour rattraper un refund `pending→failed`. Pas non plus d'horodatage `notified_cancelled_at` de la notif d'annulation (le `ready` a `notified_ready_at`).
  evidence: Constats revue (Blind/Edge/Verif) sur 11.2. Mutualiser avec le defer réconciliation/audit de 11.1 : un webhook de réconciliation + une colonne `notified_cancelled_at` (migration) couvriraient les deux. Non bloquant.

- source_spec: `_bmad-output/implementation-artifacts/spec-f2-reconciliation-webhook-refunds.md`
  summary: La réconciliation webhook (F2) marque `refunded=true` sur un booléen sans vérifier que le refund couvre le TOTAL de la commande : un remboursement PARTIEL (émis manuellement depuis le dashboard Stripe, ou un futur flux partiel) marquerait la commande « entièrement remboursée ». Notre flux n'émet que des refunds totaux, donc inerte aujourd'hui.
  evidence: Constats revue F2 (Blind/Edge). À traiter si un flux de remboursement partiel est introduit : comparer `refund.amount` au total commande, ou ajouter une colonne `refunded_amount_cents`. Ask-First (hors périmètre F2).

- source_spec: `_bmad-output/implementation-artifacts/spec-f2-reconciliation-webhook-refunds.md`
  summary: Pas de déduplication d'événements au niveau Stripe event.id (pas de table `processed_events`). L'idempotence repose sur les filtres par chemin (`refunded=false` en confirmation, `stripe_refund_id`+`refunded=true` en révocation) — suffisant pour ces events, mais une infra de dédup générale bénéficierait à tous les handlers du webhook. Également : sur un `succeeded` à 0 ligne on ne distingue pas « déjà réconcilié » de « commande introuvable » (nécessiterait une lecture préalable) pour une alerte plus fine.
  evidence: Constats revue F2 (les 3 relecteurs). Améliorations d'observabilité/robustesse non bloquantes ; l'idempotence par filtres couvre le risque argent immédiat.
