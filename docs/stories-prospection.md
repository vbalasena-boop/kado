---
title: "Epics & Stories — Prospection Kado"
status: draft
created: 2026-08-24
updated: 2026-08-24
---

# Epics & Stories — Système de prospection Kado

> Document produit selon la **BMAD Method** · v0.1 · 2026-08-24
> Amont : `docs/prd-prospection.md`, `docs/architecture-prospection.md`.

Backlog découpé en stories **livrables une par une**, dans l'ordre de dépendance.
Chaque story = petit incrément testable. Légende effort : ● petit · ●● moyen · ●●● gros.

---

## Epic A — Sourcing des prospects (fondation)

- **A1 — Migration base prospection** ● 
  Créer `supabase/migrations/00XX_prospection.sql` (tables `prospects`,
  `prospect_messages`, `prospect_events`, `suppression_list` + RLS admin).
  *DoD* : tables créées, RLS admin-only, migration rejouable.

- **A2 — Intégration Google Places (serveur)** ●● 
  `lib/prospection/places.ts` : recherche par ville + type, `Place Details`
  (note, nb d'avis, site, `place_id`). Clé en env, appels serveur.
  *DoD* : une fonction renvoie une liste normalisée ; clé jamais exposée ; erreurs Sentry.

- **A3 — Route sourcing + déduplication** ●● 
  `POST /api/admin/prospection/source` (ville, segments, plafond) → insère les nouveaux
  prospects, ignore les `place_id` déjà connus.
  *DoD* : 2 sourcings de la même ville → aucun doublon ; garde-quota + reprise.

- **A4 — Extraction email/Instagram depuis le site** ● 
  Parse léger de la home/contact du `website` pour deviner email + handle Instagram.
  *DoD* : quand le site existe, email/handle remplis si présents ; sinon champs vides.

## Epic B — Qualification & scoring

- **B1 — Moteur de score** ● 
  `lib/prospection/score.ts` (pur, testé) : `score` + `score_factors` (avis Google au
  cœur). Tests unitaires vitest.
  *DoD* : peu d'avis → score haut ; facteurs explicables ; tests verts.

- **B2 — Exclusion auto + manuelle** ● 
  Marquer hors-cible `excluded` + motif ; action opérateur « exclure définitivement ».
  *DoD* : un exclu ne réapparaît jamais dans les listes à contacter.

- **B3 — Liste filtrable/triable (UI)** ●● 
  `/admin/prospection` : tableau (nom, segment, note, nb avis, score, statut), filtres
  (segment, seuil d'avis, note max, « a un Instagram ») + tri.
  *DoD* : filtres combinables ; tri par score/avis ; pagination.

## Epic C — Génération des messages

- **C1 — Gabarits par segment** ● 
  `lib/prospection/templates.ts` : gabarits email + DM avec champs de fusion.
  *DoD* : rendu correct pour chaque segment avec les données prospect.

- **C2 — Génération + fiche prospect (UI)** ●● 
  `/admin/prospection/[id]` : signaux, messages générés (email + DM), **édition**,
  `POST /[id]/generate`.
  *DoD* : chaque prospect a email/DM prêts (selon canaux) ; édition conservée.

- **C3 — Garde-fou anti-spam + mentions RGPD** ● 
  Détection marqueurs spam (signalé UI) ; email inclut toujours désinscription
  (`unsubToken`) + mentions d'origine des données.
  *DoD* : email sans désinscription impossible ; alerte si message risqué.

## Epic D — Envoi email & délivrabilité (cœur du risque)

- **D0 — Interface d'envoi `sender.ts`** ● 
  `lib/prospection/sender.ts` : contrat `sendProspectEmail(...)` + une implémentation
  (SMTP dédié via `nodemailer`, ou stub). **Jamais Resend.** Isole le fournisseur.
  *DoD* : le reste du code n'appelle que l'interface ; fournisseur changeable par config.

- **D1 — Domaine d'envoi séparé + DNS** ● *(config, hors code)* 
  **Domaine distinct** de `kado-app.fr`, dédié à la prospection, + **SPF/DKIM/DMARC**.
  Variables `PROSPECT_EMAIL_FROM`, `PROSPECT_REPLY_TO`, `PROSPECT_SMTP_*`.
  *DoD* : domaine vérifié, SPF/DKIM/DMARC OK (test de délivrabilité passé), aucun lien avec
  le compte/domaine Resend transactionnel.

- **D2 — Approbation → séquence** ●● 
  `POST /[id]/approve` : email → programmé (message initial), DM → file. Contrôle
  `suppression_list` avant tout.
  *DoD* : un désinscrit n'entre jamais en séquence ; statut → `queued`/`emailed`.

- **D3 — Cron d'envoi (drip + plafond + relance)** ●● 
  `GET /api/cron/prospection` (secret) : envoie dans la limite du plafond quotidien,
  relance après N jours si pas de réponse, idempotent via `prospect_events`.
  *DoD* : jamais > plafond/jour ; pas de double envoi ; relance stoppée si « répondu ».

- **D4 — Webhook bounces/plaintes** ● 
  `POST /api/webhooks/prospection-email` (signé) → `prospect_events` + `suppression_list` ;
  alerte si taux de bounce/plainte > seuil.
  *DoD* : bounce dur → suppression + jamais recontacté ; alerte fonctionnelle.

- **D5 — Marquage « répondu »** ● 
  Action UI (MVP) qui stoppe la relance et passe `replied`. *(inbound auto = post-MVP)*
  *DoD* : passage `replied` → aucune relance ultérieure.

## Epic E — File Instagram assistée & tableau de bord

- **E1 — File Instagram assistée** ●● 
  `/admin/prospection/instagram` : DM `dm_pending`, copie 1 clic, lien profil, bouton
  « marqué envoyé » (`dm_sent`), quota `MAX_PROSPECT_DM_PER_DAY` visible/respecté.
  *DoD* : aucun envoi automatisé ; quota respecté.

- **E2 — Tableau de bord & indicateurs** ●● 
  Compteurs par statut, taux de réponse, envois restants du jour (email + Insta), alertes
  délivrabilité.
  *DoD* : indicateurs justes et à jour ; alertes visibles.

- **E3 — Statuts & notes** ● 
  `POST /[id]/status` : changer statut, ajouter une note.
  *DoD* : statut modifiable, note persistée, journalisé.

---

## Ordre de développement conseillé

1. **A1 → A2 → A3** (des prospects réels en base) 
2. **B1 → B3** (voir/prioriser) 
3. **C1 → C2 → C3** (messages prêts) 
4. **D1 → D2 → D3 → D4 → D5** (envoi sûr — D1 config à faire tôt) 
5. **E1 → E2 → E3** (Instagram + pilotage)

**Premier lot livrable (démo minimale)** : A1, A2, A3, B1, B3 → « je source une ville et je
vois une liste priorisée par potentiel Kado (avis Google) ». Puis C + D pour envoyer.

## Prochaine étape (BMAD)

Passer au **build** story par story (`bmad-build`), en commençant par **A1**.
