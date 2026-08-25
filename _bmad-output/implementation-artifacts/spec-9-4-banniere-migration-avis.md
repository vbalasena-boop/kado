---
title: 'Story 9.4 — Informer les commerçants « avis » (bannière de migration)'
type: 'feature'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 0
baseline_commit: '8b741f1ab5d4e67171c85b09b6c9c5ac57c58d7b'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Les établissements qui débloquaient un tour via l'avis Google ont vu ce mécanisme retiré (9.2/9.3, conformité option A). La **donnée est déjà migrée** (migration `0045` a posé `trigger_actions = ["instagram"]` NOT NULL pour tous ; `sanitizeTriggerActions` garantit ≥1 action valide), mais **aucun commerçant concerné n'est informé** du changement.

**Approach:** Afficher une **bannière** dans le tableau de bord commerçant, uniquement aux établissements **concernés** (ceux qui utilisaient l'avis : avis actif + lien renseigné), expliquant que l'avis ne débloque plus de tour et invitant à vérifier leurs actions déclenchantes (lien vers `/dashboard/wheel`). **Aucune migration SQL** (redondante), **aucun email**, aucun changement du jeu.

## Boundaries & Constraints

**Always:** bannière montrée **seulement** aux concernés via une décision **pure et testable** (`avisMigrationNoticeNeeded` : `review_enabled !== false` ET `review_url` string non vide) ; CTA « Vérifier mes actions » → `/dashboard/wheel` ; fermeture (dismiss) **par navigateur** via `localStorage` enveloppé dans try/catch (jamais d'exception si stockage indisponible).

**Ask First:** envoyer un email/notification externe (explicitement écarté) ; introduire une migration SQL mutant les données.

**Never:** conditionner l'affichage à une note/satisfaction (aucune entrée de note) ; réintroduire `review` comme action déclenchante ; modifier le modèle des tours, le tirage serveur ou `trigger_actions` ; envoyer un email ; ajouter une migration SQL no-op.

## I/O & Edge-Case Matrix

`avisMigrationNoticeNeeded(cfg)` (logique pure — aucun paramètre de note) :

| Scenario | Input / State | Expected Output | Error Handling |
|---|---|---|---|
| Concerné (avis actif) | `{ review_enabled: true, review_url: "https://g.page/r/x" }` | `true` | N/A |
| Avis désactivé | `{ review_enabled: false, review_url: "https://g.page/r/x" }` | `false` | N/A |
| Pas de lien avis | `{ review_enabled: true, review_url: null }` / `""` | `false` | N/A |
| Défaut tolérant (enabled absent) | `{ review_url: "https://g.page/r/x" }` | `true` (`!== false`) | N/A |

</frozen-after-approval>

## Code Map

- `lib/wheel.ts:65` -- ajouter `avisMigrationNoticeNeeded(cfg: { review_enabled?: unknown; review_url?: unknown }): boolean` (près de `reviewCtaHref`) : `true` ⟺ `review_enabled !== false` ET `review_url` string non vide (trim). Aucun paramètre de note.
- `app/dashboard/page.tsx:26` -- ajouter `review_enabled` au `select` de `wheel_configs` (déjà lu : `instagram_url, review_url, loyalty_enabled`) ; après le `<p className="dash-sub">` (l.156), rendre `{avisMigrationNoticeNeeded(cfg) && <AvisMigrationBanner />}`.
- `app/dashboard/AvisMigrationBanner.tsx` (nouveau, **client**) -- bandeau informatif : texte « L'avis Google ne débloque plus de tour (conformité). Vérifiez vos actions déclenchantes. » + lien `Link href="/dashboard/wheel"` « Vérifier mes actions » + bouton fermer qui masque et persiste via `localStorage` (clé `kado_avis_notice_dismissed`), le tout en try/catch ; état initial masqué tant que le `localStorage` n'est pas lu (éviter le flash), lecture dans `useEffect`.
- `app/globals.css` -- style `.dash-notice` (bandeau ambré informatif, cohérent avec `.dash-card`/`.onboarding-err`).
- `tests/wheel.test.ts` -- couvrir `avisMigrationNoticeNeeded` (matrice I/O).

## Tasks & Acceptance

**Execution:**
- [x] `lib/wheel.ts` -- `avisMigrationNoticeNeeded(cfg)` (pure, pas d'entrée de note) -- décision « concerné » testable
- [x] `app/dashboard/AvisMigrationBanner.tsx` -- bandeau client dismissible (localStorage try/catch) + CTA vers `/dashboard/wheel`
- [x] `app/dashboard/page.tsx` -- lire `review_enabled` ; afficher la bannière quand `avisMigrationNoticeNeeded(cfg)`
- [x] `app/globals.css` -- style `.dash-notice`
- [x] `tests/wheel.test.ts` -- tester `avisMigrationNoticeNeeded` (matrice I/O)

**Acceptance Criteria:**
- Given un établissement où l'avis était actif (avis activé + lien renseigné), when le commerçant ouvre son tableau de bord, then une bannière l'informe que l'avis ne débloque plus de tour et propose « Vérifier mes actions » (→ `/dashboard/wheel`).
- Given un établissement sans avis actif (désactivé ou sans lien), when il ouvre le tableau de bord, then **aucune** bannière ne s'affiche.
- Given un commerçant qui ferme la bannière, when il recharge la page (même navigateur), then la bannière **reste masquée** (persistée en `localStorage`, sans erreur si le stockage est indisponible).
- Given la conformité, when la bannière décide de s'afficher, then cette décision ne dépend **d'aucune** note/satisfaction (garantie structurelle).

## Design Notes

- **Pas de migration SQL** : la donnée est déjà migrée (0045 → `["instagram"]` NOT NULL) et l'avis déjà neutralisé (9.2/9.3) ; ajouter une migration serait un no-op. 9.4 se limite à **informer**.
- `avisMigrationNoticeNeeded` est distinct de `shouldShowReviewCta` (intention différente : notice commerçant vs CTA joueur), même si la condition se recoupe aujourd'hui.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: 0 erreur
- `npm run lint` -- expected: 0 warning
- `npm test` -- expected: tous verts (dont `avisMigrationNoticeNeeded`)
- `npm run build` -- expected: succès

**Manual checks:**
- Dashboard d'un commerçant avec avis actif → bannière visible, « Vérifier mes actions » mène à l'éditeur, fermeture persistante ; commerçant sans avis → pas de bannière.

## Suggested Review Order

**Décision « concerné » (pure, testable)**

- Helper pur : avis actif + lien renseigné ; aucun paramètre de note (pas de review gating).
  [`wheel.ts:104`](../../lib/wheel.ts#L104)

**Affichage ciblé (cohorte réelle + module)**

- Bannière gated sur usage réel (`review > 0`, auto-extinction), roue active et config.
  [`page.tsx:165`](../../app/dashboard/page.tsx#L165)
- Bandeau client dismissible : clé `localStorage` par établissement, try/catch, sans flash, a11y.
  [`AvisMigrationBanner.tsx:18`](../../app/dashboard/AvisMigrationBanner.tsx#L18)

**Tests**

- Matrice I/O de `avisMigrationNoticeNeeded` (concerné/pas concerné, défaut tolérant, pas de note).
  [`wheel.test.ts:223`](../../tests/wheel.test.ts#L223)
