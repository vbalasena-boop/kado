---
title: PRD — Kado
status: draft
version: 2.0
created: 2026-08-13
updated: 2026-08-24
---

# PRD — Kado

> **BMAD Method · PM** · v2.0 (brownfield) · 2026-08-24
> Refonte du PRD v0.1 (MVP « roue ») pour refléter le **produit réel en production**.
> Source de vérité technique : `docs/architecture.md`. Décrit le *quoi* (capacités),
> pas le *comment* (voir architecture).

---

## 1. Objectifs & contexte

**Kado** est un SaaS multi-tenant qui aide les commerces de proximité à **acquérir des
avis Google et des abonnés Instagram**, **fidéliser** leurs clients et **fluidifier la
prise de commande** — via des mécaniques ludiques (jeux), une carte de fidélité digitale,
le click & collect et un suivi de commande au comptoir, le tout sans app à installer côté
client final (un simple QR code).

Le produit a **largement dépassé le MVP** documenté en v0.1 (qui ne couvrait que la roue).
Ce PRD ratifie l'existant et sert de base aux epics/stories.

**Objectifs produit**
- Faire **jouer / s'inscrire / commander** le client final en < 60 s, sans friction, sur mobile.
- Donner au commerçant des **leviers de croissance** (avis, abonnés, e-mails opt-in, visites répétées) et des **outils opérationnels** (commandes, comptoir).
- Rester **multi-tenant sûr** : chaque commerce isolé, accès donné/retiré par l'admin ou l'abonnement.
- Monétiser via un **abonnement mensuel sans engagement** (4 formules) + options.
- `[ASSUMPTION]` Objectif business : convertir l'essai gratuit 14 j en abonnement payant, et faire croître le parc via l'affiliation vendeurs.

