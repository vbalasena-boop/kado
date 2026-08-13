# Project Brief — SpinReview (nom de travail)

> Document produit selon la **BMAD Method** · Rôle : **Analyste (Mary)** · v0.1 · 2026-08-13

---

## Résumé exécutif

**SpinReview** est un SaaS « scanne → joue → gagne » qui aide n'importe quel commerce
ou professionnel de proximité à obtenir plus **d'avis Google** et plus **d'abonnés
Instagram**, en transformant la demande d'avis en un **jeu de roue de la fortune**.

Le client final scanne un QR code sur place (carton, sticker, addition), débloque
jusqu'à **2 tours de roue** — un contre un suivi Instagram, un contre un avis Google —
et gagne un cadeau à présenter en boutique. Le commerçant configure sa roue depuis un
tableau de bord ; l'exploitant (toi) crée, active et **suspend les accès** des comptes,
sur un modèle d'**abonnement**.

---

## Problème

- Les commerces de proximité vivent de leur **réputation en ligne** (Google) et de leur
  **visibilité sociale** (Instagram), mais **peu de clients satisfaits laissent
  spontanément un avis** ou suivent le compte.
- Demander « laissez-nous un avis » à l'oral fonctionne mal : c'est gênant, vite oublié,
  et sans incitation le taux de conversion est très faible.
- Les solutions existantes sont soit **chères**, soit **génériques**, soit **risquées**
  au regard des règles Google (récompense contre avis positif = interdit).

## Solution proposée

Un jeu de roue **ludique et gratifiant** qui :
- rend l'action **désirable** (on gagne un cadeau, pas juste « on aide le commerce ») ;
- **plafonne à 2 tours** par personne pour rester crédible et maîtriser les coûts ;
- **découple le cadeau de la note** laissée, pour rester conforme aux règles Google ;
- se déploie via un simple **QR code**, sans app à installer côté client final.

## Utilisateurs cibles

**Segment primaire — le commerçant abonné (« le client »)**
Restaurants, bars, salons de coiffure/beauté, salles de sport, boutiques, garages,
cabinets, hôtels/gîtes… Tout pro avec un point de contact physique ou un colis.
Objectif : plus d'avis, plus d'abonnés, plus de visites répétées. Peu technophile —
veut une config simple et un QR à imprimer.

**Segment secondaire — l'exploitant du SaaS (« toi », l'admin)**
Crée et gère les comptes clients, **donne et retire l'accès**, suit les abonnements.

**Utilisateur final — le client du commerce (« le joueur »)**
Scanne, joue, gagne. Ne crée pas de compte. Parcours en < 60 secondes.

## Objectifs & indicateurs de succès

**Objectifs business**
- Lancer un MVP fonctionnel à **coût d'hébergement ~0 €**.
- Signer les **premiers commerces** et valider la volonté de payer un abonnement.

**Succès utilisateur (commerçant)**
- Mettre en place sa roue en **moins de 10 minutes**.
- Constater une **hausse mesurable** des avis / abonnés sous 30 jours.

**KPI produit**
- Taux de scan → tour joué (objectif > 50 %).
- Nombre d'avis / abonnements générés par établissement / mois.
- Taux de rétention des comptes payants (churn mensuel).

## Périmètre du MVP

**Inclus (MVP)**
- Page publique de jeu (règles → 2 tours → cadeau) — *déjà prototypée*.
- Verrou serveur des 2 tours par personne (pas seulement `localStorage`).
- Espace **commerçant** : configurer roue (cadeaux, couleurs, logo, liens Google/Insta),
  générer le QR code, voir des stats simples.
- Espace **admin** : créer / activer / **suspendre** un compte (gestion des accès).
- Authentification et multi-tenant (chaque commerce isolé).

**Exclus du MVP (plus tard)**
- Paiement Stripe automatisé (au départ : activation manuelle par l'admin).
- Statistiques avancées / export.
- Personnalisation par secteur, multi-langues.
- Vérification réelle qu'un avis a bien été laissé (API Google limitée).

**Critère de réussite du MVP** : un commerçant peut, seul, créer sa roue, imprimer son
QR, et un client peut jouer ses 2 tours ; l'admin peut couper l'accès à tout moment.

## Vision post-MVP

- Abonnements Stripe self-service + essai gratuit.
- Templates par secteur (coiffeur, resto, salle de sport…).
- Analytics (heatmap des scans, meilleurs cadeaux, ROI estimé).
- Notifications e-mail/SMS, collecte d'e-mails opt-in (base clients pour le commerçant).
- Marque blanche / revendeurs.

## Considérations techniques

- **Front + hébergement** : Next.js sur **Vercel** (offre gratuite).
- **Auth + base de données + stockage** : **Supabase** (offre gratuite, Postgres + Auth).
- **Paiement (post-MVP)** : Stripe.
- **Architecture** : multi-tenant, mobile-first, aucune app à installer côté joueur.

## Contraintes & hypothèses

- Budget d'infrastructure proche de **0 €** au démarrage.
- Exploitant **peu/pas développeur** → priorité à la simplicité de déploiement.
- **Conformité** : ne jamais conditionner un cadeau à une note positive (règle Google) ;
  prévoir un règlement de jeu pour les concours (Instagram/Meta).

## Risques & questions ouvertes

- **Contournement du verrou** : un joueur peut changer d'appareil → limiter via
  compte serveur + éventuellement un plafond global par établissement.
- **Politique Google** sur les incitations aux avis → cadrer le discours produit.
- **Coût des lots** : le commerçant doit pouvoir régler les probabilités (déjà prévu).
- Modèle de prix de l'abonnement : à définir (mensuel unique ? par établissement ?).

## Prochaines étapes (méthode BMAD)

1. ✅ Project Brief (ce document) — *Analyste*
2. ➡️ **PRD** (exigences, epics, user stories) — *PM* → `docs/prd.md`
3. Architecture technique — *Architecte* → `docs/architecture.md`
4. Découpage en stories & développement — *Scrum Master / Dev / QA*
