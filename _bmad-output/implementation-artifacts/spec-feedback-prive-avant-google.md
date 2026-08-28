---
title: 'Feedback privé avant Google'
type: 'feature'
created: '2026-08-27'
status: 'done'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Un client mécontent poste directement un avis Google négatif — que l'on ne peut plus retirer. Il n'existe aucun canal pour qu'il exprime son insatisfaction EN PRIVÉ et que le commerçant la rattrape avant.

**Approach:** Offrir un formulaire de feedback privé (« Un souci ? Dites-le nous »), ouvert à TOUS les clients, sur les pages jeu et fidélité. Le message est stocké et le commerçant est alerté (push best-effort), pour agir avant l'avis public. Opt-in commerçant.

## Boundaries & Constraints

**Always:** Formulaire ouvert à TOUS (jamais conditionné à la satisfaction). Endpoint public rate-limité. Alerte commerçant best-effort (jamais bloquante). Lectures tolérantes. `merchantRoute`/`getMyBusiness` côté commerçant. Français. Logique pure testée en `lib/`.

**Ask First:** _None._

**Never:** JAMAIS de review gating (ne pas router « contents → Google / mécontents → privé »). Le canal privé et l'invitation Google (existante) restent indépendants. Pas d'IA. Ne pas exposer le feedback à d'autres commerces (scoping business_id).

## I/O & Edge-Case Matrix

Fonction pure `sanitizeFeedback({ message, email })` :

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Message valide | message="Trop d'attente", email="a@b.fr" | `{ ok:true, message (trim, ≤1000), email (lower, ≤120) }` | N/A |
| Message vide | message="   " | `{ ok:false }` | rejeté |
| Email invalide | message ok, email="xx" | `{ ok:true, message, email:null }` (email ignoré, pas d'échec) | email écarté |
| Message trop long | 5000 caractères | tronqué à 1000 | N/A |

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/0071_feedback.sql` -- table `feedback` (id, business_id fk, message text, email text null, created_at) + RLS ; `wheel_configs.feedback_enabled boolean default false` -- stockage + opt-in
- [ ] `lib/feedback.ts` -- `sanitizeFeedback(input)` pur (bornes, email tolérant) -- validation testable
- [ ] `tests/feedback.test.ts` -- couvrir la matrice -- garantir la logique pure
- [ ] `app/api/feedback/route.ts` -- `publicRoute`, rateLimit ip ; résout business par slug ; refuse si `feedback_enabled` non vrai (lecture tolérante) ; `sanitizeFeedback` ; insert ; alerte `sendPushToBusiness` (best-effort) -- réception
- [ ] `components/FeedbackForm.tsx` -- client : lien « 💬 Un souci ? Dites-le nous » qui déplie un champ message + e-mail facultatif → POST `/api/feedback` → confirmation ; ne s'affiche que si `enabled` -- UI client
- [ ] `app/[slug]/fidelite/LoyaltyCard.tsx` + `app/[slug]/fidelite/page.tsx` -- rendre `<FeedbackForm>` (prop `feedbackEnabled` lue tolérante), sous la carte -- surface fidélité
- [ ] `app/[slug]/Game.tsx` + `app/[slug]/page.tsx` -- rendre `<FeedbackForm>` sur les écrans de fin (près de `HighlightCard`, `!preview`), prop `feedbackEnabled` -- surface jeu
- [ ] `app/dashboard/wheel/WheelEditor.tsx` + `wheel/page.tsx` + `api/dashboard/wheel/route.ts` -- toggle « 💬 Recueillir les avis privés » (lecture/écriture tolérantes) -- opt-in commerçant
- [ ] `app/dashboard/feedback/page.tsx` -- page commerçant : liste des feedbacks (scoping business_id, tolérante) -- consultation
- [ ] `app/dashboard/layout.tsx` -- entrée nav « 💬 Retours » vers `/dashboard/feedback` -- accès
- [ ] `app/globals.css` -- styles `.feedback-*` -- présentation

**Acceptance Criteria:**
- Given `feedback_enabled` activé, when un client ouvre la page jeu ou fidélité, then il voit « Un souci ? Dites-le nous » et peut envoyer un message privé.
- Given `feedback_enabled` désactivé, when un client ouvre ces pages, then aucun formulaire n'apparaît.
- Given un feedback envoyé, when l'insertion réussit, then le commerçant reçoit une alerte push (si abonné) et le message apparaît dans `/dashboard/feedback`.
- Given un autre commerce, when le commerçant consulte ses retours, then il ne voit que les siens (scoping business_id).
- Given le formulaire, when il est affiché, then il n'est JAMAIS conditionné à une note/satisfaction (pas de gating).

## Code Map

- `components/HighlightCard.tsx` + rendus `app/[slug]/Game.tsx:1467,1508` et `LoyaltyCard.tsx:328` -- modèle exact de composant client conditionnel injecté sur les mêmes surfaces.
- `app/api/lead/route.ts` -- modèle d'endpoint public (publicRoute + rateLimit + résolution slug + insert).
- `lib/push.ts:119` -- `sendPushToBusiness(db, businessId, payload)` pour l'alerte.
- `app/dashboard/wheel/*` + `api/dashboard/wheel/route.ts` -- patterns toggle tolérant (cf. `review_invite`, `convert_nudge`).
- `app/dashboard/layout.tsx:144` -- nav ; `app/dashboard/leads/page.tsx` -- modèle de page-liste commerçant.
- `lib/campaigns.ts` -- `escapeHtml` si besoin d'affichage.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: aucune erreur
- `npx vitest run tests/feedback.test.ts` -- expected: verts
- `npx next lint --file lib/feedback.ts --file app/api/feedback/route.ts --file components/FeedbackForm.tsx` -- expected: no warnings
- `npx next build` -- expected: OK
