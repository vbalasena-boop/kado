---
title: PRD — Kado
status: final
version: 2.1
created: 2026-08-13
updated: 2026-08-25
---

# PRD — Kado

> **BMAD Method · PM** · v2.1 (brownfield) · 2026-08-25
> Refonte reflétant le **produit réel en production** + décisions de la revue qualité
> et de la recherche conformité. Source de vérité technique : `docs/architecture.md`.
> Recherche conformité : `_bmad-output/planning-artifacts/research/google-avis-conformite-2026-08-25/`.

**Légende statut d'implémentation** (pour distinguer ratification vs prochain incrément) :
✅ **Livré** · 🔧 **À modifier** (existe mais doit évoluer) · 🔶 **À faire** (non implémenté).

---

## 1. Objectifs & contexte

**Kado** est un SaaS multi-tenant qui aide les commerces de proximité à **acquérir des
avis Google et des abonnés Instagram**, **fidéliser** leurs clients et **fluidifier la
prise de commande** — via des jeux, une carte de fidélité digitale, le click & collect
et un suivi au comptoir, sans app à installer côté client (un simple QR code).

Le produit a **largement dépassé le MVP** documenté en v0.1 (roue seule). Ce PRD ratifie
l'existant et sert de base aux epics/stories.

**Objectifs produit**
- Faire **jouer / s'inscrire / commander** le client final en < 60 s, sur mobile.
- Donner au commerçant des **leviers de croissance** (avis, abonnés, e-mails opt-in, visites répétées) et des **outils opérationnels** (commandes, comptoir).
- Rester **multi-tenant sûr** et **conforme** (Google, RGPD, jeux-concours).
- Monétiser via un **abonnement mensuel sans engagement** (4 formules) + options.

**Acteurs**
| Acteur | Espace | Rôle |
|---|---|---|
| **Client final** | `/{slug}` (public) | Scanne, joue, s'inscrit, commande. Aucun compte. |
| **Commerçant** | `/dashboard` | Configure, suit stats, gère commandes & campagnes. |
| **Admin** | `/admin` | Crée/suspend comptes, plans, vendeurs, remboursements. |
| **Vendeur** | `/vendeur/{key}` | Candidate, suit ses commissions. |

---

## 2. Exigences fonctionnelles (FR)

### Domaine A — Jeux & acquisition (⚠️ décision conformité appliquée)

> **Décision (2026-08-25, option A)** : suite à la recherche conformité, la récompense
> du jeu **n'est plus liée à l'action « avis Google »**. Voir §5 Risques.

- **FR1 · ✅** — Le client accède à la page de jeu publique via `/{slug}` (lien/QR).
- **FR2 · 🔧** — Le jeu propose jusqu'à **2 tours**, débloqués par des **actions
  NON-avis** (suivi Instagram, inscription fidélité, opt-in offres) ou par le simple
  fait de jouer — **jamais** en échange d'un avis. *(Aujourd'hui un tour se débloque
  via l'action « avis Google » → à modifier.)*
- **FR3 · 🔧** — L'**avis Google** est proposé comme **CTA optionnel, NON récompensé**,
  présenté séparément du cadeau, et offert **à tous les clients au neutre** (pas de
  *review gating*).
- **FR4 · ✅** — Le **lot est tiré côté serveur** (pondéré), jamais dans le navigateur.
- **FR5 · ✅** — **Verrou serveur des 2 tours** (cookie signé + contrainte unique).
- **FR6 · ✅** — Le commerçant choisit le **type de jeu** : roue, carte à gratter, slot.
- **FR7 · ✅** — Le commerçant configure l'**apparence** (couleurs, logo, fond, décor).
- **FR8 · ✅** — Le commerçant gère les **lots** (libellé, emoji, probabilité, « perdant »).
- **FR9 · ✅** — Un lot gagné produit un **code** avec **durée de validité** paramétrable.
- **FR10 · ✅** — Le commerçant **valide/échange** le code en caisse (anti-double-validation).
- **FR11 · ✅** — **Plafond de cadeaux par jour** optionnel (au-delà : lot perdant forcé).
- **FR12 · ✅** — Affichage de la **mention de conformité** + **règlement de jeu**.
- **FR13 · ✅** — Alerte **push** au commerçant à chaque cadeau gagné (optionnel).
- **FR14 · 🔶** — L'**action déclenchante** de chaque tour est **configurable** par le
  commerçant (parmi les actions non-avis), pour s'adapter à ses objectifs.

### Domaine B — Fidélité
- **FR15 · ✅** — Carte de **fidélité à tampons** par e-mail sur `/{slug}/fidelite`.
- **FR16 · ✅** — Le commerçant **valide un tampon** ; à l'objectif, **récompense** + code.
- **FR17 · ✅** — **Parrainage** : le parrain reçoit **un tampon** au 1er passage en caisse du filleul.
- **FR18 · ✅** — **Anniversaire** : e-mail cadeau le jour J (1×/an).
- **FR19 · ✅** — **Consentement marketing** géré côté client, **désinscription respectée**.
- **FR20 · 🔶** — **Re-consentement** après désinscription via **double opt-in** *(non implémenté)*.

