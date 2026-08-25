# Epic 10 Context: Re-consentement fidélité (double opt-in)

<!-- Compiled from planning artifacts + code recon. Edit freely. -->

## Goal

Permettre à un client fidélité **désinscrit** (`unsubscribed_at` renseigné sur sa carte)
de se **ré-abonner proprement** aux offres, via un **double opt-in RGPD** : une demande
envoie un e-mail de confirmation avec **lien signé**, et le consentement (`marketing_ok`)
n'est rétabli **qu'à la confirmation** du lien. Objectif : conformité RGPD (preuve de
consentement explicite) et combler le TODO existant (`app/api/loyalty/extra/route.ts:60-66`
met `marketing_ok` mais n'efface **volontairement pas** `unsubscribed_at`, en attendant ce
double opt-in).

## Stories

- Story 10.1: Demander une confirmation de ré-abonnement (envoi de l'e-mail + lien signé ;
  `marketing_ok` NON réactivé).
- Story 10.2: Confirmer le ré-abonnement via le lien (token valide/non expiré → efface
  `unsubscribed_at` + `marketing_ok=true` ; idempotent ; token invalide/expiré refusé).

## Requirements & Constraints

- Le consentement n'est **jamais** rétabli à la demande (10.1) ; **uniquement** à la
  confirmation via le lien (10.2). RGPD : consentement explicite et traçable.
- La carte fidélité est identifiée par **(business_id, email)** ; un `code` imprimé sert de
  preuve de possession dans certains flux (cf. loyalty/extra). Pour 10.1, la demande de
  ré-abonnement ne doit **pas divulguer** si l'e-mail existe (réponse neutre).
- Ne pas modifier les flux d'unsub existants (`app/api/unsubscribe`, prospection).
- Idempotence en 10.2 (double clic sans effet de bord).
- Lectures/écritures **tolérantes** ; un échec d'e-mail ne casse jamais l'appelant.

## Technical Decisions

- **Consentement** sur `loyalty_cards` : `marketing_ok boolean not null default false`,
  `unsubscribed_at timestamptz` (migrations 0011/0003). Colonnes **déjà présentes** — pas de
  migration nouvelle attendue pour l'epic.
- **Token dédié** « re-consent » : signer `purpose:business_id:email:expiry` en
  **HMAC-SHA256** (secret `PLAYER_COOKIE_SECRET`, repli `SUPABASE_SERVICE_ROLE_KEY`),
  vérifier en `timingSafeEqual` avec contrôle d'expiration et de purpose (modèle
  `lib/prospection/unsub.ts`). Logique **pure et testable** dans un module (ex.
  `lib/resubscribe.ts`). NE PAS réutiliser `lib/unsub.ts` (pas d'expiry/purpose).
- **E-mail** : `sendEmail` + `emailLayout` (`lib/email.ts`) ; route transactionnelle à
  copier : `app/api/prize-email/route.ts` (POST, `publicRoute`+zod, `rateLimit`, `clientIp`).
  Construction du lien signé : cf. `lib/campaigns.ts:59-62`.
- **Routes** : wrapper `lib/api.ts` `publicRoute`. Validation e-mail : `isValidEmail`
  (`lib/optin.ts`).
- **Tests** : vitest (logique pure du token : round-trip, mauvais e-mail, expiré, purpose).

## Cross-Story Dependencies

- 10.2 **dépend** de 10.1 : elle vérifie le token émis en 10.1 et effectue la mise à jour de
  consentement. Le module `lib/resubscribe.ts` (signature/vérif) est partagé.
- Une UI de demande (bouton « me ré-abonner » sur la page fidélité `app/[slug]/fidelite`)
  peut être ajoutée en 10.1 (minimal) ou dans une story dédiée — la page ne distingue pas
  aujourd'hui « jamais opt-in » de « désinscrit » (`app/api/loyalty/card` ne renvoie pas
  `unsubscribed_at`).
