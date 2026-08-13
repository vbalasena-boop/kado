# PRD — Kado

> Document produit selon la **BMAD Method** · Rôle : **PM (John)** · v0.1 · 2026-08-13
> Source : `docs/brief.md`

---

## 1. Objectifs & contexte

**Objectifs**
- Fournir aux commerces un outil ludique qui augmente avis Google & abonnés Instagram.
- Plafonner le jeu à **2 tours par personne** (1 Instagram, 1 avis), vérifié côté serveur.
- Permettre à l'exploitant de **créer et suspendre les accès** clients (multi-tenant).
- Fonctionner à coût d'infrastructure ~0 € (Vercel + Supabase).

**Contexte**
Le prototype de la roue (`prototype/roue.html`) valide déjà le parcours joueur et la
limite à 2 tours via `localStorage`. Le PRD étend ce prototype vers un vrai SaaS
multi-comptes avec verrou serveur, configuration et administration.

---

## 2. Exigences

### Exigences fonctionnelles (FR)

- **FR1** — Un joueur accède à la page publique d'un établissement via un lien/QR unique.
- **FR2** — Le joueur dispose de **2 tours maximum** : un débloqué par l'action Instagram,
  un par l'action Avis Google.
- **FR3** — Cliquer sur une action ouvre le lien Instagram/Google configuré par le commerçant.
- **FR4** — Chaque tour fait tourner une roue à cadeaux **pondérés** et révèle un lot + un code.
- **FR5** — Un tour déjà joué ne peut **pas** être rejoué (verrou côté serveur, pas seulement
  navigateur).
- **FR6** — Un commerçant peut se connecter à un espace privé.
- **FR7** — Un commerçant configure sa roue : nom, logo, couleurs, liste de cadeaux
  (nom, emoji, probabilité), liens Instagram & Google.
- **FR8** — Un commerçant génère/télécharge son **QR code** vers sa page publique.
- **FR9** — Un commerçant voit des **statistiques simples** : tours joués, répartition
  Instagram vs avis, cadeaux distribués.
- **FR10** — Un administrateur crée un compte commerçant.
- **FR11** — Un administrateur **active ou suspend** un compte ; un compte suspendu
  rend la page publique indisponible et bloque l'accès à l'espace.
- **FR12** — L'isolation multi-tenant garantit qu'un commerçant ne voit que ses données.
- **FR13** — La page de cadeau affiche la mention « le cadeau n'est pas conditionné à la
  note » (conformité).

### Exigences non fonctionnelles (NFR)

- **NFR1** — Page publique **mobile-first**, chargement < 2 s en 4G, sans app à installer.
- **NFR2** — Hébergement dans les **offres gratuites** Vercel + Supabase pour le MVP.
- **NFR3** — Données isolées par tenant via Row Level Security (Supabase/Postgres).
- **NFR4** — Accessibilité de base (contraste, focus clavier, `prefers-reduced-motion`).
- **NFR5** — Aucune donnée personnelle sensible collectée côté joueur pour le MVP.
- **NFR6** — Le verrou des 2 tours doit résister au vidage du `localStorage` (clé serveur).

---

## 3. Objectifs d'UX

- **Vision** : ludique, généreux, rapide. Le joueur doit sourire ; le commerçant doit
  configurer sans notice.
- **Parcours joueur** : Règles → Hub (2 tours) → Roue → Cadeau → (Récap si terminé).
- **Parcours commerçant** : Connexion → Tableau de bord → Éditeur de roue (aperçu live) →
  QR → Stats.
- **Parcours admin** : Connexion → Liste des comptes → Créer / Suspendre / Réactiver.
- **Plateformes** : web responsive (joueur = mobile ; commerçant/admin = mobile + desktop).

---

## 4. Hypothèses techniques

- **Repo** : monorepo unique (app Next.js).
- **Stack** : Next.js (App Router) + Supabase (Auth, Postgres, RLS) sur Vercel.
- **Rendu** : page publique en Server Components ; espaces privés protégés par session.
- **Tests** : tests unitaires sur la logique de tirage et le verrou de tours ; smoke E2E
  du parcours joueur.
- **Verrou de tours (MVP)** : identifiant joueur = cookie signé + ligne en base par
  (établissement, joueur, type de tour). Option de durcissement post-MVP.

---

## 5. Liste des Epics

