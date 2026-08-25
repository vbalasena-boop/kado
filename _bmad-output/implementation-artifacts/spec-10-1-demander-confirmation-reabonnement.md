---
title: 'Epic 10 — Ré-abonnement fidélité en double opt-in (demande + confirmation + UI)'
type: 'feature'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'd0c38fc8bb603adc675c3ec7badc65c4005a79b6'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Un client fidélité désinscrit (`loyalty_cards.unsubscribed_at` renseigné) ne peut pas se ré-abonner proprement : `app/api/loyalty/extra` met `marketing_ok` **sans** effacer `unsubscribed_at` (TODO RGPD assumé), et l'UI n'a aucun état « désinscrit ».

**Approach:** Implémenter le **double opt-in complet** (stories 10.1 + 10.2 ensemble) : (1) une route **POST** envoie un **e-mail de confirmation avec lien signé** (token dédié purpose+expiration) — sans rétablir le consentement ; (2) une route **GET de confirmation** valide le token puis **efface `unsubscribed_at` et met `marketing_ok=true`**, de façon **idempotente** ; (3) l'**UI** de la page fidélité affiche, pour un client désinscrit, un bouton « Me ré-abonner » lançant la demande.

## Boundaries & Constraints

**Always:** token « re-consent » **dédié** HMAC-SHA256 (secret `PLAYER_COOKIE_SECRET`, repli `SUPABASE_SERVICE_ROLE_KEY`) avec **purpose + expiration**, vérifié en `timingSafeEqual` ; logique pure testable `lib/resubscribe.ts` ; consentement rétabli **uniquement** à la confirmation (10.2) ; confirmation **idempotente** (double clic sans effet) ; e-mails via `sendEmail`/`emailLayout` (jamais bloquant) ; demande à **réponse neutre** `{ ok: true }` (anti-énumération) et n'envoyant l'e-mail que si la carte existe **et** est désinscrite ; `rateLimit` sur les deux routes ; lectures/écritures tolérantes.

**Ask First:** exiger le `code` de la carte (le lien e-mail est déjà la preuve de possession) ; changer la durée du lien (défaut **7 jours**).

**Never:** rétablir le consentement à la demande (10.1) ; modifier les flux d'unsub existants (`app/api/unsubscribe`, prospection) ; réutiliser `lib/unsub.ts` (pas d'expiry/purpose) ; nouvelle migration (colonnes déjà présentes) ; divulguer si un e-mail est inscrit ; toucher au jeu/tirage.

## I/O & Edge-Case Matrix

`verifyResubToken(businessId, email, exp, token, nowMs)` (logique pure) :

| Scenario | Input / State | Expected Output |
|---|---|---|
| Valide non expiré | signature correcte, `exp > nowMs` | `true` |
| Expiré | signature correcte, `exp <= nowMs` | `false` |
| Mauvais e-mail / business | signé pour d'autres valeurs | `false` |
| Falsifié / vide | signature altérée ou `""` | `false` |

</frozen-after-approval>

## Code Map

- `lib/resubscribe.ts` (nouveau) -- `signResubToken(businessId, email, exp)`, `verifyResubToken(businessId, email, exp, token, nowMs = Date.now())` (`timingSafeEqual` + `exp > nowMs`), `encodeEmail`/`decodeEmail` (base64url, cf. `app/api/unsubscribe/route.ts`), `buildResubConfirmUrl(businessId, email, ttlMs)` → `{ exp, url }` (URL absolue `.../api/loyalty/resubscribe/confirm?b=&e=&exp=&t=`, base SITE comme `lib/campaigns.ts`). Secret via helper local (cf. `lib/unsub.ts`).
- `app/api/loyalty/resubscribe/route.ts` (nouveau, **10.1**) -- `publicRoute` (zod `{ slug, email }`, `rateLimit`) : résoudre `business_id` ; lire carte `(business_id, email)` ; **si** désinscrite → `sendEmail`+`emailLayout` avec le lien signé (ttl 7 j) ; **toujours** `{ ok: true }` ; **aucune** écriture.
- `app/api/loyalty/resubscribe/confirm/route.ts` (nouveau, **10.2**) -- `GET` (params `b,e,exp,t`) : décoder l'e-mail, `verifyResubToken` → invalide/expiré ⇒ HTML « lien invalide ou expiré » (message clair) ; valide ⇒ `update loyalty_cards set unsubscribed_at=null, marketing_ok=true where business_id=b and email=email` (idempotent) ⇒ HTML succès. Tolérant.
- `app/api/loyalty/card/route.ts` -- ajouter `unsubscribed_at` au select (`CARD_COLS_EXT`) et renvoyer `unsubscribed: !!card.unsubscribed_at` (l.150-165).
- `app/[slug]/fidelite/LoyaltyCard.tsx` -- type `unsubscribed?: boolean` ; si `card.unsubscribed` → bouton « Me ré-abonner aux offres » (POST `/api/loyalty/resubscribe` avec slug+email) → état « 📧 e-mail de confirmation envoyé » ; sinon garder la case existante (l.516-525).
- `tests/resubscribe.test.ts` (nouveau) -- matrice `verifyResubToken` + round-trip `encodeEmail`/`decodeEmail`.

