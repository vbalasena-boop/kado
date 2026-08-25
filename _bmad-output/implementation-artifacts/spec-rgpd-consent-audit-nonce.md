---
title: 'RGPD — journal d''audit du consentement fidélité + lien de ré-abonnement à usage unique'
type: 'feature'
created: '2026-08-25'
status: 'draft'
review_loop_iteration: 0
baseline_commit: '554eb43361475c152b9c8c6c8483e21957d89ddc'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** RGPD Art. 7(1) impose de **démontrer** le consentement. Le flux de ré-abonnement fidélité (Epic 10) bascule `loyalty_cards.unsubscribed_at`/`marketing_ok` **sans trace horodatée** → aucune preuve auditable. Et le lien signé (HMAC purpose+exp, TTL 48 h) **n'est pas à usage unique** : sa signature ne dépend pas de l'état courant, donc dans la fenêtre de validité un vieux lien rejoué après une re-désinscription **réactive le consentement**.

**Approach:** (1) **Journal d'audit** append-only `consent_events` (migration 0048, calqué sur `prospect_events`, RLS default-deny/service_role) — un événement à la **confirmation de ré-abonnement** et à la **désinscription** (périmètre fidélité), écriture **best-effort** (jamais bloquante). (2) **Usage unique** : lier la signature du token à l'`unsubscribed_at` **courant** de la carte → une fois ré-abonné (`unsubscribed_at=null`), l'ancien lien ne valide plus (défense cryptographique en plus du filtre `.not(unsubscribed_at is null)` existant).

## Boundaries & Constraints

**Always:** signature du token = `${PURPOSE}:${businessId}:${email}:${unsubAt}:${exp}` (unsubAt = `unsubscribed_at` courant, `""` si null) ; `signResubToken`/`verifyResubToken` gagnent le param `unsubAt`, `buildResubConfirmUrl(businessId, email, unsubAt, ttl)` ; la **demande** (10.1) passe le `card.unsubscribed_at` qu'elle lit déjà ; la **confirmation** (GET **et** POST) **relit** la carte pour re-dériver `unsubAt` et vérifier — la valeur ne transite PAS dans l'URL ; consentement rétabli **uniquement** au POST (inchangé) ; écriture `consent_events` **best-effort** (try/catch + `reportError`, jamais bloquer le flux) ; via `getAdminClient` (service_role) ; réponses neutres/anti-énumération inchangées ; `timingSafeEqual` conservé.

**Ask First:** ajouter une policy RLS SELECT « owner » sur `consent_events` (par défaut : aucune policy, service_role seul) ; journaliser les désinscriptions **leads** (hors périmètre fidélité) ; capturer IP/User-Agent dans `meta`.

**Never:** stocker `unsubscribed_at` en clair dans l'URL/token (il est re-lu côté serveur) ; nouvelle migration autre que 0048 ; unifier avec `lib/unsub.ts` (schéma de token différent) ; bloquer le ré-abonnement/la désinscription si l'écriture d'audit échoue ; changer la sémantique du GET (page + bouton, aucune mutation) ni du POST (acte délibéré).

## I/O & Edge-Case Matrix

`verifyResubToken(businessId, email, exp, unsubAt, token, nowMs)` :

| Scenario | State | Expected |
|---|---|---|
| Valide | signé avec le `unsubAt` courant, `exp>now` | `true` |
| Ré-abonné entre-temps | carte `unsubscribed_at=null` → `unsubAt` re-dérivé `""` ≠ signé | `false` (usage unique) |
| Re-désinscrit (nouveau timestamp) | `unsubAt` courant ≠ celui signé | `false` |
| Expiré / falsifié / vide | — | `false` |

Confirmation (POST) :

| Scenario | State | Expected |
|---|---|---|
| Token valide, carte encore désinscrite | update flippe 1 ligne | `marketing_ok=true, unsubscribed_at=null` ; **1 `consent_events` `resubscribe_confirmed`** ; page « ré-abonné » |
| Rejeu (déjà ré-abonné) | `unsubAt` ne matche plus | 400 lien invalide, **aucune** écriture, **aucun** event |
| Audit KO | insert `consent_events` lève | ré-abonnement quand même acté, `reportError`, page succès |

</frozen-after-approval>

## Code Map

