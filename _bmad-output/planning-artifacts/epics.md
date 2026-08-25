---
stepsCompleted: [step-01, step-02, step-03]
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

---

# Détail des Epics & Stories

> **Socle (Epics 1-8)** : 1 story de **ratification** par epic — décrit le comportement
> livré, sert de référence d'acceptation / non-régression (pas de dev neuf).
> **Incrément (Epics 9-11)** : stories **dev-ready** (Given/When/Then), taille 1 session,
> sans dépendance vers une story future.

## Epic 1: Jeux & acquisition  [Socle · ✅ Livré]

### Story 1.1: [Ratification] Jouer et gagner via QR
As a client final,
I want scanner un QR et jouer jusqu'à 2 tours pour gagner un cadeau,
So that je reçois une récompense à retirer en caisse.

**Acceptance Criteria:**
**Given** un établissement actif et sa page `/{slug}`,
**When** je réalise les actions et lance un tour,
**Then** le lot est tiré côté serveur (pondéré) et un code est produit,
**And** un tour déjà joué est verrouillé (cookie signé + contrainte unique),
**And** le commerçant configure jeu, apparence et lots, valide le code en caisse, et voit la mention de conformité.

## Epic 2: Fidélité  [Socle · ✅ Livré]

### Story 2.1: [Ratification] Carte de fidélité à tampons
As a client final,
I want cumuler des tampons par e-mail et débloquer une récompense,
So that je suis incité à revenir.

**Acceptance Criteria:**
**Given** la fidélité activée,
**When** le commerçant valide un tampon,
**Then** le compteur progresse et une récompense (code) se débloque à l'objectif,
**And** parrainage, anniversaire et consentement marketing (désinscription respectée) fonctionnent.

## Epic 3: Commandes (click & collect + comptoir)  [Socle · ✅ Livré]

### Story 3.1: [Ratification] Commander et suivre le retrait
As a client final,
I want commander en ligne et suivre l'état de ma commande,
So that je récupère ma commande sans attendre.

**Acceptance Criteria:**
**Given** un catalogue actif et les horaires ouverts,
**When** je passe commande,
**Then** le total est recalculé côté serveur (anti-fraude) et un code de retrait est émis,
**And** le paiement se fait sur place ou via Stripe Connect,
**And** le client et le commerçant sont notifiés, avec bipeur digital au comptoir.

## Epic 4: Campagnes & rétention  [Socle · ✅ Livré]

### Story 4.1: [Ratification] Campagnes, tirage et récaps
As a commerçant,
I want envoyer des campagnes et animer ma base,
So that je fais revenir mes clients.

**Acceptance Criteria:**
**Given** des clients opt-in,
**When** je programme une campagne e-mail/push ou un tirage au sort,
**Then** l'envoi est étalé et le gagnant notifié,
**And** je reçois récap hebdo et relance de fin d'essai ; les leads opt-in sont collectés.

## Epic 5: Affiliation vendeurs  [Socle · ✅ Livré]

### Story 5.1: [Ratification] Parcours vendeur
As a vendeur,
I want candidater et suivre mes commissions,
So that je suis rémunéré pour les commerces apportés.

**Acceptance Criteria:**
**Given** une candidature self-service validée par l'admin,
**When** un commerce apporté paie,
**Then** une commission (barème 3 tiers) est enregistrée au 1er paiement et exigible au 2ᵉ prélèvement,
**And** je consulte mes stats via mon URL secrète ; admin et vendeur sont notifiés.

## Epic 6: Espaces & administration  [Socle · ✅ Livré]

### Story 6.1: [Ratification] Comptes & administration
As a commerçant / admin,
I want gérer mon espace et les comptes,
So that l'exploitation est maîtrisée et isolée.

**Acceptance Criteria:**
**Given** l'authentification par OTP,
**When** j'accède à mon espace,
**Then** je gère mes établissements (multi), mon tableau de bord et mon QR,
**And** l'admin crée / suspend / édite les comptes, et l'isolation multi-tenant est garantie.

## Epic 7: Monétisation  [Socle · ✅ Livré]

### Story 7.1: [Ratification] Abonnement Stripe self-service
As a commerçant,
I want m'abonner et gérer ma formule,
So that j'accède aux fonctionnalités selon mon plan.

**Acceptance Criteria:**
**Given** un essai gratuit 14 j,
**When** je choisis une des 4 formules,
**Then** le checkout Stripe et le portail fonctionnent (changement de formule, options),
**And** le webhook signé synchronise plan/statut/échéance et déclenche le parrainage commerçant.

## Epic 8: Vitrine & marketing  [Socle · ✅ Livré]