**Acteurs**
| Acteur | Espace | Rôle |
|---|---|---|
| **Client final** (joueur / client fidélité / acheteur) | `/{slug}` (public) | Scanne, joue, s'inscrit, commande. Aucun compte. |
| **Commerçant** (abonné) | `/dashboard` | Configure, suit ses stats, gère commandes & campagnes. |
| **Admin** (exploitant Kado) | `/admin` | Crée/suspend les comptes, gère plans, vendeurs, remboursements. |
| **Vendeur** (apporteur d'affaires) | `/vendeur/{key}` | Suit ses commissions via une clé secrète. |

---

## 2. Exigences fonctionnelles (FR)

> IDs globaux et stables, regroupés par domaine.

### Domaine A — Jeux (acquisition avis & abonnés)
- **FR1** — Le client accède à la page de jeu publique d'un établissement via `/{slug}` (lien/QR).
- **FR2** — Le jeu propose jusqu'à **2 tours** : un débloqué par l'action Instagram, un par l'action Avis Google (canaux activables/désactivables par le commerçant).
- **FR3** — Le **lot est tiré côté serveur** (pondéré), jamais dans le navigateur (anti-triche, stats fiables) ; le front anime seulement le résultat.
- **FR4** — **Verrou serveur des 2 tours** : un type de tour déjà joué ne peut être rejoué, même après vidage du navigateur (cookie joueur signé + contrainte unique en base).
- **FR5** — Le commerçant choisit le **type de jeu** : roue, carte à gratter, machine à sous.
- **FR6** — Le commerçant configure l'**apparence** (couleurs, logo, image de fond, décor animé) et les **lots** (libellé, emoji, probabilité, lot « perdant » explicite).
- **FR7** — Le lot gagné produit un **code** présentable en caisse, avec **durée de validité** paramétrable ; le commerçant **valide/échange** le code (anti-double-validation).
- **FR8** — **Plafond de cadeaux par jour** optionnel : au-delà, le tirage force un lot perdant.
- **FR9** — La page affiche la **mention de conformité** (cadeau non conditionné à la note) et un **règlement de jeu**.
- **FR10** — Alerte temps réel (push) au commerçant à chaque cadeau gagné (optionnel).

### Domaine B — Fidélité
- **FR11** — Le client crée/consulte une **carte de fidélité à tampons** identifiée par e-mail, sur `/{slug}/fidelite`.
- **FR12** — Le commerçant **valide un tampon** en caisse ; à l'objectif atteint, une **récompense** avec code est débloquée.
- **FR13** — **Parrainage** : un client parraine via son code ; le parrain est crédité au premier passage en caisse du filleul.
- **FR14** — **Anniversaire** : le client renseigne sa date ; un e-mail cadeau est envoyé le jour J (une fois/an).
- **FR15** — **Consentement marketing** géré côté client, avec **désinscription** respectée (RGPD) et non ré-activable de force.

### Domaine C — Click & collect (commande + paiement)
- **FR16** — Le commerçant gère un **catalogue de produits** (nom, prix, photo, actif/inactif).
- **FR17** — Le client **commande** depuis `/{slug}/commander` ; le **total est recalculé côté serveur** depuis le catalogue (anti-fraude prix).
- **FR18** — La commande génère un **code de retrait** ; e-mail de confirmation au client et alerte (push + e-mail) au commerçant.
- **FR19** — **Horaires de commande** paramétrables ; hors créneaux, la commande est refusée avec le prochain créneau.
- **FR20** — **Paiement en ligne optionnel** via **Stripe Connect** : l'argent va directement au compte du commerçant (commission plateforme optionnelle) ; sinon paiement sur place.
- **FR21** — Le commerçant suit les commandes via une **machine à états** (en attente de paiement → à préparer → prête → …) et notifie le client quand c'est prêt.
- **FR22** — Modes de service **sur place / à emporter** (+ n° de table).

### Domaine D — Comptoir (bipeur digital / suivi)
- **FR23** — Le client scanne un QR au comptoir et reçoit un **numéro de suivi** (bipeur digital), indépendant de la caisse.
- **FR24** — Le commerçant marque la commande **prête** ; le client est prévenu (push/e-mail) sur `/{slug}/suivi/{code}`.

### Domaine E — Campagnes & rétention
- **FR25** — Le commerçant crée des **campagnes e-mail et/ou push** (offres) vers ses clients opt-in, avec **programmation** et **envoi étalé**.
- **FR26** — **Tirage au sort** périodique parmi les e-mails collectés (fréquence + date paramétrables), gagnant tiré et notifié automatiquement.
- **FR27** — **Récap hebdomadaire** d'activité envoyé au commerçant ; **relance** automatique en fin d'essai (J-3).
- **FR28** — Collecte d'**e-mails opt-in** (leads) à l'occasion des jeux / de la fidélité.

### Domaine F — Affiliation vendeurs
- **FR29** — Un **vendeur** (apporteur d'affaires) est rattaché à des établissements ; une **commission** (barème par formule) est due au **premier paiement** du client (une seule fois).
- **FR30** — Le vendeur consulte ses stats via une **URL secrète** (`/vendeur/{stats_key}`, non indexée).
- **FR31** — L'admin gère les vendeurs, marque les commissions **à verser / versées**, et est notifié à chaque commission acquise.

### Domaine G — Espaces & administration
- **FR32** — **Authentification commerçant** par e-mail (OTP Supabase) ; accès refusé si compte suspendu.
- **FR33** — Un commerçant peut gérer **plusieurs établissements** et basculer entre eux.
- **FR34** — **Tableau de bord** : stats (tours, avis vs Instagram, cadeaux, fidélité, commandes), QR imprimable, onboarding.
- **FR35** — L'**admin** crée un compte (génère slug + config par défaut + invitation e-mail), **active/suspend** (coupe page publique **et** espace), édite plan/options, note interne, remboursement.
- **FR36** — **Suspension = un seul champ** : un compte suspendu rend la page publique indisponible et bloque l'espace ; la réactivation restaure sans perte de config.
- **FR37** — **Isolation multi-tenant** : un commerçant ne voit que ses données.

### Domaine H — Monétisation & abonnements
- **FR38** — **4 formules** mensuelles sans engagement : **Jeux 29 €**, **Fidélité 19 €**, **Complet 44 €** (tout inclus), **Comptoir 19 €** (bipeur seul) ; `[ASSUMPTION]` tarifs à confirmer/geler.
- **FR39** — **Essai gratuit 14 jours** ouvrant l'accès complet ; à l'expiration, l'accès est coupé sauf abonnement.
- **FR40** — **Abonnement Stripe self-service** : checkout, portail de gestion, changement de formule, options payantes (Campagnes, Comptoir, Installation clé en main).
- **FR41** — Le **webhook Stripe** (signature vérifiée) synchronise plan / statut / échéance et déclenche parrainage & commissions.
- **FR42** — **Parrainage commerçant** : 1 mois offert au parrain quand le filleul règle son 1er abonnement.

---

## 3. Exigences non fonctionnelles (NFR)

- **NFR1 — Mobile-first** : la page publique `/{slug}` (chemin critique, scannée au QR) doit être rapide (données statiques mises en cache ; TTFB minimal). Aucune app à installer.
- **NFR2 — Multi-tenant sûr** : RLS activée sur toutes les tables ; écritures serveur en `service_role` avec filtre `business_id` systématique ; policies SELECT par propriétaire (défense en profondeur).
- **NFR3 — Sécurité** : secret cron obligatoire, signature webhook, en-têtes de sécurité (anti-clickjacking, HSTS), uploads d'images whitelistés (pas de SVG), rate-limiting anti-abus « fail-closed ».
- **NFR4 — Conformité** : cadeau jamais conditionné à une note positive (règle Google) ; règlement de jeu (Meta/Instagram) ; RGPD (désinscription respectée, aucune donnée sensible côté joueur, opt-in marketing).
- **NFR5 — Paiements** : Stripe (abonnements) + Stripe Connect (encaissement commerçant) ; l'argent des commandes va directement au commerçant.
- **NFR6 — Fiabilité** : envois e-mail/push best-effort et non bloquants ; tâches planifiées (cron) idempotentes et parallélisées ; observabilité via Sentry + health-check.
- **NFR7 — Coût** : rester sur les offres Vercel + Supabase + Resend adaptées au parc ; `[ASSUMPTION]` maîtrise du coût d'envoi e-mail à l'échelle.
- **NFR8 — Accessibilité de base** : contraste, focus clavier, `prefers-reduced-motion`.

---

## 4. Parcours clés (résumé)

- **Joueur** — Scan QR → règles → 2 tours (action IG / action avis) → cadeau + code → (fidélité / commande proposées).
- **Client fidélité** — Ouvre sa carte par e-mail → cumule des tampons validés en caisse → récompense ; reçoit offres / anniversaire s'il opte-in.
- **Acheteur click & collect** — Catalogue → panier → (paiement en ligne ou sur place) → code de retrait → notifié quand c'est prêt.
- **Commerçant** — Connexion → dashboard → configure (roue/fidélité/catalogue/horaires) → QR → suit stats, commandes, campagnes → gère son abonnement.
- **Admin** — Crée/suspend comptes, édite plans & options, gère vendeurs & commissions, rembourse.
- **Vendeur** — Consulte ses commissions via son URL secrète.

---

## 5. Métriques de succès `[ASSUMPTION]` (à valider)

- **Activation commerçant** : % d'essais qui configurent une roue/fidélité et impriment le QR sous 24-48 h.
- **Conversion** : % d'essais 14 j → abonnement payant. **Contre-métrique** : taux de résiliation (churn mensuel).
- **Engagement client final** : taux scan → tour joué (> 50 %) ; avis/abonnés générés par établissement/mois ; e-mails opt-in collectés.
- **Valeur opérationnelle** : commandes click & collect / mois ; % payées en ligne. **Contre-métrique** : commandes annulées.
- **Croissance** : nouveaux commerces via affiliation ; **contre-métrique** : coût d'acquisition (commissions versées).

---

## 6. Hors périmètre / vision

**Hors périmètre actuel**
- Vérification réelle qu'un avis Google a été laissé (API limitée).
- Marque blanche / revendeurs en self-service.
- Analytics avancées (heatmap scans, ROI estimé), export.
- Multi-langues, templates par secteur en self-service.

**Vision**
- Durcissement anti-contournement du verrou (plafond global, empreinte).
- Migration des lectures tenant vers policies RLS (déjà posées) via client `ssr`.
- Templates sectoriels, analytics, SMS.

---

## 7. Questions ouvertes

- **[Q1]** Geler les tarifs des 4 formules et le détail des options (Installation, Campagnes, Comptoir). *(FR38)*
- **[Q2]** Objectifs chiffrés / métriques cibles (activation, conversion, churn) — actuellement `[ASSUMPTION]`. *(§5)*
- **[Q3]** Politique de re-consentement marketing après désinscription (double opt-in) — non implémentée. *(FR15)*
- **[Q4]** Modèle de commission vendeur définitif et conditions de versement. *(FR29-31)*
- **[Q5]** Stratégie de coût e-mail marketing à l'échelle. *(NFR7)*

---

## 8. Prochaines étapes (BMAD)

1. ✅ PRD (ce document, v2.0 brownfield) — *PM*
2. ✅ Architecture — *Architecte* → `docs/architecture.md` (déjà à jour)
3. ➡️ **Epics & Stories** — `bmad-create-epics-and-stories` (ratifier l'existant en epics livrés + cadrer le prochain incrément)
4. **Sprint planning** → **Build** pour le prochain incrément.
