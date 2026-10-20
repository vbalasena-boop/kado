---
title: "Formule Jeux (roue) : 29 € → 19 €/mois"
status: review
---

# Formule Jeux (roue) : 29 € → 19 €/mois

**Agent :** codex  
**Niveau :** moyen  
**Priorité :** normale

## Objectif

Décision du fondateur (20/10/2026) : baisser Jeux de 29 à 19 €/mois. Fidélité reste 19, Complet 44, Comptoir 19 (Complet reste avantageux : 57 € si pris séparément). Affichage uniquement ; le vrai prix Stripe (`STRIPE_PRICE_ROUE`) est créé par Claude à part, ne pas toucher aux variables d'env ni à `app/api/billing/*`.

## Critères vérifiables

- [x] Tous les « 29 € » de la formule Jeux deviennent « 19 € » (textes, `price: "29"`, métadonnées SEO, FAQ, CGV, e-mail cron, libellés admin/facturation).
- [x] Commission vendeur Jeux : 30 € → 20 € (≈ 1er mois, comme Fidélité). `lib/affiliates.ts` `DEFAULT_COMMISSIONS.roue = 2000`, `tests/affiliates.test.ts` l.98, `app/vendeur/page.tsx` l.62 (« Jeux (19 €/mois) → 20 € »). Fidélité 20 € et Complet 45 € inchangés. Ne pas modifier les taux déjà enregistrés en base.
- [x] Ne PAS toucher : « 129 € » (installation), couleurs `#150c29`/`29` CSS.
- [x] `grep -rnE "Jeux[^.]{0,20}29" app lib tests` ne renvoie plus rien ; tests qui citent 29 mis à jour.
- [x] `bash scripts/relais/verifier.sh` OK.

## Fichiers

`app/tarifs/page.tsx` (l.20, 57), `app/page.tsx` (l.85, 148), `app/dashboard/Onboarding.tsx` (l.11), `app/dashboard/billing/BillingClient.tsx` (l.10, 58), `app/admin/AdminClient.tsx` (l.32, 281), `app/vendeur/page.tsx` (l.62), `lib/affiliates.ts`, `tests/affiliates.test.ts`, `app/legal/cgv/page.tsx` (l.79), `app/api/cron/daily/route.ts` (l.168, texte e-mail seulement).

## Reprise

Fait : prix Jeux et commission vendeur mis à jour dans les pages, libellés, e-mails, tableaux admin, vitrine pro et calcul MRR ; 11 tests ciblés et vérificateur complet OK.
Reste : E2E et création du prix Stripe par Claude ; aucun taux existant en base modifié.
Prochaine commande : lancer les E2E, puis revoir le diff avant validation.