### Story 8.1: [Ratification] Vitrine & blog SEO
As a prospect,
I want découvrir Kado via des pages publiques,
So that je comprends l'offre et je m'inscris.

**Acceptance Criteria:**
**Given** le site public,
**When** je visite les pages,
**Then** l'accueil, les tarifs, les témoignages et le blog SEO sont accessibles et référençables.

## Epic 9: Conformité avis & actions déclenchantes du jeu  [Incrément · 🎯 Priorité]

### Story 9.1: Configurer les actions déclenchantes (non-avis)
As a commerçant,
I want choisir quelles actions non-avis débloquent les tours,
So that mon jeu reste conforme aux règles Google.

**Acceptance Criteria:**
**Given** l'éditeur de roue,
**When** je configure les actions déclenchantes,
**Then** je peux activer/désactiver « suivi Instagram », « inscription fidélité », « opt-in offres » (jamais l'avis Google),
**And** au moins une action reste active (garde-fou),
**And** la configuration est persistée dans `wheel_configs`.

### Story 9.2: Débloquer les tours par des actions non-avis
As a client final,
I want débloquer mes tours par une action non-avis (ou en jouant),
So that je ne suis jamais récompensé pour un avis.

**Acceptance Criteria:**
**Given** une configuration issue de la story 9.1,
**When** je réalise l'action configurée,
**Then** le tour se débloque et le lot est tiré côté serveur,
**And** l'ouverture de la page d'avis Google **ne débloque plus aucun tour**,
**And** le verrou des 2 tours reste inchangé.

### Story 9.3: Avis Google en CTA neutre non récompensé
As a commerçant,
I want proposer l'avis Google comme CTA optionnel non récompensé,
So that les avis de ma fiche ne risquent pas d'être supprimés.

**Acceptance Criteria:**
**Given** un client sur la page de jeu,
**When** il termine ou navigue,
**Then** un CTA « laisser un avis Google » optionnel s'affiche **à tous, au neutre** (pas de filtrage selon la satisfaction),
**And** aucun cadeau ni tour n'est lié à ce CTA,
**And** la mention de conformité reste affichée.

### Story 9.4: Migrer les configurations « avis » existantes
As a exploitant,
I want migrer les établissements dont un tour était débloqué par l'avis,
So that aucun commerçant ne reste sur la mécanique risquée.

**Acceptance Criteria:**
**Given** des `wheel_configs` où l'avis servait d'action déclenchante,
**When** la migration s'applique,
**Then** cette action est remplacée par une action non-avis par défaut (ou déblocage en jouant),
**And** les commerçants concernés sont informés du changement.

## Epic 10: Re-consentement fidélité (double opt-in)  [Incrément]

### Story 10.1: Demander une confirmation de ré-abonnement
As a client désinscrit,
I want redemander à recevoir les offres,
So that je peux revenir en le confirmant explicitement.

**Acceptance Criteria:**
**Given** une carte avec `unsubscribed_at` renseigné,
**When** le client demande à se ré-abonner,
**Then** un e-mail de confirmation avec **lien signé (token)** est envoyé,
**And** `marketing_ok` n'est **pas** réactivé à ce stade.

### Story 10.2: Confirmer le ré-abonnement via le lien
As a client,
I want confirmer via le lien reçu,
So that mon consentement est rétabli proprement (RGPD).

**Acceptance Criteria:**
**Given** un token valide et non expiré (story 10.1),
**When** je clique le lien de confirmation,
**Then** `unsubscribed_at` est effacé et `marketing_ok=true`,
**And** un token invalide/expiré est refusé avec un message clair,
**And** l'opération est idempotente (double clic sans effet de bord).

## Epic 11: Commandes — remboursements & litiges  [Incrément]

### Story 11.1: Rembourser une commande payée en ligne
As a commerçant,
I want rembourser une commande payée via Stripe Connect,
So that je gère les erreurs et les retours clients.

**Acceptance Criteria:**
**Given** une commande payée (`paid=true`, `stripe_session_id` présent),
**When** je déclenche un remboursement depuis le dashboard,
**Then** un refund Stripe est créé sur le **compte connecté** du commerçant,
**And** le statut de la commande passe à « remboursée »,
**And** un échec Stripe affiche une erreur claire sans corrompre l'état de la commande.

### Story 11.2: Annuler une commande
As a commerçant,
I want annuler une commande,
So that je gère les commandes impossibles à honorer.

**Acceptance Criteria:**
**Given** une commande active,
**When** je l'annule,
**Then** son statut passe à « annulée »,
**And** si elle était payée en ligne, le remboursement de la story 11.1 est proposé/déclenché,
**And** le client est notifié (e-mail/push best-effort, non bloquant).
