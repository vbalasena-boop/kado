---
title: 'Simplifier l’anti-rejeu du jeu sans code en caisse'
type: 'feature'
created: '2026-10-18'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'bc411f1d4d345af7fde8885003f53596cad7ccd7'
context: []
---

**Agent :** codex
**Niveau :** simple
**Priorité :** normale

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Les codes à usage unique exigent que le commerçant les distribue et complexifient le jeu.

**Approach:** Retirer l’expérience de code en caisse et conserver les protections automatiques existantes : cookie joueur, empreinte navigateur seulement après consentement explicite, et limite serveur par commerce et réseau.

## Boundaries & Constraints

**Always:** Le jeu reste accessible sans empreinte ni code ; aucun code n’est demandé au commerçant ou au joueur ; l’empreinte reste soumise au consentement explicite ; la limite par commerce/réseau reste active hors démo.

**Ask First:** Toute collecte obligatoire d’un numéro de téléphone, création de compte client, suppression de données ou règle de limitation plus stricte.

**Never:** Supprimer des données ou objets de production ; rendre l’empreinte obligatoire ; retirer les protections anti-rejeu préexistantes.

</frozen-after-approval>

## Code Map

- `app/api/play/route.ts` -- protections existantes et enregistrement d’un tour.
- `app/[slug]/Game.tsx` -- parcours client.
- `app/dashboard/qr/page.tsx` -- réglages et affiche QR.
- `app/api/dashboard/play-passes/route.ts` -- API marchande du code à retirer.
- `tests/play-route.test.ts` -- tests de limites et de tour.

## Tasks & Acceptance

**Execution:**
- [x] Retirer le parcours des codes côté jeu, dashboard, API, cron et confidentialité.
- [x] Garder la limite serveur par commerce/réseau et le consentement empreinte existant.
- [x] Mettre à jour les tests liés aux codes et vérifier le flux de jeu.

**Acceptance Criteria:**
- Given un jeu en production, when le joueur joue, then aucun code n’est demandé.
- Given un commerce standard, when plusieurs joueurs utilisent son jeu, then le plafond réseau serveur reste actif hors démo.
- Given le consentement empreinte refusé, when le joueur utilise le jeu, then le jeu reste accessible.

## Verification

**Commands:**
- `npm test -- --run tests/play-route.test.ts` -- tests ciblés verts.
- `npx tsc --noEmit` -- aucune erreur TypeScript.
- `npm run lint` -- aucune erreur de lint.
- `npm run build` -- build de production réussi.

## Suggested Review Order

**Flux de jeu et anti-rejeu**

- Le serveur garde la limite automatique réseau et n’exige aucun code client.
  [`route.ts:150`](../../app/api/play/route.ts#L150)
- Le client envoie seulement l’action choisie et l’empreinte consentie.
  [`Game.tsx:1024`](../../app/[slug]/Game.tsx#L1024)

**Parcours commerce et données historiques**

- L’affiche QR retrouve son instruction simple sans configuration supplémentaire.
  [`page.tsx:257`](../../app/dashboard/qr/page.tsx#L257)
- Les éventuels anciens codes expirent et sont supprimés automatiquement.
  [`route.ts:95`](../../app/api/cron/daily/route.ts#L95)
- Les règles restent vérifiées par le test ciblé anti-abus.
  [`play-route.test.ts:110`](../../tests/play-route.test.ts#L110)
