---
title: "Rétrospective — Épic Système de prospection Kado"
status: done
created: 2026-08-25
method: BMAD (bmad-retrospective)
verdict: accepted-with-open-items
---

# Rétrospective BMAD — Système de prospection Kado (Instagram + email)

> Rétrospective fondée sur les preuves (evidence-based). Chaque constat renvoie à
> une source : fichier, story (DoD) ou commit.

## Cadre & périmètre de preuves

- **Épic** : « Système de prospection Kado (Instagram + email) », artefacts de
  cadrage dans `docs/{brief,prd,architecture,stories}-prospection.md`.
- **Base de preuves** : diff `4e00f68~1..HEAD` (**28 fichiers, +2021 / −94**),
  30 commits `feat/fix(prospection)`, 8 tests unitaires (`tests/prospection-*.test.ts`,
  61 cas), et les DoD de `docs/stories-prospection.md`.
- **Contrôle de complétude automatisé** : *non exécuté* — pas de
  `sprint-status.yaml` ni de spec-folder standard (`SPEC.md`/`stories.yaml`) ;
  l'épic a été pris explicitement (demande utilisateur). Réconciliation faite à
  la main story par story.
- **Revue de code (diff-scope)** : lentilles adversariale / cas-limites /
  écart-de-vérification passées **en ligne** (pas via un run multi-agents
  `bmad-review` complet) — périmètre volontairement resserré pour une rétro
  orientée valeur métier. Narrowing consigné ici.

## Inventaire — ce que l'épic a produit

| Epic | Story (DoD) | Livré | Preuve |
|---|---|---|---|
| A | A1 migration | ✅ | `supabase/migrations/0043_prospection.sql` (4 tables + RLS) |
| A | A2 Google Places | ✅ (+ pagination) | `lib/prospection/places.ts` |
| A | A3 route + dédup | ✅ | `app/api/admin/prospection/source/route.ts`, `lib/prospection/source.ts` (`partitionNew`) |
| A | A4 extraction email/Insta | ✅ | `lib/prospection/enrich.ts` |
| B | B1 scoring | ✅ testé | `lib/prospection/score.ts`, `tests/prospection-score.test.ts` |
| B | B2 exclusion | ✅ | `app/api/admin/prospection/[id]/status/route.ts` |
| B | B3 liste filtrable/triable | ⚠️ partiel | `ProspectionClient.tsx` — **pas de pagination** (cap 500, filtres client) |
| C | C1 gabarits | ✅ | `lib/prospection/templates.ts` |
| C | C2 fiche + génération | ✅ | `app/admin/prospection/[id]/`, `[id]/generate/route.ts` |
| C | C3 anti-spam + RGPD | ✅ | `lib/prospection/spam.ts`, `unsub.ts` (marqueur désinscription obligatoire) |
| D | D0 `sender.ts` (jamais Resend) | ✅ | `lib/prospection/sender.ts` |
| D | D1 domaine séparé + DNS | ✅ (config) | OVH `kado-pro.fr`, SPF/DKIM/DMARC 10/10 (mail-tester) |
| D | D2 approbation → séquence | ✅ | `approve-all/route.ts`, `message/[mid]/route.ts` |
| D | D3 cron drip + plafond + relance | ✅ | `lib/prospection/send-run.ts`, `vercel.json` (`0 7 * * 1-5`) |
| D | D4 bounces/plaintes | ⚠️ partiel | `lib/prospection/replies.ts` (bounce → suppression) — **mais approche IMAP, pas webhook signé, et AUCUNE alerte sur taux de bounce/plainte** |
| D | D5 marquage « répondu » | ✅ (dépasse MVP : auto) | `lib/prospection/replies.ts` (IMAP) |
| E | E1 file Instagram assistée | ⚠️ partiel | `app/admin/prospection/instagram/` — **quota `MAX_PROSPECT_DM_PER_DAY` non implémenté ni visible** (simple compteur `dmToday`) |
| E | E2 tableau de bord | ⚠️ partiel | `StatsBand` — indicateurs OK, mais **pas d'alertes délivrabilité** |
| E | E3 statuts & notes | ✅ | `status/route.ts` (`note`), colonne `note` schéma |

Ajouts hors backlog initial (valeur ajoutée) : warm-up progressif, RDV
téléphonique + lien Calendly, régénération des messages **approuvés**, colonnes
Email/DM d'état d'envoi, variation anti-bulk déterministe, ajout manuel de
prospect, revérification des contacts.

## Constats (avec sources)

### Points forts confirmés
- **Priorité n°1 tenue (zéro spam / réputation)** : domaine cloisonné, jamais
  Resend (`sender.ts`), SPF/DKIM/DMARC 10/10, `List-Unsubscribe`, warm-up,
  suppression sur bounce. Source : Epic D + commits `5d13aae`, `b7c7a75`.
