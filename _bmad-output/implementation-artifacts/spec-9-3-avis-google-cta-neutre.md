---
title: 'Story 9.3 — Avis Google en CTA neutre non récompensé'
type: 'feature'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 0
baseline_commit: '68b3fb60c33cf8afe9b191698260409b233ddc24'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Depuis 9.2, l'avis Google ne débloque plus de tour, mais **aucun** CTA avis n'est plus proposé au joueur, et l'éditeur commerçant affiche encore un toggle mensonger « Proposer le tour Avis Google — un avis contre un tour de roue ». Il faut réintroduire l'avis **au neutre** (optionnel, non récompensé) sans jamais le conditionner à la satisfaction.

**Approach:** Ajouter sur la page de jeu un CTA « Laisser un avis Google » **visible par tous**, non récompensé, ouvrant `review_url` (masqué proprement si absent), sans lien avec un cadeau/tour. Corriger l'éditeur : le toggle avis contrôle désormais l'**affichage du CTA neutre** (plus « un tour »). Aucun *review gating* (filtrage selon la note).

## Boundaries & Constraints

**Always:** CTA avis visible par **tous** les joueurs quand configuré (`review_enabled !== false` **et** `review_url` non vide) ; libellé **neutre**, aucun cadeau ni tour associé ; masqué proprement si `review_url` absent ; la mention de conformité (`compliance_note`) reste affichée ; `review_url` reste éditable dans l'éditeur.

**Ask First:** modifier la logique de sauvegarde `noChannel` (bouton Enregistrer) ou la sémantique de `instagram_enabled` — legacy, hors périmètre avis.

**Never:** conditionner l'avis à la satisfaction / à la note (pas de *review gating* — la décision d'afficher le CTA ne prend **aucune** entrée de note/satisfaction) ; lier un cadeau ou un tour à l'avis ; réintroduire `review` comme `play_type`/action déclenchante (9.2) ; retirer la mention de conformité ; toucher au tirage serveur ou au modèle `trigger_actions`.

## I/O & Edge-Case Matrix

`shouldShowReviewCta(cfg)` (logique pure — **aucun paramètre de note/satisfaction**, ce qui rend le *review gating* structurellement impossible) :

| Scenario | Input / State | Expected Output | Error Handling |
|---|---|---|---|
| CTA affiché | `{ review_enabled: true, review_url: "https://g.page/r/x" }` | `true` | N/A |
| Lien absent → masqué | `{ review_enabled: true, review_url: null }` / `""` | `false` | N/A |
| Désactivé par le commerçant | `{ review_enabled: false, review_url: "https://g.page/r/x" }` | `false` | N/A |
| Défaut tolérant (enabled absent) | `{ review_url: "https://g.page/r/x" }` | `true` (`!== false`) | N/A |

</frozen-after-approval>

## Code Map

- `lib/wheel.ts:36` -- ajouter `shouldShowReviewCta(cfg: { review_enabled?: unknown; review_url?: unknown }): boolean` près de `isTriggerActionAllowed` : `true` ⟺ `review_enabled !== false` ET `review_url` string non vide. **Aucun** paramètre de note → pas de *review gating* possible.
- `app/[slug]/Game.tsx:1214` -- bloc persistant (à côté de `fid-link`, hors des `screen`, donc visible sur tous les écrans « termine ou navigue ») : rendre un CTA `<a className="review-cta" href={config.review_url} target="_blank" rel="noopener">★ Laisser un avis Google</a>` quand `shouldShowReviewCta(config)`, avec une courte mention neutre (« Facultatif — sans incidence sur vos cadeaux »). Ne pas toucher au récap DONE ni au modèle des tours.
- `app/dashboard/wheel/WheelEditor.tsx:548-616` -- reformuler l'intro pour ne plus promettre « un tour » à l'avis ; relibeller le toggle avis en « Afficher un lien avis Google — facultatif, **non récompensé** (aucun tour ni cadeau lié) » ; retirer l'avertissement avis « 1 tour (avis Google uniquement) » (l.558-562) ; conserver le champ `review_url` (l.604-616). Ne pas modifier `noChannel`/le garde de sauvegarde ni le toggle Instagram.
- `app/globals.css` -- style `.review-cta` (cohérent avec `.fid-link`/`.game-order-cta`).
- `tests/wheel.test.ts` -- couvrir `shouldShowReviewCta` (matrice I/O).