- **Epic 1 — Fondations & page de jeu publique**
  Mettre en place le projet, le multi-tenant, et servir la page de jeu configurable
  avec verrou des 2 tours côté serveur.
- **Epic 2 — Espace commerçant (configuration & QR)**
  Authentification commerçant, éditeur de roue, génération du QR, statistiques simples.
- **Epic 3 — Espace admin (gestion des accès & abonnements)**
  Création de comptes, activation/suspension, base du suivi d'abonnement.

---

## 6. Détail des Epics & User Stories

### Epic 1 — Fondations & page de jeu publique

**Story 1.1 — Initialisation du projet**
*En tant que* développeur, *je veux* un projet Next.js + Supabase déployable sur Vercel,
*afin de* disposer d'une base saine.
- CA1 : le projet démarre en local et se déploie sur Vercel.
- CA2 : connexion Supabase configurée via variables d'environnement.
- CA3 : un health-check `/api/health` répond 200.

**Story 1.2 — Modèle de données multi-tenant**
*En tant qu'*exploitant, *je veux* un schéma isolant chaque établissement,
*afin de* garantir la séparation des données.
- CA1 : tables `businesses`, `wheel_configs`, `prizes`, `plays` avec RLS activée.
- CA2 : un établissement possède un identifiant public (slug) pour son URL de jeu.

**Story 1.3 — Page publique de jeu configurable**
*En tant que* joueur, *je veux* voir la roue et les infos du commerce,
*afin de* jouer mes tours.
- CA1 : `/{slug}` charge la config (nom, logo, couleurs, cadeaux, liens).
- CA2 : parcours règles → hub → roue → cadeau identique au prototype.
- CA3 : un slug inconnu ou un compte suspendu affiche une page « indisponible ».

**Story 1.4 — Verrou serveur des 2 tours**
*En tant qu'*exploitant, *je veux* empêcher de rejouer,
*afin de* préserver la crédibilité du jeu.
- CA1 : un cookie joueur signé identifie le navigateur.
- CA2 : chaque tour joué enregistre une ligne `plays(business, player, type)`.
- CA3 : un type de tour déjà présent renvoie « déjà joué » et bloque la roue.

### Epic 2 — Espace commerçant

**Story 2.1 — Authentification commerçant**
- CA1 : connexion par e-mail (Supabase Auth) ; accès refusé si compte suspendu.
- CA2 : après connexion, redirection vers le tableau de bord de son établissement.

**Story 2.2 — Éditeur de roue**
*En tant que* commerçant, *je veux* configurer ma roue avec un aperçu,
*afin de* l'adapter à mon commerce.
- CA1 : éditer nom, logo, couleurs, liens Instagram & Google.
- CA2 : gérer la liste des cadeaux (ajout/suppression, nom, emoji, probabilité).
- CA3 : aperçu live de la roue ; sauvegarde persistée.

**Story 2.3 — Génération du QR code**
- CA1 : afficher/télécharger un QR pointant vers `/{slug}`.
- CA2 : format imprimable (PNG haute résolution).

**Story 2.4 — Statistiques simples**
- CA1 : nombre de tours joués, répartition Instagram vs avis, cadeaux distribués.
- CA2 : période consultable (7/30 jours).

### Epic 3 — Espace admin

**Story 3.1 — Liste des comptes**
- CA1 : l'admin voit tous les établissements, leur statut (actif/suspendu) et leur activité.

**Story 3.2 — Créer un compte commerçant**
- CA1 : créer un établissement + inviter le commerçant par e-mail.
- CA2 : génération automatique du slug et d'une config de roue par défaut.

**Story 3.3 — Donner / retirer l'accès**
*En tant qu'*exploitant, *je veux* activer ou suspendre un compte,
*afin de* gérer les abonnements.
- CA1 : bouton activer/suspendre par compte.
- CA2 : un compte suspendu bloque l'espace commerçant **et** la page publique.
- CA3 : réactivation restaure l'accès sans perte de configuration.

**Story 3.4 — Base du suivi d'abonnement (léger)**
- CA1 : champ statut d'abonnement (essai / actif / suspendu) et date.
- CA2 : (post-MVP) branchement Stripe pour automatiser.

---

## 7. Prochaines étapes

1. ✅ PRD (ce document) — *PM*
2. ➡️ **Architecture technique** — *Architecte* → `docs/architecture.md`
3. Découpage fin des stories & implémentation — *Scrum Master → Dev → QA*
