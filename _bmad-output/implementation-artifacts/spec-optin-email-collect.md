---
title: 'Actions Offres & Fidélité : proposer l''e-mail + code auto-envoyé'
type: 'feature'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 0
baseline_commit: '88108a785e949e3a27123b132e15a3fae64bc0cc'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Les actions déclenchantes « Offres » (`optin`) et « Fidélité » (`loyalty`) débloquent un tour **sans jamais proposer de laisser un e-mail** — alors que leur but est justement la collecte (offres / inscription). La saisie d'e-mail n'existe qu'**après** le tirage.

**Approach:** Quand le joueur choisit **Offres** ou **Fidélité**, afficher d'abord une **étape « laissez votre e-mail »** (facultative, **sans consentement obligatoire**). S'il saisit un e-mail valide → enregistrer le lead (`/api/lead` existant) et le mémoriser ; qu'il le remplisse **ou non**, le tour se débloque ensuite. Après une **victoire**, si un e-mail a été capté, **envoyer automatiquement le code** à cette adresse (`/api/prize-email` existant) sans le redemander ; sinon le formulaire manuel « Recevoir mon code » reste proposé.

## Boundaries & Constraints

**Always:** l'étape e-mail s'affiche pour les actions `optin` **et** `loyalty` (jamais pour `instagram`, qui garde son ouverture de lien) ; l'e-mail est **facultatif** — le tour se débloque **avec ou sans** e-mail ; **aucun consentement obligatoire** ; si un e-mail **valide** est fourni → POST `/api/lead` (best-effort) + mémorisation pour l'auto-envoi ; réutiliser `/api/lead` et `/api/prize-email` **existants** ; auto-envoi du code best-effort (un échec **ne casse pas** l'affichage du code) ; en mode `preview`, l'étape s'affiche **sans** appel réseau.

**Ask First:** exiger l'e-mail (le rendre bloquant) ; réintroduire une case de consentement obligatoire ; créer un nouvel endpoint.

**Never:** toucher au tirage serveur, à la contrainte d'unicité, à `/api/play` (l'étape e-mail est **client**, avant le spin) ; réintroduire `review` comme déclencheur ; conditionner l'avis à la satisfaction ; retirer la mention de conformité.

## I/O & Edge-Case Matrix

`isValidEmail(email)` et `autoSendCodeTarget({ capturedEmail, code, isWin })` (logique pure) :

| Scenario | Input / State | Expected Output | Error Handling |
|---|---|---|---|
| E-mail valide | `isValidEmail("a@b.fr")` | `true` | N/A |
| E-mail invalide / vide | `isValidEmail("a@")` / `""` / `"x"` | `false` | N/A |
| Auto-envoi (gagné + e-mail) | `autoSendCodeTarget({capturedEmail:"a@b.fr", code:"X1", isWin:true})` | `"a@b.fr"` | N/A |
| Pas d'e-mail capté | `autoSendCodeTarget({capturedEmail:null, code:"X1", isWin:true})` | `null` | N/A |
| Perdu (pas de code utile) | `autoSendCodeTarget({capturedEmail:"a@b.fr", code:"", isWin:false})` | `null` | N/A |

</frozen-after-approval>

## Code Map

- `lib/optin.ts` (nouveau) -- `isValidEmail(email): boolean` (regex simple, trim) + `autoSendCodeTarget({ capturedEmail, code, isWin }): string | null`. Pur, testable.
- `app/[slug]/Game.tsx:193` -- `Screen` : ajouter `"collect"` (étape e-mail).
- `app/[slug]/Game.tsx:713` (`startPlay`) -- si `kind === "optin" || kind === "loyalty"` → `setScreen("collect")` (au lieu d'ouvrir un lien / d'aller à `"spin"`) ; `instagram` inchangé (ouvre le lien puis `"spin"`).
- `app/[slug]/Game.tsx` (nouvel écran `collect`) -- champ e-mail **facultatif**, **sans** case de consentement (réutiliser `leadEmail` + styles `.lead-form`) ; deux issues : « Continuer » (avec ou sans e-mail) et l'action se débloque. Si `isValidEmail(leadEmail)` et `!preview` → POST `/api/lead` (best-effort, calqué sur `submitLead`) + `setCapturedEmail(leadEmail.trim())`. Puis `setScreen("spin")`.
- `app/[slug]/Game.tsx` (effet sur `prize`) -- à la révélation d'un lot **gagnant** avec code : si `autoSendCodeTarget({capturedEmail, code, isWin})` non-null et `!preview` → POST `/api/prize-email` (best-effort) → `setCodeEmailSent(true)`. Une seule fois.
- `app/[slug]/Game.tsx:1202-1229` (écran prize) -- masquer le formulaire manuel `emailMyCode` quand le code a été auto-envoyé (`codeEmailSent`) ; le conserver en repli sinon.
- `tests/optin.test.ts` (nouveau) -- couvre `isValidEmail` + `autoSendCodeTarget`.

