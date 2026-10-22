---
title: "Un seul essai par personne, même sans cookie ni empreinte (e-mail vérifié)"
status: ready-for-dev
---

# Un seul essai par personne, même sans cookie ni empreinte

**Agent :** codex  
**Niveau :** complexe  
**Priorité :** haute

## Objectif

Décision du fondateur : chaque personne n'a qu'un seul essai, même si elle refuse cookie et empreinte, **sans jamais bloquer les autres clients** (wifi partagé du commerce). Une IP ne permet pas d'identifier une personne : on retire donc le plafond par IP de 13-10 et on demande à ceux qui refusent l'empreinte un **e-mail vérifié par code**, qui sert uniquement d'anti-rejeu. Ceux qui acceptent gardent le parcours actuel sans friction.

## À faire

1. **Retirer** de `app/api/play/route.ts` le plafond `play-nofp` et la constante `NO_FINGERPRINT_DAILY_LIMIT` ; retirer le message 429 « limite de participations » de `Game.tsx` s'il n'a plus de cas d'usage (garder le 429 générique existant) ; adapter `tests/play-route.test.ts`.
2. **Migration** (nouveau fichier `supabase/migrations/<horodatage>_play_email_hash.sql`) : colonne `plays.email_hash text` (nullable) + index unique partiel `(business_id, email_hash, play_type) where email_hash is not null` ; table `play_email_challenges` (id, business_id, email_hash, code_hash, expires_at, attempts, verified_at) avec RLS activé et accès `service_role` uniquement. Étendre `record_play_with_daily_prize_limit` pour accepter `p_email_hash` (violation d'unicité → `already_played`, comme aujourd'hui).
3. **Routes** : `POST /api/play-email/send` (envoie un code à 6 chiffres via `lib/email.ts`, expire en 10 min, limité à 3 envois/heure par e-mail et par commerce) et `POST /api/play-email/verify` (5 essais max, renvoie un jeton signé court, lié au commerce et à l'e-mail haché).
4. **`/api/play`** : si `deviceHash` est nul et que le commerce n'est pas une démo, exiger le jeton vérifié, sinon répondre `{ error: "email_required" }` (409). Calculer `email_hash` avec `hashRateLimitKey` après normalisation (minuscules, retrait de `+tag`, points ignorés pour gmail.com/googlemail.com), le passer à l'enregistrement. Si déjà joué avec cet e-mail : même réponse `alreadyPlayed` que le cookie (rend le lot déjà obtenu).
5. **`app/[slug]/Game.tsx`** : sur `email_required`, afficher une étape claire (e-mail, puis code), texte en français : « Pour garantir un seul essai par personne, saisissez votre e-mail. Il n'est pas utilisé pour vous envoyer de publicité. » Après vérification, relancer le tour. Cette étape n'apparaît jamais pour ceux qui ont accepté l'empreinte ni pour les démos.
6. L'e-mail n'est jamais stocké en clair pour cet usage (hash HMAC uniquement), jamais ajouté aux contacts marketing ; ajouter une phrase dans `app/legal/confidentialite/page.tsx`.

## Critères vérifiables

- [ ] Test : sans empreinte, `/api/play` répond `email_required` sans jeton vérifié.
- [ ] Test : avec jeton vérifié, 1er tour OK, 2e tour avec le même e-mail (y compris variante `+tag` ou points gmail) → `alreadyPlayed`.
- [ ] Test : deux e-mails différents depuis la même IP jouent tous les deux (aucun blocage par IP).
- [ ] Test : avec empreinte consentie et démo, aucun e-mail demandé.
- [ ] Test : code faux 5 fois → bloqué ; code expiré refusé.
- [ ] `bash scripts/relais/verifier.sh` OK.

## Fichiers

`app/api/play/route.ts`, `app/api/play-email/send/route.ts`, `app/api/play-email/verify/route.ts`, `app/[slug]/Game.tsx`, `lib/email.ts` (modèle du message), `supabase/migrations/`, `app/legal/confidentialite/page.tsx`, `tests/`

## Ne pas toucher

Parcours avec empreinte consentie, `lib/fingerprint-consent.ts`, liste de contacts marketing (`leads`), paiements.

## Reprise

- Fait : décision et cadrage (13-10 posé un plafond par IP, à retirer ici).
- Reste : tout.
- Prochaine commande : `scripts/relais/codex-session.sh lancer 13-11-un-essai-par-email-verifie`