### Domaine C — Click & collect
- **FR21 · ✅** — **Catalogue produits** (nom, prix, photo, actif/inactif).
- **FR22 · ✅** — Commande depuis `/{slug}/commander` ; **total recalculé côté serveur** (anti-fraude).
- **FR23 · ✅** — **Code de retrait** + e-mail au client + alerte (push/e-mail) au commerçant.
- **FR24 · ✅** — **Horaires de commande** paramétrables (hors créneaux → refus + prochain créneau).
- **FR25 · ✅** — **Paiement en ligne** optionnel via **Stripe Connect** (argent au commerçant) ; sinon sur place.
- **FR26 · ✅** — **Statuts de commande** : `en attente de paiement → nouvelle → prête → …`.
- **FR27 · 🔶** — **Remboursement / annulation / litige** d'une commande payée en ligne *(à cadrer)*.
- **FR28 · ✅** — Modes **sur place / à emporter** (+ n° de table).

### Domaine D — Comptoir (bipeur)
- **FR29 · ✅** — Le client reçoit un **numéro de suivi** (bipeur digital) via QR au comptoir.
- **FR30 · ✅** — Le commerçant marque **prête** ; le client est prévenu (push/e-mail) sur `/{slug}/suivi/{code}`.

### Domaine E — Campagnes & rétention
- **FR31 · ✅** — **Campagnes e-mail/push** vers clients opt-in, avec **programmation** et **envoi étalé**.
- **FR32 · ✅** — **Tirage au sort** périodique parmi les e-mails, gagnant tiré et notifié.
- **FR33 · ✅** — **Récap hebdomadaire** d'activité au commerçant.
- **FR34 · ✅** — **Relance de fin d'essai** (J-3) automatique.
- **FR35 · ✅** — Collecte d'**e-mails opt-in** (leads) via jeux / fidélité.

### Domaine F — Affiliation vendeurs
- **FR36 · ✅** — **Candidature vendeur self-service** (`/vendeur`) : profil créé **inactif**, **validé par l'admin**.
- **FR37 · ✅** — **Connexion vendeur** par compte + accès à ses stats via **URL secrète** (`stats_key`, non indexée).
- **FR38 · ✅** — **Commission** rattachée aux établissements apportés, **barème à 3 tiers** (roue / fidélité / complet — **pas de tier comptoir** : retombe sur roue).
- **FR39 · ✅** — Le **record** de commission est créé au 1er paiement ; **exigibilité après le 2ᵉ prélèvement** du client.
- **FR40 · ✅** — L'admin **marque les commissions** (à verser / versées) ; **admin ET vendeur** notifiés à l'acquisition.

### Domaine G — Espaces & administration
- **FR41 · ✅** — **Authentification commerçant** par e-mail (OTP) ; accès refusé si suspendu.
- **FR42 · ✅** — **Multi-établissements** : un commerçant gère et bascule entre plusieurs.
- **FR43 · ✅** — **Tableau de bord** : stats, QR imprimable, onboarding.
- **FR44 · ✅** — Admin : **créer un compte** (slug + config par défaut + invitation e-mail).
- **FR45 · ✅** — Admin : **activer / suspendre** (coupe page publique **et** espace ; réactivation sans perte).
- **FR46 · ✅** — Admin : **éditer** plan, options, note interne, **remboursement**.
- **FR47 · ✅** — **Isolation multi-tenant** : un commerçant ne voit que ses données *(cf. NFR2)*.

### Domaine H — Monétisation
- **FR48 · ✅** — **4 formules** mensuelles sans engagement : Jeux, Fidélité, Complet, Comptoir *(tarifs → [Q1])*.
- **FR49 · ✅** — **Essai gratuit 14 j** (accès complet) ; expiration → accès coupé sauf abonnement.
- **FR50 · ✅** — **Stripe self-service** : checkout, portail, changement de formule, **options** (Campagnes, Comptoir, Installation).
- **FR51 · ✅** — **Webhook Stripe** (signature vérifiée) : synchronise plan/statut/échéance, déclenche parrainage & commissions.
- **FR52 · ✅** — **Parrainage commerçant** : 1 mois offert au parrain au 1er règlement du filleul.

### Domaine I — Vitrine & acquisition marketing
- **FR53 · ✅** — **Blog SEO** (`/blog`) : moteur d'articles pour le référencement.
- **FR54 · ✅** — Pages **vitrine** (accueil, tarifs, **témoignages**).

---

## 3. Exigences non fonctionnelles (NFR)

