---
stepsCompleted: [step-01, step-02]
inputDocuments:
  - docs/prd.md
  - docs/architecture.md
---

# Kado - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Kado, decomposing the
requirements from the PRD (v2.1) and Architecture into implementable stories. **Contexte
brownfield** : le produit est déjà en production ; les epics distinguent la **ratification
de l'existant** (FR ✅ Livré) du **prochain incrément** (FR 🔧 À modifier / 🔶 À faire).

## Requirements Inventory

### Functional Requirements

**Domaine A — Jeux & acquisition**
- FR1 ✅ Page de jeu publique `/{slug}` (lien/QR)
- FR2 🔧 2 tours débloqués par actions NON-avis (Instagram, fidélité, opt-in) ou par le jeu — jamais contre un avis
- FR3 🔧 Avis Google = CTA optionnel NON récompensé, présenté à tous au neutre (pas de gating)
- FR4 ✅ Tirage du lot côté serveur (pondéré)
- FR5 ✅ Verrou serveur des 2 tours (cookie signé + contrainte unique)
- FR6 ✅ Choix du type de jeu (roue / gratter / slot)
- FR7 ✅ Configuration apparence (couleurs, logo, fond, décor)
- FR8 ✅ Gestion des lots (libellé, emoji, probabilité, perdant)
- FR9 ✅ Code cadeau + durée de validité paramétrable
- FR10 ✅ Validation/échange du code en caisse (anti-double-validation)
- FR11 ✅ Plafond de cadeaux par jour
- FR12 ✅ Mention de conformité + règlement de jeu
- FR13 ✅ Alerte push au commerçant à chaque cadeau gagné
- FR14 🔶 Action déclenchante de chaque tour configurable par le commerçant

**Domaine B — Fidélité**
- FR15 ✅ Carte de fidélité à tampons par e-mail
- FR16 ✅ Validation de tampon + récompense à l'objectif
- FR17 ✅ Parrainage (tampon au 1er passage du filleul)
- FR18 ✅ Anniversaire (e-mail cadeau 1×/an)
- FR19 ✅ Consentement marketing + désinscription respectée
- FR20 🔶 Re-consentement via double opt-in

**Domaine C — Click & collect**
- FR21 ✅ Catalogue produits
- FR22 ✅ Commande + total recalculé serveur (anti-fraude)
- FR23 ✅ Code de retrait + e-mails/push
- FR24 ✅ Horaires de commande
- FR25 ✅ Paiement en ligne via Stripe Connect (optionnel)
- FR26 ✅ Statuts de commande
- FR27 🔶 Remboursement / annulation / litige
- FR28 ✅ Modes sur place / à emporter (+ table)

**Domaine D — Comptoir**
- FR29 ✅ Numéro de suivi (bipeur digital)
- FR30 ✅ Notification « commande prête »

**Domaine E — Campagnes & rétention**
- FR31 ✅ Campagnes e-mail/push (programmation + envoi étalé)
- FR32 ✅ Tirage au sort périodique
- FR33 ✅ Récap hebdomadaire
- FR34 ✅ Relance de fin d'essai (J-3)
- FR35 ✅ Collecte d'e-mails opt-in (leads)

**Domaine F — Affiliation vendeurs**
- FR36 ✅ Candidature vendeur self-service (validation admin)
- FR37 ✅ Connexion vendeur + stats via URL secrète
- FR38 ✅ Commission (barème 3 tiers, pas de comptoir)
- FR39 ✅ Record au 1er paiement, exigibilité au 2ᵉ prélèvement
- FR40 ✅ Marquage commissions + notif admin & vendeur

**Domaine G — Espaces & administration**
- FR41 ✅ Authentification commerçant (OTP)
- FR42 ✅ Multi-établissements
- FR43 ✅ Tableau de bord (stats, QR, onboarding)
- FR44 ✅ Admin : créer un compte
- FR45 ✅ Admin : activer / suspendre
- FR46 ✅ Admin : éditer plan/options/note/remboursement
- FR47 ✅ Isolation multi-tenant

**Domaine H — Monétisation**
- FR48 ✅ 4 formules d'abonnement
- FR49 ✅ Essai gratuit 14 j
- FR50 ✅ Stripe self-service (checkout, portail, options)
- FR51 ✅ Webhook Stripe (signature vérifiée)
- FR52 ✅ Parrainage commerçant (1 mois offert)

**Domaine I — Vitrine & marketing**
- FR53 ✅ Blog SEO
- FR54 ✅ Pages vitrine (accueil, tarifs, témoignages)

### NonFunctional Requirements

- NFR1 Mobile-first, page `/{slug}` rapide (cache), sans app
- NFR2 Isolation multi-tenant : RLS default-deny + policies SELECT + filtre `business_id` (service_role)
- NFR3 Sécurité : secret cron, signature webhook, en-têtes, uploads whitelistés, rate-limit fail-closed
- NFR4 Paiements : Stripe + Stripe Connect
- NFR5 Fiabilité : e-mail/push best-effort, cron idempotent/parallélisé, Sentry + health-check
- NFR6 Coût maîtrisé (Vercel + Supabase + Resend)
- NFR7 Accessibilité de base (contraste, focus, reduced-motion)

### Additional Requirements

