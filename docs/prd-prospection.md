---
title: "PRD — Prospection Kado"
status: draft
created: 2026-08-24
updated: 2026-08-24
---

# PRD — Système de prospection Kado (Instagram + email)

> Document produit selon la **BMAD Method** · Rôle : **PM (John)** · v0.1 · 2026-08-24
> Amont : `docs/brief-prospection.md`. Contexte produit : `docs/brief.md`, `docs/prd.md`, `docs/roadmap.md`.

---

## 1. Contexte & objectif

Outil **interne** (mono-opérateur : l'exploitant Kado) pour **acquérir des commerces
clients**. Il automatise la chaîne **sourcing → qualification → rédaction → envoi/suivi**
sur deux canaux : **email B2B** (envoi automatisé) et **Instagram** (DM assisté).

**Objectif produit** : fournir chaque semaine une liste de **prospects qualifiés** avec,
pour chacun, un email et un DM **personnalisés prêts à partir**, tout en garantissant
**zéro blacklist du domaine** et **zéro restriction du compte Instagram**.

## 2. Principes directeurs (contraintes dures)

- **P1 — Sécurité délivrabilité** : aucune action ne doit dégrader la réputation du
  domaine d'envoi ni finir en spam. *Prime sur le volume.*
- **P2 — Sécurité compte Instagram** : aucun envoi de DM automatisé. Le système prépare,
  l'humain envoie. Quotas prudents.
- **P3 — Budget 0 €** : réutiliser la stack Kado (Next.js, Supabase, Vercel, Resend).
  Pas d'outil payant au MVP.
- **P4 — Conformité RGPD** (cold email B2B France) : base légale intérêt légitime,
  ciblage pertinent, désinscription, mentions d'origine, droit à suppression.
- **P5 — Qualité > volume** : mieux vaut 30 prospects bien ciblés et bien écrits que 500
  génériques.

## 3. Utilisateurs & rôles

- **Opérateur (toi)** — unique utilisateur authentifié. Lance le sourcing, révise/valide,
  déclenche les envois email, envoie les DM depuis le tableau de bord.
- *(Pas d'autre rôle au MVP. Réutilise l'auth Kado existante ; accès admin uniquement.)*

## 4. Parcours opérateur (résumé)

1. L'opérateur choisit une **zone** (ville) et des **filtres** (segment, seuil d'avis Google).
2. Il lance le **sourcing** → l'outil remplit une liste de prospects qualifiés et scorés.
3. Il **passe en revue** la liste, ouvre un prospect, relit l'**email** et le **DM** générés.
4. Il **approuve** → l'email part (ou entre dans une séquence), le DM entre dans la **file
   Instagram**.
5. Il ouvre la **file Instagram**, copie/valide chaque DM et l'envoie depuis le compte.
6. Il suit les **statuts** (contacté / répondu / intéressé / client / exclu) et les
   **réponses**.

## 5. Périmètre

**MVP (ce PRD)** : Epics A → E ci-dessous.
**Hors MVP** : envoi DM Instagram automatisé (interdit), multi-comptes/multi-domaines,
enrichissement payant, CRM avancé, A/B testing de séquences, scoring prédictif.

---

## 6. Epics & User Stories

### Epic A — Sourcing des prospects par zone

Constituer une liste de commerces d'une zone à partir de sources publiques, avec leurs
signaux (avis Google, Instagram, contact).

- **US-A1** — En tant qu'opérateur, je choisis une **ville/zone** et un ou plusieurs
  **segments** (resto/bar/café, beauté/coiffure, boutique, sport/bien-être) pour lancer un
  sourcing.
- **US-A2** — Le système récupère les commerces correspondants avec, pour chacun :
  nom, catégorie, adresse, **note Google**, **nombre d'avis Google**, site web si dispo,
  **compte Instagram** si trouvable.
- **US-A3** — Le système **déduplique** (même établissement déjà en base) et n'ajoute que
  les nouveaux.
- **US-A4** — Le système **respecte les quotas gratuits** de la source et s'arrête
  proprement quand la limite est atteinte (message clair, reprise possible plus tard).

**Critères d'acceptation (extraits)**
- Un sourcing sur une ville produit une liste non vide avec note + nombre d'avis Google
  renseignés quand la donnée existe.