## Tasks & Acceptance

**Execution:**
- [x] `lib/wheel.ts` -- `shouldShowReviewCta(cfg)` (pas d'entrée de note → jamais de review gating) -- décision d'affichage testable
- [x] `app/[slug]/Game.tsx` -- CTA avis neutre dans le bloc persistant, visible par tous quand configuré, ouvre `review_url`, aucun cadeau/tour lié -- réintroduit l'avis au neutre
- [x] `app/dashboard/wheel/WheelEditor.tsx` -- toggle avis = affichage du CTA neutre (libellé non récompensé) ; retirer la promesse de tour ; garder `review_url` -- éditeur cohérent avec 9.2
- [x] `app/globals.css` -- style `.review-cta`
- [x] `tests/wheel.test.ts` -- tester `shouldShowReviewCta` (matrice I/O)

**Acceptance Criteria:**
- Given un joueur sur `/{slug}` avec `review_url` configuré et avis activé, when il termine **ou** navigue, then le CTA « Laisser un avis Google » s'affiche **à tous, au neutre** (aucune condition de note/satisfaction), ouvre `review_url`, et **aucun cadeau ni tour** n'y est lié.
- Given `review_url` absent ou avis désactivé, when la page s'affiche, then le CTA est **masqué** proprement (pas de lien vide).
- Given la page de jeu, when un lot est révélé, then la **mention de conformité** reste affichée (inchangée).
- Given l'éditeur, when le commerçant ouvre « Canaux & liens », then le toggle avis n'affiche plus « un avis contre un tour » et `review_url` reste éditable.

## Design Notes

- `shouldShowReviewCta` n'accepte **que** `{review_enabled, review_url}` : l'absence de tout paramètre de note rend le *review gating* impossible par construction (garantie testable).
- `review_enabled` est **repurposé** : « avis débloque un tour » (avant 9.2) → « afficher le CTA avis neutre ». Aucune migration : la colonne et le défaut (`!== false`) sont réutilisés tels quels.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: 0 erreur
- `npm run lint` -- expected: 0 warning
- `npm test` -- expected: tous verts (dont `shouldShowReviewCta`)
- `npm run build` -- expected: succès

**Manual checks:**
- `/{slug}` avec `review_url` → CTA « Laisser un avis Google » visible pour tous, ouvre le lien, aucune récompense ; sans `review_url` → pas de CTA. Éditeur : toggle avis sans promesse de tour, lien éditable.

## Suggested Review Order

**Décision & sûreté du lien (cœur : neutralité + anti-XSS)**

- URL sûre ou `null` : http(s) normalisé, schémas hostiles rejetés ; aucun paramètre de note (pas de review gating).
  [`wheel.ts:65`](../../lib/wheel.ts#L65)
- Visibilité dérivée de l'URL sûre (mêmes garanties).
  [`wheel.ts:84`](../../lib/wheel.ts#L84)

**Affichage côté joueur (neutre, visible par tous)**

- `reviewHref` calculé une fois ; CTA rendu uniquement si sûr.
  [`Game.tsx:446`](../../app/[slug]/Game.tsx#L446)
- CTA neutre dans le bloc persistant (tous écrans), `rel="noopener noreferrer"`, a11y ; aucun cadeau/tour lié.
  [`Game.tsx:1226`](../../app/[slug]/Game.tsx#L1226)

**Éditeur (cohérence avec le modèle 9.2)**

- Toggle avis relibellé « facultatif, non récompensé » ; `review_url` reste éditable.
  [`WheelEditor.tsx:596`](../../app/dashboard/wheel/WheelEditor.tsx#L596)

**Tests (verrouillent les invariants)**

- `reviewCtaHref` : normalisation https, rejet `javascript:`/`data:`, trim, désactivé→null.
  [`wheel.test.ts:181`](../../tests/wheel.test.ts#L181)
- `shouldShowReviewCta` : affiché/masqué + « pas de review gating » (@ts-expect-error rating).
  [`wheel.test.ts:113`](../../tests/wheel.test.ts#L113)
