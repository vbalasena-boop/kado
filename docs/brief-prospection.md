---
title: "Project Brief — Prospection Kado"
status: draft
created: 2026-08-24
updated: 2026-08-24
---

# Project Brief — Système de prospection Kado (Instagram + email)

> Document produit selon la **BMAD Method** · Rôle : **Analyste (Mary)** · v0.1 · 2026-08-24
> Contexte produit : voir `docs/brief.md`, `docs/prd.md`, `docs/roadmap.md`.

---

## Résumé exécutif

Un **outil interne d'acquisition** qui aide l'exploitant de Kado à trouver, qualifier et
contacter des **commerces de proximité** susceptibles de s'abonner à Kado, via deux
canaux : **Instagram** (message direct) et **email B2B**.

Le système fait le travail lourd — **sourcer** les commerces d'une zone, les **qualifier**
(actifs sur Instagram, présents sur Google, sans trop d'avis), **rédiger** un message
personnalisé par prospect — puis :

- **Email** : envoi **automatisé** via un fournisseur légitime, avec suivi
  ouvertures/réponses et désinscription.
- **Instagram** : envoi **assisté** (le système prépare le DM, l'humain valide/envoie),
  pour **ne jamais risquer le bannissement du compte**.

**Contrainte n°1, non négociable** (exprimée par l'exploitant) : *ne pas être blacklisté
ni tomber dans les spams.* La délivrabilité et la sécurité des comptes priment sur le
volume. **Budget outils cible : 0 €** (mêmes offres gratuites que Kado).

---

## Problème

- Kado a besoin de **signer ses premiers commerces** (cf. objectif business du brief
  produit), mais la prospection manuelle est **lente et chronophage** : chercher les
  commerces un par un, trouver le bon contact, écrire un message pertinent, relancer.
- Les commerces cibles (restos, salons, boutiques…) sont **très présents sur Instagram**
  et joignables par **email pro**, mais un message générique est ignoré.
- Les approches « bourrines » (envoi de masse) **grillent le compte Instagram** et
  **font tomber les emails en spam / blacklistent le domaine** — exactement ce qu'il faut
  éviter quand on n'a qu'un compte et un domaine.

## Solution proposée

Un pipeline en 4 étapes, pensé **qualité > volume** et **zéro risque** :

1. **Sourcing** — constituer une liste de commerces d'une zone (ville/agglo test) à partir
   de sources publiques (ex. recherche Google Maps / annuaires), 100 % automatisé.
2. **Qualification** — scorer chaque prospect à partir de **signaux publics**, dont les
   **avis Google** en critère central :
   - **Nombre d'avis Google** : peu d'avis (ou base à étoffer) = **fort potentiel Kado**.
   - **Note moyenne** : une note perfectible ou volatile = besoin d'alimenter des avis récents.
   - **Fraîcheur** : pas d'avis récent = commerce qui « décroche » → bon timing.
   - **Instagram actif** (poste régulièrement) et **présence Google** confirmée.
   Ces signaux donnent un **score de priorité** et servent aussi de **filtres de ciblage**
   (ex. « restos < 50 avis Google dans la ville X »). Le hors-cible est écarté.
3. **Rédaction** — générer un message **personnalisé** par prospect (accroche liée à son
   activité) pour Instagram **et** pour email, dans le ton Kado.
4. **Envoi & suivi** :
   - **Email** : séquence automatisée (1 message + 1 relance), cadence lente, domaine
     réchauffé, désinscription, suivi des réponses. *Cold email B2B = autorisé en France
     sous conditions RGPD.*
   - **Instagram** : DM **préparé** et mis en file ; l'humain l'envoie depuis le compte
     (ou en 1 clic assisté). **Pas de cold DM automatisé** (interdit par les CGU Meta).

Un **tableau de bord** unique : liste des prospects, statut (à contacter / contacté /
répondu / client / exclu), et garde-fous anti-blacklist (quotas, listes de suppression).

## Utilisateurs cibles

**Utilisateur primaire — l'exploitant Kado (toi)**
Solo, peu de temps, veut un flux de prospects qualifiés et des messages prêts à partir,
**sans mettre en danger son compte Instagram ni la réputation de son domaine d'envoi**.

**Cibles de la prospection — les commerces prospects**
Multi-segments : **restos / bars / cafés**, **beauté / coiffure**, **boutiques / retail**,
**sport / bien-être**. Point commun : présence physique, actifs sur Instagram, dépendants
de leur réputation Google — le cœur de cible de Kado.

## Objectifs & indicateurs de succès

**Objectifs business**
- Alimenter un **flux régulier de prospects qualifiés** à coût quasi nul.
- Augmenter le **nombre de commerces contactés → démos → abonnements** signés.

**Succès utilisateur**
- Passer de « chercher + écrire à la main » à « valider des messages déjà rédigés ».
- **Zéro incident** : aucun blacklistage de domaine, aucune restriction du compte Instagram.

**KPI produit** *(à affiner au PRD)*
- Nb de prospects qualifiés générés / semaine.
- Taux de délivrabilité email (> 95 %) et taux de spam (~0 %).
- Taux de réponse (email + Instagram) → taux de conversion en client.
- Santé compte Instagram (aucune alerte / restriction).

## Périmètre du MVP

**Inclus (MVP)**
- **Sourcing** d'une zone (une ville/agglo) → liste de commerces avec Instagram + site/email
  si trouvables.
- **Qualification / scoring** automatique (dont **avis Google** : nombre, note, fraîcheur)
  et **déduplication**, avec **filtres de ciblage** (segment, zone, seuil d'avis Google).
- **Rédaction** d'un message personnalisé Instagram + email par prospect.
- **Envoi email automatisé** (fournisseur légitime, ex. Resend/Brevo — déjà utilisé côté
  Kado), avec relance unique, désinscription et suivi des réponses.
- **File d'envoi Instagram assistée** (messages préparés, envoi validé par l'humain).
- **Tableau de bord** des prospects + statuts + garde-fous (quotas quotidiens, liste
  d'exclusion / désinscrits, pas de recontact).

**Exclus du MVP (plus tard)**
- Envoi de DM Instagram automatisé (interdit CGU — resté hors périmètre par principe).
- Multi-comptes / multi-domaines et infra de gros volume.
- Enrichissement payant (APIs de données) tant que le budget est 0 €.
- CRM avancé, scoring prédictif, A/B testing de séquences.

**Critère de réussite du MVP** : à partir d'une ville, l'outil produit une liste qualifiée
de commerces avec, pour chacun, un email et un DM personnalisés prêts ; les emails partent
automatiquement sans finir en spam ; les DM sont envoyés en sécurité ; l'exploitant suit
tout depuis un tableau de bord.

## Vision post-MVP

- Séquences multi-relances + templates par segment (resto vs coiffeur…).
- Réchauffe de domaine et rotation d'expéditeurs pour monter en volume **proprement**.
- Détection auto « a répondu / intéressé » → passage en démo Kado.
- Intégration directe avec l'espace admin Kado (créer le compte commerçant depuis un
  prospect converti).

## Considérations techniques

- **Réutiliser la stack Kado** : Next.js (App Router) + Supabase (Postgres + Auth) +
  Vercel → coût marginal ~0 €. **Attention** : l'envoi de prospection **ne réutilise pas
  Resend** (son règlement interdit le cold email et une infraction menacerait les emails
  de connexion Kado) → **fournisseur d'envoi séparé** sur un **domaine distinct**.
- **Sourcing + avis Google** : le sourcing local (type Google Maps / Places) fournit
  déjà **note moyenne et nombre d'avis** — réutilisés directement comme signaux de
  qualification. Respecter les conditions d'usage et les quotas gratuits des sources
  (choix exact de la source et de ses limites à trancher au PRD/architecture).
- **Délivrabilité email** *(cœur du projet)* : **domaine d'envoi séparé** (distinct de
  celui de Kado), **SPF/DKIM/DMARC**, volume lent et progressif (warm-up), contenu
  non-spammy, lien de désinscription, purge des bounces. Fournisseur d'envoi dédié au cold
  email (SMTP dédié ou outil type Instantly/Smartlead), **jamais Resend**.
- **Sécurité Instagram** : pas d'automatisation d'envoi ; actions humaines depuis le
  compte ; quotas conservateurs.

## Contraintes & hypothèses

- **Contrainte dure** : ne jamais être blacklisté (domaine) ni restreint (compte Insta).
  → volume faible et sécurisé, jamais d'envoi de masse.
- **Budget outils : 0 €** au démarrage → privilégier le fait-maison sur la stack existante.
- **RGPD / cold email B2B (France)** : contact d'un pro sur son email pro, objet en lien
  avec son activité, **désinscription** facile, **mentions** d'origine des données, respect
  des demandes de suppression. *(À cadrer précisément au PRD ; le brief pose le principe.)*
- **CGU Meta** : le DM sortant automatisé n'est pas autorisé → **envoi assisté** retenu.
- `[HYPOTHÈSE]` Exploitation solo, une zone test au départ, volume « artisanal ».
- `[HYPOTHÈSE]` Le sourcing gratuit fournit assez de prospects exploitables sur une ville.

## Risques & questions ouvertes

- **Délivrabilité** : un domaine mal configuré ou un envoi trop rapide grille la réputation.
  → configuration DNS soignée + cadence lente **avant** tout volume. *Risque n°1.*
- **Fiabilité du sourcing gratuit** : couverture et fraîcheur des données à valider ;
  quelles sources exactement, et leurs conditions d'usage ? *(question ouverte pour le PRD)*
- **Trouver l'email pro** : tous les commerces n'exposent pas d'email → part du sourcing
  qui restera « Instagram uniquement ».
- **RGPD** : cadrer précisément les mentions, la base légale (intérêt légitime B2B) et la
  gestion des désinscriptions/suppressions.
- **Compte Instagram** : même en assisté, un rythme trop élevé peut déclencher des limites
  → définir des quotas prudents.
- `[HYPOTHÈSE à valider]` Volume cible réel par semaine (non chiffré : la priorité affichée
  est « pas de spam / pas de blacklist », pas le volume).

## Prochaines étapes (méthode BMAD)

1. ✅ Project Brief (ce document) — *Analyste* → `docs/brief-prospection.md`
2. ➡️ **PRD** (exigences, epics, user stories) — *PM* → `docs/prd-prospection.md`
3. Architecture technique — *Architecte* → `docs/architecture-prospection.md`
4. Découpage en stories & développement — *Scrum Master / Dev / QA*