- Aucun doublon d'établissement dans la base après deux sourcings de la même zone.
- Le coût réel du sourcing reste dans l'offre gratuite (aucun dépassement facturé).

**Notes techniques (→ architecture)** : trancher la source exacte (Google Places/Maps vs
alternative) et ses quotas ; stocker `place_id`/identifiant stable pour la déduplication.

---

### Epic B — Qualification & scoring (avis Google au cœur)

Prioriser les prospects à plus fort potentiel Kado à partir de signaux publics.

- **US-B1** — Le système calcule un **score de priorité** par prospect à partir de :
  **nombre d'avis Google** (peu d'avis = potentiel élevé), **note moyenne** (perfectible =
  potentiel), **fraîcheur** des avis, **Instagram actif** (présence + activité).
- **US-B2** — En tant qu'opérateur, je **filtre/trie** la liste (ex. « restos < 50 avis
  Google », « note < 4,2 », « a un Instagram »).
- **US-B3** — Le système **écarte** (statut « exclu ») les hors-cible (ex. chaînes,
  établissements fermés, sans aucun canal joignable) avec un motif.
- **US-B4** — En tant qu'opérateur, je peux **exclure manuellement** un prospect
  (définitivement, pour ne jamais le recontacter).

**Critères d'acceptation (extraits)**
- Le score est explicable (on voit les facteurs qui l'ont produit).
- Les filtres « seuil d'avis Google » et « segment » fonctionnent et sont combinables.
- Un prospect exclu ne réapparaît jamais dans les listes à contacter.

---

### Epic C — Génération des messages personnalisés

Produire un email et un DM Instagram personnalisés, dans le ton Kado, par prospect.

- **US-C1** — Pour chaque prospect, le système **génère un email** (objet + corps)
  personnalisé : accroche liée à son activité + son signal avis Google (ex. « vous avez
  X avis, voici comment en obtenir plus sans effort »), présentation courte de Kado, appel
  à l'action, **lien de désinscription** et **mentions** requises.
- **US-C2** — Pour chaque prospect, le système **génère un DM Instagram** court, naturel,
  non-spammy, adapté au ton de la plateforme.
- **US-C3** — Les messages s'appuient sur des **gabarits par segment** (resto ≠ coiffeur)
  éditables par l'opérateur.
- **US-C4** — En tant qu'opérateur, je peux **relire et éditer** chaque message avant envoi ;
  rien ne part sans mon approbation.
- **US-C5** — Le système **évite les marqueurs de spam** (mots déclencheurs, excès de
  liens/majuscules/emojis) et le signale si un message est risqué.

**Critères d'acceptation (extraits)**
- Chaque prospect contacté dispose d'un email **et/ou** d'un DM prêt (selon canaux dispo).
- Un email généré contient toujours désinscription + mentions RGPD.
- L'opérateur peut modifier un message et son édition est conservée.

---

### Epic D — Envoi email automatisé & délivrabilité (canal prioritaire, cœur du risque)

Envoyer les emails de façon fiable, en protégeant la réputation du domaine.

- **US-D1** — En tant qu'opérateur, j'**approuve** un prospect → son email entre dans une
  **séquence** : message initial, puis **une relance** si pas de réponse après N jours.
- **US-D2** — Le système envoie via **Resend** depuis un **domaine dédié** correctement
  configuré (**SPF, DKIM, DMARC**), à **cadence lente** et plafonnée par jour.
- **US-D3** — Le système gère la **désinscription** (lien fonctionnel, liste de suppression
  respectée) et **ne recontacte jamais** un désinscrit ou un « ne pas contacter ».
- **US-D4** — Le système traite les **bounces** (retours) : purge/suspension des adresses
  invalides pour protéger la réputation.
- **US-D5** — Le système **détecte les réponses** entrantes et passe le prospect en
  « répondu » (arrêt automatique de la relance).
- **US-D6** — Un **garde-fou anti-blacklist** : quota quotidien maximum, montée en volume
  progressive, alerte si le taux de bounce/plainte dépasse un seuil.

**Critères d'acceptation (extraits)**
- Aucun email envoyé sans SPF/DKIM/DMARC validés sur le domaine.
- Un désinscrit ou un bounce dur ne reçoit plus jamais d'email.
- La relance s'arrête dès qu'une réponse est détectée.
- Le nombre d'envois/jour ne dépasse jamais le plafond configuré.

**Notes techniques (→ architecture)** : réception des réponses (adresse dédiée / webhook
Resend), gestion du warm-up, format du lien de désinscription (token).

---

### Epic E — File Instagram assistée & tableau de bord

Piloter la prospection sans jamais automatiser l'envoi Instagram.

- **US-E1** — En tant qu'opérateur, j'ai une **file d'attente Instagram** listant les DM
  préparés (prospect + message), avec **copie en un clic** et lien vers le profil.
- **US-E2** — Je marque chaque DM « **envoyé** » après l'avoir posté depuis le compte ; le
  système **limite le nombre de DM proposés/jour** (quota prudent) pour protéger le compte.
- **US-E3** — Un **tableau de bord** unique affiche tous les prospects et leur **statut**
  (à contacter / contacté email / contacté Insta / répondu / intéressé / client / exclu).
- **US-E4** — Je peux **changer le statut** manuellement et ajouter une **note** par prospect.
- **US-E5** — Le tableau de bord affiche des **indicateurs** : nb prospects par statut,
  taux de réponse, envois du jour restants (email + Insta), alertes délivrabilité.

**Critères d'acceptation (extraits)**
- Aucun DM n'est envoyé par le système ; tout passe par une action humaine explicite.
- Le quota de DM/jour est visible et respecté.
- Chaque prospect a un statut à jour et modifiable.

---

## 7. Exigences non-fonctionnelles (transverses)

- **NFR-1 Délivrabilité** : SPF/DKIM/DMARC obligatoires ; taux de spam visé ~0 % ; taux de
  délivrabilité > 95 % ; plafond d'envoi quotidien configurable ; warm-up progressif.
- **NFR-2 Conformité RGPD** : désinscription en 1 clic, liste de suppression persistante,
  mentions d'origine des données, gestion des demandes de suppression, journal des envois.
- **NFR-3 Conformité plateformes** : aucun envoi DM Instagram automatisé (CGU Meta) ;
  respect des conditions d'usage et quotas des sources de sourcing.
- **NFR-4 Coût** : rester dans les offres gratuites (Vercel/Supabase/Resend) ; alerte avant
  tout risque de dépassement.
- **NFR-5 Sécurité & accès** : outil réservé à l'opérateur authentifié (réutilise l'auth
  Kado) ; données prospects isolées ; secrets hors du code.
