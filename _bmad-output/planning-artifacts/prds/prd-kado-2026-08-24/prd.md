---
title: "Attribution boucle produit ↔ parrainage commerçant — Kado"
status: final
created: 2026-08-24
updated: 2026-08-24
---

# PRD — Attribution boucle produit ↔ parrainage commerçant

## 1. Résumé & Vision

Kado affiche déjà, sur l'écran de fin de la roue, un CTA « Vous êtes commerçant ?
Offrez ça à vos clients » qui renvoie vers `/tarifs`. Mais l'information de **quel
commerce a amené ce prospect** est perdue en route : impossible de récompenser le
commerce hôte, donc rien ne l'incite à mettre Kado en avant.

**Vision.** Fermer la boucle : attribuer chaque inscription issue d'une roue au
**commerce hôte**, et le récompenser automatiquement, en réutilisant le **parrainage
commerçant déjà construit** dans Kado. Chaque commerçant satisfait devient alors un
canal d'acquisition — une réaction en chaîne, à budget publicitaire nul.

**Un seul résultat compte :** *un commerce hôte reçoit une récompense vérifiable
quand un nouveau commerçant s'inscrit et paie depuis sa roue.*

## 2. Objectifs & Métriques de succès

**⭐ North-star.** Nombre de nouvelles inscriptions **payantes attribuées à la boucle
produit**, par mois.

