# Epic — Attribution boucle produit ↔ parrainage commerçant

Réf. : PRD `prds/prd-kado-2026-08-24/prd.md` · Spine `ARCHITECTURE-SPINE.md`.
Feature de câblage brownfield : brancher l'attribution sur le parrainage commerçant
existant. Ordre conseillé : S1 → S2 → S5 → S3 → S4.

## S1 — Capture d'attribution (cookie `kado-parrain`)
**En tant que** commerce hôte, **je veux** que le clic d'un prospect sur ma roue soit
mémorisé, **afin que** l'inscription me soit attribuée. — *AD-2, FR1-4*
- Composant client calqué sur `components/RefCapture.tsx` : lit `?parrain=<slug>`,
  pose cookie `kado-parrain` (max-age 30 j, path `/`, SameSite lax), **first-wins**.
- Monté sur les pages publiques concernées (au moins `/tarifs`).
- `app/api/onboarding/route.ts` : résout le parrain depuis `body.parrain` **ou** le
  cookie `kado-parrain`, puis remplit `referred_by` (mécanique existante inchangée).
- **Acceptation :** un compte créé après clic CTA a `referred_by = hôte` ; sans clic,
  `referred_by` reste vide ; l'inscription n'échoue jamais si le parrain est absent/invalide.

## S2 — Garde-fous anti-fraude à la liaison
**En tant qu'** opérateur, **je veux** refuser les auto-parrainages déguisés. — *AD-5, FR12-14*
- À la liaison (onboarding), refuser l'attribution si parrain et filleul partagent
  e-mail, téléphone, **ou** client/carte Stripe.
- Conserver le blocage existant `parrain != filleul`.
- Journaliser chaque refus (voir S5).
- **Acceptation :** un 2ᵉ compte partageant un identifiant du parrain n'obtient pas
  `referred_by` ; un refus crée une ligne de journal.

## S3 — Récompense : grant confirmé + reprise
**En tant que** commerce hôte, **je veux** mon mois offert quand mon filleul paie, et
**en tant qu'** opérateur ne pas l'accorder sur un paiement annulé. — *AD-4, FR6-8*
- Grant au 1er paiement confirmé : **existant**, ajouter un **re-check anti-fraude** avant grant.
- **Reprise** : sur `charge.refunded` / `charge.dispute.created` < 14 j du grant →
  annuler le coupon Stripe non consommé et remettre l'attribution en état « non récompensé ».
- **Acceptation :** refund sous 14 j ⇒ coupon annulé + état repris ; au-delà ⇒ inchangé ;
  jamais de double grant.

## S4 — Encart parrainage dans le dashboard
**En tant que** commerce hôte, **je veux** mon lien/QR de parrainage et mon suivi. — *AD-6, FR9-11*
- Encart `/dashboard` : lien `/tarifs?parrain=<slug>`, QR (lib `qrcode`), texte de condition.
- Suivi **dérivé en lecture** : nb de filleuls (`referred_by = moi`), mois gagnés
  (`referral_rewarded_at` non nul parmi eux).
- **Acceptation :** l'encart affiche le bon lien/QR et des compteurs cohérents avec la base.

## S5 — Migration `referral_blocks` (journal des refus)
**En tant qu'** opérateur, **je veux** tracer les refus de fraude. — *AD-5, FR14*
- Table légère : `{ id, filleul_business_id, parrain_slug, raison, created_at }`, RLS serveur.
- **Acceptation :** un refus de S2 insère une ligne lisible par l'admin.

## Hors périmètre (rappel)
Récompense cash, choix de récompense, plafond par parrain, « Recommandé par [Nom] »
sur `/tarifs`, canal Instagram.