_Depuis `docs/architecture.md` (brownfield — pas de starter template : l'app Next.js 14 existe déjà) :_
- Stack imposée : Next.js 14 App Router, Supabase (Auth/Postgres/Storage), Stripe, web-push, Resend, Sentry, Vercel.
- Wrapper de route `lib/api.ts` (publicRoute/merchantRoute/adminRoute) : toute nouvelle route l'utilise.
- Accès données via `service_role` + filtre `business_id` explicite ; policies RLS SELECT posées (migration 0044).
- Migrations SQL versionnées via CLI Supabase (`supabase db push`), numérotation séquentielle, idempotentes.
- Cron Vercel quotidien (protégé par `CRON_SECRET`) : relances, anniversaires, campagnes, récap, tirage.
- Cache de la page `/{slug}` via `unstable_cache` + invalidation par tag à l'édition.
- Tests : vitest (34) ; cibles sensibles = webhook Stripe, anti-fraude, wrapper.

### UX Design Requirements

_Aucun document UX BMAD (`bmad-ux`) présent. Les évolutions à forte composante UI (chantier option A sur `Game.tsx`) pourront faire l'objet d'un passage `bmad-ux` dédié avant implémentation._

### FR Coverage Map

**Socle (existant, ratifié)**
- FR1,4,5,6,7,8,9,10,11,12,13 → Epic 1 (Jeux)
- FR15,16,17,18,19 → Epic 2 (Fidélité)
- FR21,22,23,24,25,26,28 → Epic 3 (Click & collect) · FR29,30 → Epic 3 (Comptoir)
- FR31,32,33,34,35 → Epic 4 (Campagnes & rétention)
- FR36,37,38,39,40 → Epic 5 (Affiliation vendeurs)
- FR41,42,43,44,45,46,47 → Epic 6 (Espaces & administration)
- FR48,49,50,51,52 → Epic 7 (Monétisation)
- FR53,54 → Epic 8 (Vitrine & marketing)

**Prochain incrément (à construire)**
- FR2,FR3,FR14 → Epic 9 (Conformité avis & actions déclenchantes du jeu)
- FR20 → Epic 10 (Re-consentement fidélité — double opt-in)
- FR27 → Epic 11 (Commandes — remboursements & litiges)

## Epic List

> **Epics 1-8 = SOCLE** : ratifient le produit existant (FR ✅ Livré). Documentent la
> valeur déjà en place ; stories = validation/acceptation légère, pas de dev neuf.
> **Epics 9-11 = INCRÉMENT** : le vrai travail à construire (FR 🔧/🔶). Stories détaillées.

### Epic 1 · [Socle] Jeux & acquisition
Le client scanne un QR et joue jusqu'à 2 tours (actions non-avis) pour gagner un cadeau à retirer en caisse ; le commerçant configure jeu, apparence et lots. **Statut : ✅ Livré.**
**FRs covered:** FR1, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13

### Epic 2 · [Socle] Fidélité
Le client cumule des tampons par e-mail et débloque des récompenses ; parrainage, anniversaire, consentement marketing. **Statut : ✅ Livré.**
**FRs covered:** FR15, FR16, FR17, FR18, FR19

### Epic 3 · [Socle] Commandes (click & collect + comptoir)
Le client commande en ligne (paiement sur place ou Stripe Connect), reçoit un code de retrait et un suivi ; bipeur digital au comptoir. **Statut : ✅ Livré.**
**FRs covered:** FR21, FR22, FR23, FR24, FR25, FR26, FR28, FR29, FR30

### Epic 4 · [Socle] Campagnes & rétention
Le commerçant envoie des campagnes e-mail/push, organise un tirage au sort, reçoit récap et relances ; collecte d'e-mails opt-in. **Statut : ✅ Livré.**
**FRs covered:** FR31, FR32, FR33, FR34, FR35

### Epic 5 · [Socle] Affiliation vendeurs
Un vendeur candidate, est validé, apporte des commerces et suit ses commissions. **Statut : ✅ Livré.**
**FRs covered:** FR36, FR37, FR38, FR39, FR40

### Epic 6 · [Socle] Espaces & administration
Authentification commerçant, multi-établissements, tableau de bord ; l'admin crée/suspend/édite les comptes ; isolation tenant. **Statut : ✅ Livré.**
**FRs covered:** FR41, FR42, FR43, FR44, FR45, FR46, FR47

### Epic 7 · [Socle] Monétisation
Abonnement Stripe self-service (4 formules, essai 14 j), options, webhook, parrainage commerçant. **Statut : ✅ Livré.**
**FRs covered:** FR48, FR49, FR50, FR51, FR52

### Epic 8 · [Socle] Vitrine & marketing
Blog SEO et pages vitrine (accueil, tarifs, témoignages) qui alimentent l'acquisition. **Statut : ✅ Livré.**
**FRs covered:** FR53, FR54

### Epic 9 · [Incrément] Conformité avis & actions déclenchantes du jeu 🎯 PRIORITÉ
Découpler la récompense du jeu de l'avis Google (option A) et rendre l'action déclenchante configurable : les tours se débloquent par des actions non-avis (Instagram, fidélité, opt-in) ; l'avis devient un CTA neutre non récompensé. Protège la fiche Google des commerçants. **Statut : 🔧/🔶 à construire.** *(Touche `Game.tsx`, l'éditeur de roue, la config wheel — mêmes fichiers → un seul epic.)*
**FRs covered:** FR2, FR3, FR14

### Epic 10 · [Incrément] Re-consentement fidélité (double opt-in)
Permettre à un client désinscrit de se ré-abonner proprement via un double opt-in (confirmation par e-mail), conforme RGPD. **Statut : 🔶 à faire.**
**FRs covered:** FR20

### Epic 11 · [Incrément] Commandes — remboursements & litiges
Gérer l'annulation, le remboursement (Stripe Connect) et les litiges d'une commande payée en ligne. **Statut : 🔶 à faire.**
**FRs covered:** FR27