## Tasks & Acceptance

**Execution:**
- [x] `lib/resubscribe.ts` -- token dédié (purpose+expiry, `timingSafeEqual`), base64url e-mail, `buildResubConfirmUrl`
- [x] `app/api/loyalty/resubscribe/route.ts` -- POST demande : e-mail conditionnel (carte désinscrite), réponse neutre, aucun changement de consentement
- [x] `app/api/loyalty/resubscribe/confirm/route.ts` -- GET confirmation : token valide → efface `unsubscribed_at` + `marketing_ok=true` (idempotent) ; invalide/expiré → message clair
- [x] `app/api/loyalty/card/route.ts` -- exposer `unsubscribed`
- [x] `app/[slug]/fidelite/LoyaltyCard.tsx` -- bouton « Me ré-abonner » pour les désinscrits + état d'envoi
- [x] `tests/resubscribe.test.ts` -- matrice `verifyResubToken` + base64url

**Acceptance Criteria:**
- Given une carte `unsubscribed_at` renseigné, when le client demande le ré-abonnement, then un e-mail avec **lien signé** est envoyé et **ni** `marketing_ok` **ni** `unsubscribed_at` ne changent.
- Given un e-mail inconnu / non désinscrit, when la demande est postée, then **aucun** e-mail mais réponse **neutre** (anti-énumération).
- Given un token valide non expiré, when le client clique le lien, then `unsubscribed_at` est effacé et `marketing_ok=true` ; **rejouer** le lien laisse le même état (idempotent) ; token invalide/expiré → message clair, aucun changement.
- Given la page fidélité d'un client désinscrit, when elle s'affiche, then un bouton « Me ré-abonner » est proposé (au lieu de la simple case), et déclenche la demande.

## Design Notes

- Le lien e-mail EST la preuve de possession (il n'arrive qu'au titulaire) → pas besoin du `code`.
- `exp` est inclus **dans la signature** : impossible de prolonger la validité sans invalider le token.
- La confirmation est idempotente par construction (mêmes valeurs finales à chaque rejeu).

## Verification

**Commands:**
- `npx tsc --noEmit` -- 0 erreur
- `npm run lint` -- 0 warning
- `npm test` -- tous verts (dont `tests/resubscribe.test.ts`)
- `npm run build` -- succès

**Manual checks:**
- Page fidélité d'un désinscrit → bouton « Me ré-abonner » → e-mail reçu avec lien `.../confirm?...` → **la page affiche un bouton** → clic → consentement rétabli (idempotent au 2ᵉ clic) ; lien trafiqué/expiré → message clair ; e-mail inconnu → réponse neutre.

## Suffix — Post-Review Fix

Revue (3 relecteurs, sécurité/RGPD). Correctifs majeurs : **la confirmation n'est plus un GET mutant** (les prefetch/scanners d'e-mail auraient rétabli le consentement sans clic humain) → GET **affiche une page**, POST (clic délibéré) **écrit** ; mise à jour **filtrée** (`unsubscribed_at not null`) + **contrôle du nombre de lignes** (succès honnête / « déjà ré-abonné ») ; e-mail **transactionnel** (`marketing:false`) ; TTL **48 h** ; `Cache-Control: no-store` ; rate-limit sur le POST ; UI distingue l'**échec réseau**. Ajout de **tests de route** (cœur RGPD). Reportés : audit de consentement, secret dédié, nonce à usage unique.

## Suggested Review Order

**Jeton signé (pur, testé)**

- Signature liant purpose+`exp` ; `exp` dans la signature (non prolongeable) ; TTL 48 h.
  [`resubscribe.ts:44`](../../lib/resubscribe.ts#L44)
- Vérification à temps constant + expiration.
  [`resubscribe.ts:58`](../../lib/resubscribe.ts#L58)

**Confirmation = acte délibéré (anti-prefetch)**

- GET affiche une page + bouton (aucune écriture).
  [`confirm/route.ts:69`](../../app/api/loyalty/resubscribe/confirm/route.ts#L69)
- POST écrit uniquement sur token valide, filtré `unsubscribed_at not null`, idempotent, no-store.
  [`confirm/route.ts:108`](../../app/api/loyalty/resubscribe/confirm/route.ts#L108)

**Demande (anti-énumération)**

- Réponse neutre ; e-mail transactionnel seulement si carte désinscrite ; aucune écriture.
  [`resubscribe/route.ts:26`](../../app/api/loyalty/resubscribe/route.ts#L26)

**Tests**

- Jeton (matrice + base64url).
  [`resubscribe.test.ts:13`](../../tests/resubscribe.test.ts#L13)
- Routes : e-mail conditionnel + confirmation gated/idempotente (cœur RGPD).
  [`resubscribe-route.test.ts:90`](../../tests/resubscribe-route.test.ts#L90)
