---
stepsCompleted: [step-01]
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

{{requirements_coverage_map}}

## Epic List

{{epics_list}}