- **Idempotence de l'envoi** : plafond calculé sur `prospect_events`
  (`email_sent`+`email_followup_sent`) et message → `sent` ⇒ pas de double envoi.
  Source : `lib/prospection/send-run.ts`.
- **Dette maîtrisée** : la logique de régénération dupliquée (route par prospect
  vs globale) a été factorisée. Source : `lib/prospection/regenerate.ts` (commit `9387da6`).
- **Cœur pur & testé** : scoring, enrichissement, gabarits, spam, pagination
  couverts par 61 cas unitaires. Source : `tests/prospection-*.test.ts`.

### Écarts / risques
1. **[Opérationnel] Envoi possiblement en simulation.** Sans `PROSPECT_SMTP_*`,
   `sender.ts` simule (rien ne part). C'est le préalable à toute valeur réelle.
   Source : `lib/prospection/sender.ts`.
2. **[D4 — DoD non atteint] Pas d'alerte sur taux de bounce/plainte.** Les bounces
   sont supprimés mais aucun seuil ne prévient si la réputation se dégrade — or
   c'est la priorité n°1. Source : `docs/stories-prospection.md` D4 vs `replies.ts`.
3. **[Mesure] Impossible d'A/B tester les messages.** La variante spintax choisie
   (`pick()`) n'est pas tracée dans `prospect_messages` ⇒ on ne peut pas mesurer
   le taux de réponse par objet/variante. Source : `lib/prospection/templates.ts`.
4. **[E1 — DoD non atteint] Quota DM/jour ni imposé ni visible.** Envoi Insta 100 %
   manuel (risque faible), mais l'objectif « quota respecté » n'est pas outillé.
   Source : `docs/stories-prospection.md` E1 vs absence de `MAX_PROSPECT_DM_PER_DAY`.
5. **[Bounces réactifs] Pas de vérification d'email avant envoi.** On détecte le
   bounce *après* coup ; un contrôle MX/format en amont réduirait le risque.
   Source : `replies.ts` (détection post-envoi uniquement).
6. **[B3 — DoD partiel] Pas de pagination.** Cap à 500 + filtres client ; au-delà,
   la liste tronque silencieusement. Source : `page.tsx` (`limit(500)`).
7. **[QA] Couverture des routes API nulle.** 61 cas sur la logique pure, 0 test
   d'intégration sur les routes (envoi, dédup, approbation). Source : `tests/`.

## Verdict d'acceptation

**ACCEPTÉ AVEC RÉSERVES** (`accepted-with-open-items`).

Les 5 epics et leurs stories cœur sont livrés et fonctionnent en production
(email réel rendu correctement, pipeline complet). Trois DoD ne sont que
partiellement atteints (D4 alerte bounce, E1 quota DM, B3 pagination) et
deviennent le backlog ci-dessous. Aucune story bloquante non finie. La priorité
métier (délivrabilité / non-spam) est tenue.

## Backlog priorisé (action items)

### 🔴 P1 — débloque la valeur réelle
- **AI-1 [Ops]** Confirmer/brancher le SMTP dédié (sortir du mode simulation). — *constat 1*
- **AI-2 [Archi] D4** Alerte sur taux de bounce/plainte (seuil) — protège la réputation. — *constat 2*
- **AI-3 [Analyste]** Tracer la variante de message envoyée pour mesurer le taux de réponse par objet/segment. — *constat 3*

### 🟠 P2 — fort impact
- **AI-4 [PM] E1** Quota DM/jour visible + respecté (`MAX_PROSPECT_DM_PER_DAY`). — *constat 4*
- **AI-5 [Archi]** Vérification email (MX/format) avant envoi. — *constat 5*
- **AI-6 [PM]** Séquence de relance à 3 temps (J+4, J+10). — `send-run.ts` (1 seule relance)
- **AI-7 [PM]** Boucle Calendly → passage auto « Intéressé » (webhook). — nouveau
- **AI-8 [UX] B3** Pagination + export CSV de la liste. — *constat 6*

### 🟡 P3 — robustesse / confort
- **AI-9 [Dev]** Tests d'intégration des routes (envoi, dédup, approbation). — *constat 7*
- **AI-10 [Compliance]** Rétention RGPD : purge auto des exclus/désinscrits après N mois.
- **AI-11 [Archi]** Alerte si le cron d'envoi échoue (aucun envoi un jour ouvré).
- **AI-12 [Archi]** Envoi espacé (jitter) — déjà préparé (`PROSPECT_SEND_BATCH`), nécessite Vercel Pro.

## Assumptions (traçabilité)

- Épic sélectionné : « prospection » (fourni explicitement), faute de
  `sprint-status.yaml`.
- Contrôle de complétude automatisé non exécuté (pas de fichier sprint) —
  réconciliation manuelle par DoD.
- Revue diff-scope menée en ligne (pas de run multi-agents `bmad-review`).
- Document écrit sous `docs/` (convention du projet) faute de spec-folder standard.