- **NFR-6 Robustesse** : un sourcing ou un envoi interrompu est **reprenable** sans doublon
  ni double envoi (idempotence).
- **NFR-7 Observabilité** : journal des actions (sourcing, envois, bounces, désinscriptions)
  consultable ; erreurs remontées (Sentry, déjà en place côté Kado).

## 8. Métriques de succès & contre-métriques

**Succès**
- Nb de prospects qualifiés générés / semaine.
- Taux de réponse (email + Insta) → taux de conversion en client Kado.
- Délivrabilité email > 95 %.

**Contre-métriques (à surveiller de près)**
- Taux de spam / plaintes (doit rester ~0 %).
- Taux de bounce (seuil d'alerte).
- Incidents compte Instagram (restrictions) — objectif **0**.
- Dépassements de quota gratuit (objectif **0**).

## 9. Hypothèses & questions ouvertes

- `[ASSUMPTION]` Le sourcing gratuit couvre suffisamment une ville pour alimenter le flux.
- `[ASSUMPTION]` Volume « artisanal » (dizaines/semaine), pas de multi-domaine au MVP.
- **Q1** — Source de sourcing exacte + ses quotas gratuits ? (→ architecture)
- **Q2** — Domaine d'envoi : sous-domaine dédié dédié à la prospection (pour isoler la
  réputation du domaine transactionnel Kado) ? *(recommandé)*
- **Q3** — Réception des réponses email : boîte dédiée + webhook, ou parsing ? (→ architecture)
- **Q4** — Base légale RGPD : confirmer intérêt légitime B2B + rédiger les mentions type.

## 10. Prochaines étapes (BMAD)

1. ✅ Brief — *Analyste* → `docs/brief-prospection.md`
2. ✅ **PRD** (ce document) — *PM* → `docs/prd-prospection.md`
3. ➡️ **Architecture** — *Architecte* → `docs/architecture-prospection.md`
4. Découpage détaillé en stories & build — *Dev / QA*