- **NFR1 — Mobile-first** : page publique `/{slug}` (chemin critique) rapide (données statiques mises en cache) ; aucune app à installer ; objectif chargement < 2 s en 4G.
- **NFR2 — Isolation multi-tenant** : **RLS activée** sur les 15 tables (**default-deny** + policies SELECT par propriétaire). En pratique, les accès applicatifs passent par le client `service_role` (contourne la RLS) **avec un filtre `business_id` explicite systématique** — l'isolation repose donc sur ce filtre + le default-deny côté REST. *(Évolution : migrer les lectures vers le client `ssr` pour s'appuyer directement sur les policies.)*
- **NFR3 — Sécurité** : secret cron obligatoire, signature webhook, en-têtes de sécurité (anti-clickjacking, HSTS), uploads whitelistés (pas de SVG), rate-limiting « fail-closed ».
- **NFR4 — Paiements** : Stripe (abonnements) + Stripe Connect (encaissement commerçant).
- **NFR5 — Fiabilité** : e-mail/push best-effort non bloquants ; cron idempotent et parallélisé ; Sentry + health-check.
- **NFR6 — Coût** : offres Vercel + Supabase + Resend adaptées au parc *(coût e-mail à l'échelle → [Q5])*.
- **NFR7 — Accessibilité de base** : contraste, focus clavier, `prefers-reduced-motion`.

---

## 4. Parcours clés (résumé)

- **Joueur** — Scan QR → règles → 2 tours (actions **non-avis** : suivi Insta / inscription) → cadeau + code → *(CTA avis Google optionnel, non récompensé)*.
- **Client fidélité** — Ouvre sa carte par e-mail → tampons validés en caisse → récompense ; offres / anniversaire si opt-in.
- **Acheteur** — Catalogue → panier → (paiement en ligne ou sur place) → code de retrait → notifié quand prêt.
- **Commerçant** — Connexion → dashboard → configure → QR → stats, commandes, campagnes → abonnement.
- **Admin** — Comptes, plans/options, vendeurs & commissions, remboursements.
- **Vendeur** — Candidate → validé → suit ses commissions.

---

## 5. Risques & conformité

> Cette section formalise les décisions de conformité (absente de la v2.0, ajoutée après recherche).

### 5.1 Avis Google — **décision : option A (découplage total)**
- **Constat** (recherche 2026-08-25) : récompenser l'action liée à l'avis est en **zone grise
  penchant risqué** côté Google ; depuis ~août 2025, Google demande aux utilisateurs
  *« ce commerce offre-t-il une récompense contre avis ? »* → un « oui » **supprime les
  avis rétroactivement**. **Le risque est porté par le commerçant** (sa fiche).
- **Décision** : la récompense du jeu est **totalement découplée de l'avis** (FR2/FR3).
  L'avis devient un **CTA neutre non récompensé**, proposé à tous → réponse honnête « non »
  à la question de Google → **risque de suppression éliminé** sur ce motif.
- **Bénéfice** : argument commercial fort — *« Kado ne met pas vos avis en danger. »*

### 5.2 Risques résiduels (génériques, à maîtriser)
- **Review gating** : ne jamais filtrer (« avis seulement si content ») → proposer l'avis **à tous, au neutre** (FR3).
- **Pic de volume** : une salve d'avis peut être filtrée par l'anti-spam Google (mild, commun à tous les outils).
- **Jeux-concours (droit FR)** : le **tirage au sort** (FR32) et les jeux nécessitent un **règlement** conforme.
- **RGPD** : au-delà de la désinscription (FR19), cadrer **effacement / conservation / mentions légales / registre**.

> ⚠️ Réserve : la recherche s'appuie sur des sources secondaires (accès primaires bloqués) → **valider avec un conseil juridique FR** avant tout argumentaire commercial de conformité.

---

## 6. Métriques de succès `[ASSUMPTION → Q2]`
À **chiffrer** avant les epics : activation commerçant (config+QR < 48 h), **conversion essai→payant**, **churn mensuel** (contre-métrique), scan→tour joué (> 50 %), avis/abonnés/opt-in par établissement, commandes click&collect (+ % payées en ligne, contre-métrique : annulations), **unit economics affiliation** (CAC = commissions).

---

## 7. Hors périmètre / vision
**Hors périmètre** : vérification réelle qu'un avis a été laissé (API limitée) ; marque blanche self-service ; analytics avancées/export ; multi-langues ; templates sectoriels self-service.
**Vision** : durcissement anti-contournement du verrou ; migration lectures tenant vers policies RLS (`ssr`) ; SMS ; analytics.

---

## 8. Questions ouvertes
- **[Q1]** Geler les tarifs des 4 formules + options. *(FR48)*
- **[Q2]** Chiffrer les métriques de succès. *(§6)*
- **[Q4]** Barème de commission définitif + conditions de versement. *(FR38-40)*
- **[Q5]** Stratégie de coût e-mail marketing à l'échelle. *(NFR6)*
- **[Q6]** Validation juridique FR de la conformité avis + règlement jeux-concours. *(§5)*

---

## 9. Prochaines étapes (BMAD)
1. ✅ PRD v2.1 (ce document) — *PM*
2. ✅ Architecture — `docs/architecture.md`
3. ➡️ **Epics & Stories** — `bmad-create-epics-and-stories` : ratifier les FR ✅ **Livré** en epics « socle », et cadrer les 🔧/🔶 (option A, double opt-in, action configurable, remboursements) en **prochain incrément**.
4. **Sprint planning** → **Build**.