## Tasks & Acceptance

**Execution:**
- [x] `lib/optin.ts` -- `isValidEmail` + `autoSendCodeTarget` (pur) -- validation + décision d'auto-envoi testables
- [x] `app/[slug]/Game.tsx` -- écran `collect` (e-mail facultatif, sans consentement) pour `optin` **et** `loyalty` ; le tour se débloque avec ou sans e-mail ; si e-mail valide → POST `/api/lead` best-effort + mémorise `capturedEmail`
- [x] `app/[slug]/Game.tsx` -- auto-envoi du code à `capturedEmail` après victoire (`/api/prize-email`, best-effort) ; formulaire manuel en repli
- [x] `tests/optin.test.ts` -- teste la matrice I/O

**Acceptance Criteria:**
- Given l'action « Offres » ou « Fidélité », when le joueur clique, then une étape **« laissez votre e-mail »** (facultative, **sans consentement obligatoire**) s'affiche avant le tour.
- Given cette étape, when le joueur continue **sans** e-mail, then le tour se débloque quand même ; when il fournit un e-mail **valide**, then le lead est enregistré (`/api/lead`) et l'e-mail mémorisé, puis le tour se débloque.
- Given une **victoire** et un e-mail capté, when le lot s'affiche, then le code est **envoyé automatiquement** à cette adresse sans la redemander ; sinon le formulaire manuel reste proposé.
- Given `instagram`, when le joueur clique, then le comportement est **inchangé** (ouverture du lien, pas d'étape e-mail). Given `preview`, then l'étape s'affiche **sans** appel réseau.

## Design Notes

- `capturedEmail` est mémorisé dès qu'un e-mail valide est saisi (Offres/Fidélité) ; il alimente `autoSendCodeTarget`. Le formulaire post-victoire `collect_email` (`submitLead`) reste inchangé.
- Échecs `/api/lead` / `/api/prize-email` **silencieux** : collecte et envoi sont des conforts, jamais des bloqueurs.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: 0 erreur
- `npm run lint` -- expected: 0 warning
- `npm test` -- expected: tous verts (dont `tests/optin.test.ts`)
- `npm run build` -- expected: succès

**Manual checks:**
- `/{slug}` avec Offres/Fidélité actives → clic → l'étape e-mail s'affiche ; « Continuer » sans e-mail débloque le tour ; avec e-mail valide → gagner → « Code envoyé par e-mail » sans re-saisie. Instagram : comportement inchangé.

## Suffix — Post-Review Fix

Revue (3 relecteurs). Correctifs appliqués : anti-doublon auto-envoi (`autoSentCodeRef`) ; dédup `/api/lead` (`leadSentEmailRef`) ; feedback inline si e-mail invalide ; copie de l'étape selon l'action + consentement implicite ; a11y (label/inputMode/autoComplete) ; bouton Retour ; pré-remplissage du formulaire manuel ; suppression du double formulaire post-victoire ; borne de longueur e-mail + helper `needsCollectStep`. Faux positifs écartés (null géré, `setCurrent` déjà appelé, `isWin` figé). Reportés : ouverture carte fidélité, traçabilité consentement RGPD.

## Suggested Review Order

**Logique pure (testée)**

- `isValidEmail` (+ borne longueur) & `autoSendCodeTarget` (garde gagné/code/e-mail) & `needsCollectStep`.
  [`optin.ts:7`](../../lib/optin.ts#L7)

**Étape « collect » (Offres/Fidélité, e-mail facultatif)**

- Routage via `needsCollectStep` ; `continueFromCollect` : erreur si invalide, capture + `/api/lead` dédupé, tour débloqué avec/sans e-mail.
  [`Game.tsx:778`](../../app/[slug]/Game.tsx#L778)
- Écran collect : copie selon l'action, a11y, consentement implicite, retour.
  [`Game.tsx:1160`](../../app/[slug]/Game.tsx#L1160)

**Auto-envoi du code (best-effort, une seule fois)**

- Envoi une fois par code, pré-remplissage/repli du formulaire manuel.
  [`Game.tsx:526`](../../app/[slug]/Game.tsx#L526)

**Tests**

- Matrices `isValidEmail` / `autoSendCodeTarget` / `needsCollectStep`.
  [`optin.test.ts:4`](../../tests/optin.test.ts#L4)
