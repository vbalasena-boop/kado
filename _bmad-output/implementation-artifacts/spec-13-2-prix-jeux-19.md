---
title: "Formule Jeux (roue) : 29 € → 19 €/mois"
status: ready-for-dev
---

# Formule Jeux (roue) : 29 € → 19 €/mois

**Agent :** codex  
**Niveau :** moyen  
**Priorité :** normale

## Objectif

Décision du fondateur (20/10/2026) : baisser Jeux de 29 à 19 €/mois. Fidélité reste 19, Complet 44, Comptoir 19 (Complet reste avantageux : 57 € si pris séparément). Affichage uniquement ; le vrai prix Stripe (`STRIPE_PRICE_ROUE`) est créé par Claude à part, ne pas toucher aux variables d'env ni à `app/api/billing/*`.

## Critères vérifiables

- [ ] Tous les « 29 € » de la formule Jeux deviennent « 19 € » (textes, `price: "29"`, métadonnées SEO, FAQ, CGV, e-mail cron, libellés admin/facturation).
- [ ] Ne PAS toucher : « 129 € » (installation), commissions vendeur (`app/vendeur/page.tsx` : montants à droite des flèches), couleurs `#150c29`/`29` CSS.
- [ ] `grep -rnE "Jeux[^.]{0,20}29" app lib tests` ne renvoie plus rien ; tests qui citent 29 mis à jour.
- [ ] `bash scripts/relais/verifier.sh` OK.

## Fichiers

`app/tarifs/page.tsx` (l.20, 57), `app/page.tsx` (l.85, 148), `app/dashboard/Onboarding.tsx` (l.11), `app/dashboard/billing/BillingClient.tsx` (l.10, 58), `app/admin/AdminClient.tsx` (l.32, 281), `app/vendeur/page.tsx` (l.62, libellé seulement), `app/legal/cgv/page.tsx` (l.79), `app/api/cron/daily/route.ts` (l.168, texte e-mail seulement).

## Reprise

Fait : rien. Reste : tout.