- `supabase/migrations/0048_consent_events.sql` (nouveau) -- `create table if not exists consent_events (id uuid pk default gen_random_uuid(), business_id uuid not null references businesses(id) on delete cascade, card_id uuid references loyalty_cards(id) on delete set null, email text not null, type text not null, source text, meta jsonb, created_at timestamptz not null default now())` + index `(business_id, email, created_at)` + `enable row level security` (aucune policy → service_role seul). Idempotent. Calqué sur `0043_prospection.sql:60-70`. **À appliquer manuellement en prod.**
- `lib/resubscribe.ts` -- `signResubToken(businessId, email, exp, unsubAt)` : signer `${PURPOSE}:${businessId}:${email.toLowerCase()}:${unsubAt}:${exp}` ; `verifyResubToken(businessId, email, exp, unsubAt, token, nowMs?)` (re-dérive avec `unsubAt`) ; `buildResubConfirmUrl(businessId, email, unsubAt, ttlMs?)`. `unsubAt` normalisé `String(unsubAt ?? "")`.
- `app/api/loyalty/resubscribe/route.ts` -- passer `card.unsubscribed_at` à `buildResubConfirmUrl` (l.57) ; corriger le texte « valable 7 jours » → « 48 heures » (l.81, TTL réel).
- `app/api/loyalty/resubscribe/confirm/route.ts` -- GET **et** POST : après un pré-contrôle structurel (b/email/t présents, `exp>now`), **lire** `loyalty_cards.select("unsubscribed_at").eq(business_id).eq(email).maybeSingle()` pour re-dériver `unsubAt`, puis `verifyResubToken(...,unsubAt,...)` ; POST : après update `changed>0` → insérer `consent_events {type:"resubscribe_confirmed", source:"confirm_route", business_id:b, email, card_id?}` (best-effort try/catch + reportError). Sémantique GET/POST inchangée.
- `app/api/unsubscribe/route.ts` -- après l'update `loyalty_cards` (token valide), insérer `consent_events {type:"unsubscribed", source:"unsubscribe_route"}` (best-effort). Ne pas toucher au flux leads.
- `tests/resubscribe.test.ts` -- ajouter `unsubAt` à tous les `signResubToken` ; nouveau cas « unsubAt différent → false » (usage unique).
- `tests/resubscribe-route.test.ts` -- `cardData` porte `unsubscribed_at` ; `goodToken` signe avec ce même `unsubAt` ; le mock `loyalty_cards.maybeSingle` le renvoie (pré-lecture) ; ajouter capture `insertCalls` → assert `consent_events` inséré à la confirmation ; cas rejeu (unsubAt ≠) → 400 sans update ni event.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/0048_consent_events.sql` -- table append-only + index + RLS (signaler application manuelle)
- [ ] `lib/resubscribe.ts` -- lier la signature à `unsubAt` (sign/verify/build)
- [ ] `app/api/loyalty/resubscribe/route.ts` -- passer `unsubAt` + corriger le texte TTL
- [ ] `app/api/loyalty/resubscribe/confirm/route.ts` -- re-lecture carte + vérif liée + insert `consent_events` (best-effort)
- [ ] `app/api/unsubscribe/route.ts` -- insert `consent_events` (unsubscribed, best-effort, périmètre fidélité)
- [ ] `tests/resubscribe.test.ts` + `tests/resubscribe-route.test.ts` -- usage unique + audit

**Acceptance Criteria:**
- Given un client désinscrit qui confirme son ré-abonnement, when le POST réussit, then `marketing_ok=true`/`unsubscribed_at=null` **et** un `consent_events` `resubscribe_confirmed` horodaté est enregistré.
- Given un lien déjà utilisé (client re-abonné), when il est rejoué, then la vérification échoue (usage unique) : 400, aucune écriture, aucun event.
- Given une désinscription fidélité via le lien, when le token est valide, then `unsubscribed_at` est posé **et** un `consent_events` `unsubscribed` est enregistré.
- Given l'écriture d'audit échoue, when un ré-abonnement/désinscription a lieu, then le flux réussit quand même (best-effort) et l'erreur part à `reportError`.

## Design Notes

- **Usage unique par liaison d'état :** inclure `unsubscribed_at` courant dans la signature suffit — pas de table de nonces. Dès que l'état change (ré-abonnement → null, ou nouvelle désinscription → autre timestamp), l'ancien token ne re-dérive plus la même signature. En défense de profondeur du filtre `.not("unsubscribed_at","is",null)` déjà présent.
- **`unsubAt` identique des deux côtés :** demande et confirmation lisent la **même** colonne `loyalty_cards.unsubscribed_at` → même chaîne signée. Normaliser `String(unsubAt ?? "")`.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: 0 erreur
- `npm run lint` -- expected: 0 warning
- `npm test` -- expected: tous verts (dont resubscribe + resubscribe-route)
- `npm run build` -- expected: succès

**Manual checks:**
- Désinscrit → demande → e-mail (texte « 48 heures ») → page confirmation → clic → ré-abonné + ligne `consent_events`. Recliquer le lien → « lien invalide » (usage unique), aucun nouvel event. Désinscription via lien → `consent_events` unsubscribed.