**Métriques de soutien.**
- Taux de clic du CTA de la roue (clics / vues de l'écran de fin).
- Taux de conversion clic → inscription attribuée.
- % d'inscriptions arrivant avec un parrain valide.
- Nombre de mois offerts effectivement accordés aux hôtes.

**Contre-métriques (garde-fous).**
- Tentatives d'auto-parrainage / attributions refusées pour identité partagée.
- Taux de complétion du jeu (avis + follows) : le CTA ne doit pas le faire baisser.
- Hôtes qui masquent/ignorent l'encart de parrainage (signal de gêne).

## 3. Acteurs

- **Commerce hôte (parrain)** — client Kado existant dont la roue expose le CTA et
  qui partage son lien/QR de parrainage. C'est lui qu'on récompense.
- **Commerçant prospect (filleul)** — joue à une roue, découvre Kado, s'inscrit.
- **Opérateur Kado (admin)** — supervise les attributions et la lutte anti-fraude.

## 4. Parcours utilisateur

**UJ-1 — L'hôte promeut Kado.** Depuis son espace `/dashboard`, le commerce hôte voit
un encart « Parrainez un commerçant → 1 mois offert », avec son lien et son QR de
parrainage, plus son suivi (« 2 filleuls · 1 mois gagné »). Il partage le lien à un
confrère, ou laisse simplement le CTA de sa roue travailler.

**UJ-2 — Le filleul s'inscrit, l'hôte est récompensé.** Un commerçant prospect clique
le CTA (ou le lien de l'hôte), arrive sur `/tarifs?parrain=<slug-hôte>`, choisit une
formule et s'inscrit. L'attribution est capturée et portée jusqu'à la création du
compte. À son **premier paiement confirmé**, le commerce hôte reçoit **1 mois offert**,
et son suivi se met à jour.

## 5. Périmètre

**Dans la v1.** Capture et portage de l'attribution ; branchement sur le parrainage
commerçant existant ; encart hôte (lien + QR + suivi) dans le dashboard ; garde-fous
anti-fraude stricts ; correction du canal `?parrain=` (vs `?ref=` affilié).

**Hors v1.** Récompense en cash ; choix de récompense par l'hôte ; plafond de mois par
parrain ; parcours Instagram ; classement/gamification des parrains.

## 6. Exigences fonctionnelles

### 6.1 Attribution (capture & portage)
- **FR1.** Le CTA de fin de roue pointe vers `/tarifs?parrain=<slug-hôte>`. *(livré ;
  `?ref=` était réservé aux affiliés — corrigé en `?parrain=`.)*
- **FR2.** À l'arrivée sur une page publique avec `?parrain=<slug>`, le système pose un
  cookie `kado-parrain=<slug>` d'une durée de **30 jours**. `[HYPOTHÈSE]` même mécanique
  que le cookie affilié `kado-aff` existant.
- **FR3.** Un `?parrain=` déjà présent n'est **pas écrasé** par une visite ultérieure
  sans paramètre (premier parrain gagnant). `[HYPOTHÈSE]`
- **FR4.** À la création du compte (onboarding), le slug du cookie `kado-parrain` est
  transmis au champ `parrain` déjà géré par `app/api/onboarding/route.ts`, qui remplit
  `businesses.referred_by`. Aucun changement du remplissage de `referred_by`.
- **FR5.** Les canaux **parrainage** (`kado-parrain`) et **affilié** (`kado-aff`)
  restent indépendants et ne se télescopent pas.

### 6.2 Récompense
- **FR6.** À la première souscription payante confirmée du filleul, le parrain reçoit
  **1 mois offert** — comportement **déjà implémenté** dans le webhook Stripe
  (`app/api/billing/webhook/route.ts`), inchangé pour le cœur.
- **FR7.** La récompense n'est accordée qu'**une fois par filleul** (garde `referral_rewarded_at`, existant).
- **FR8.** Si le premier paiement du filleul est **remboursé ou contesté sous 14 jours**,
  la récompense est **reprise** (coupon non consommé annulé) et l'état d'attribution
  marqué en conséquence. `[HYPOTHÈSE]` nouveau garde-fou à ajouter au webhook.

### 6.3 Espace hôte (dashboard)
- **FR9.** `/dashboard` affiche un encart « Parrainez un commerçant → 1 mois offert »
  présentant le **lien de parrainage** (`/tarifs?parrain=<slug>`) et son **QR**
  (réutiliser la génération QR existante, lib `qrcode`).
- **FR10.** L'encart affiche un **suivi** : nombre de filleuls attribués, et nombre de
  mois offerts accordés au parrain.
- **FR11.** Le texte de l'encart explique clairement la condition (récompense au 1er
  paiement du filleul).

### 6.4 Anti-fraude
- **FR12.** L'attribution/récompense est **refusée** si parrain et filleul partagent le
  **même e-mail**, le **même téléphone**, ou la **même carte / le même client Stripe**.
- **FR13.** Un commerce ne peut pas être son propre parrain (`parrain != filleul`, existant).
- **FR14.** Toute attribution refusée pour cause de fraude est **journalisée** pour revue admin. `[HYPOTHÈSE]`

## 7. Exigences non-fonctionnelles
- **NFR1. Réutilisation.** S'appuyer sur l'existant (`referred_by`, webhook de
  récompense, onboarding `parrain`, cookie affilié comme modèle, lib QR) ; ne pas
  dupliquer de mécanique de parrainage.
- **NFR2. RGPD / cookies.** Le cookie `kado-parrain` est fonctionnel (attribution) et
  non nominatif ; cohérent avec le traitement du cookie affilié existant.
- **NFR3. Robustesse.** Le portage de l'attribution ne doit jamais bloquer une
  inscription : en cas d'absence/erreur de parrain, l'inscription se poursuit normalement.
- **NFR4. Langue.** Toute l'UX en français, cohérente avec le reste de Kado.
- **NFR5. Observabilité.** L'admin peut voir les attributions et les récompenses
  accordées/refusées.

## 8. Cartographie de l'existant (réutilisation)
- `app/[slug]/Game.tsx` — CTA de fin de roue (livré, `?parrain=`).
- `app/api/onboarding/route.ts` — remplit `businesses.referred_by` depuis `parrain`.
- `app/api/billing/webhook/route.ts` — accorde le mois offert au 1er paiement.
- `supabase/migrations/0011_growth.sql` — `businesses.referred_by`, `referral_rewarded_at`.
- Système affilié (`kado-aff`, `/vendeur`, `lib/affiliates.ts`) — modèle de cookie, à NE PAS mélanger.

## 9. Décisions de cadrage & hypothèses techniques

**Décisions (tranchées).**
- **Attribution silencieuse côté filleul en v1** : le prospect ne voit pas qui l'a
  parrainé pendant son inscription. La transparence (« Recommandé par… ») est reportée.
- **« Recommandé par [Nom] » sur `/tarifs` → v1.1**, hors périmètre v1.

**Hypothèses techniques (à confirmer à l'architecture).**
- `[HYPOTHÈSE]` Le cookie `kado-parrain` est posé au niveau public (middleware/layout),
  comme `kado-aff`.
- `[HYPOTHÈSE]` La reprise de récompense sur remboursement (FR8) s'appuie sur les events
  Stripe `charge.refunded` / `charge.dispute.created`.

## 10. Prochaines étapes
`bmad-architecture` (spine technique : pose du cookie, events Stripe, journalisation
fraude) puis `bmad-create-epics-and-stories` pour découper l'implémentation.
