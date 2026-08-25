---
title: 'Story 9.2 — Débloquer les tours par des actions non-avis'
type: 'feature'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'b95fb72e5eed99536062cae19ed4508f16eae645'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Aujourd'hui un tour se débloque par « canal » (`instagram` ou `review`), et **ouvrir la page d'avis Google débloque directement un tour** (avis incité → risque pour la fiche Google du commerçant). Les actions non-avis configurées en 9.1 (`trigger_actions`) ne sont pas encore consommées par le jeu.

**Approach:** Faire piloter les tours du jeu par `trigger_actions` (⊆ `{instagram, loyalty, optin}`) au lieu des canaux `{instagram, review}`. Chaque action non-avis configurée = un tour (bouton de déblocage → tirage serveur). L'avis n'est **plus jamais** une action déclenchante. Le **mécanisme de verrou** (une chance par `play_type` via la contrainte SQL `unique`, limite quotidienne, tirage côté serveur) reste **strictement inchangé** — seul l'ensemble des actions change.

## Boundaries & Constraints

**Always:** un tour = une action non-avis configurée (`instagram|loyalty|optin`) ; au moins une active (repli `sanitizeTriggerActions` → `["instagram"]`) ; tirage du lot **côté serveur** ; unicité `(business_id, player_id, play_type)` + limite quotidienne **intactes** ; migration `0046` idempotente élargissant le `CHECK` `plays.play_type` **en gardant `review` valide** ; lectures tolérantes.

**Ask First:** ajouter une **vérification réelle** d'action (preuve de suivi/inscription/opt-in) — hors périmètre, on garde la confiance « au clic » ; changer la limite quotidienne ou la contrainte d'unicité.

**Never:** conditionner un tour à un avis ; laisser `review` débloquer un tour (client ou `/api/play`) ; modifier tirage serveur / unicité / limite quotidienne ; supprimer `instagram_enabled`/`review_enabled` (avis neutre = 9.3) ; toucher à l'éditeur 9.1 ou à la migration des configs existantes (9.4).

## I/O & Edge-Case Matrix

`isTriggerActionAllowed(playType, triggerActions)` (garde serveur, logique pure) :

| Scenario | Input / State | Expected Output | Error Handling |
|---|---|---|---|
| Action configurée | `("instagram", ["instagram","loyalty"])` | `true` | N/A |
| Action non configurée | `("optin", ["instagram"])` | `false` | 403 côté route |
| Avis rejeté | `("review", ["instagram","loyalty","optin"])` | `false` | 400/403 côté route |
| Colonne absente (tolérant) | `("instagram", undefined)` | `true` (repli `["instagram"]`) | N/A |
| Liste vide (garde-fou) | `("loyalty", [])` | `false` (repli `["instagram"]`) | 403 côté route |

</frozen-after-approval>

## Code Map

- `supabase/migrations/0046_plays_trigger_play_types.sql` (nouveau) -- `drop constraint if exists plays_play_type_check` + `add check (play_type in ('instagram','loyalty','optin','review'))` (idempotent, `review` gardé pour l'historique)
- `lib/wheel.ts:16` -- ajouter `isTriggerActionAllowed(playType, triggerActions): boolean` (réutilise `sanitizeTriggerActions`, `review` jamais autorisé)
- `app/api/play/route.ts` -- `:10` `VALID_TYPES = ["instagram","loyalty","optin"]` (retire `review`) ; `:57` lire `trigger_actions` ; `:66-73` garde = `isTriggerActionAllowed(playType, cfg?.trigger_actions)` → 403. Tirage/unicité/limite inchangés.
- `app/[slug]/page.tsx` -- `:20` `trigger_actions` dans `CFG_WIDE` (repli global) ; `:200-213` défaut de config inclut `trigger_actions`
- `app/[slug]/Game.tsx` -- `:183` `PlayType = "instagram"|"loyalty"|"optin"` ; `:402-408` `enabledChannels`/`totalTurns` dérivés de `sanitizeTriggerActions(config.trigger_actions)` ; un registre d'actions `{id,label,recap,badge,glyph,url}` (clés = `TRIGGER_ACTIONS`) pilote `startPlay` (`:608-625`, ouvre l'URL puis `spin`), le HUB (`:959-996`, boucle — retire les blocs codés en dur), le badge (`:1004-1014`) et le récap DONE (`:1176-1202`, retire `review`) ; généraliser les littéraux `2`/`>=2` (`:951/1163/1176`) en `totalTurns`/`usedCount >= totalTurns`
- `tests/wheel.test.ts` -- couvrir `isTriggerActionAllowed`

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/0046_plays_trigger_play_types.sql` -- élargir le `CHECK` de `plays.play_type` à `{instagram,loyalty,optin,review}` (idempotent) -- autoriser les nouveaux types de tours
- [x] `lib/wheel.ts` -- `isTriggerActionAllowed(playType, triggerActions)` (repli tolérant, `review` toujours refusé) -- garde serveur testable
- [x] `app/api/play/route.ts` -- `VALID_TYPES` sans `review` ; garde par `trigger_actions` (lecture tolérante) ; tirage/unicité/limite inchangés -- l'avis ne débloque plus rien côté serveur
- [x] `app/[slug]/page.tsx` -- lire/passer `trigger_actions` (tolérant) au composant `Game`
- [x] `app/[slug]/Game.tsx` -- registre d'actions ; tours dérivés de `trigger_actions` ; retirer `review` du déblocage ; généraliser les littéraux `2` -- un bouton par action non-avis, l'avis ne débloque plus
- [x] `tests/wheel.test.ts` -- tester `isTriggerActionAllowed` (matrice I/O, dont « avis toujours refusé »)

**Acceptance Criteria:**
- Given `trigger_actions = ["instagram","loyalty"]`, when le joueur réalise une action configurée, then le tour se débloque, le lot est tiré **côté serveur**, et le nombre de chances = nombre d'actions configurées.
- Given l'avis Google, when le joueur ouvre la page d'avis, then **aucun tour n'est débloqué** (pas de bouton `review` ; `/api/play` refuse `review`).
- Given le verrou, when un joueur rejoue le même `play_type`, then la contrainte d'unicité le bloque (409) ; limite quotidienne et tirage serveur inchangés.
- Given `0046` non appliquée, when un tour est joué, then `instagram` fonctionne (repli tolérant) sans casser la page.

## Design Notes

- **Registre d'actions** : URL par action → `instagram`=`config.instagram_url`, `loyalty`=`/${slug}/fidelite`, `optin`=aucune. HUB/badge/récap itèrent dessus (clés = `TRIGGER_ACTIONS`, pas de dérive).
- **Confiance « au clic »** conservée (comme Instagram) ; vérification réelle hors périmètre. **`review` gardé dans le `CHECK`** pour l'historique — on ne l'insère juste plus.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: 0 erreur
- `npm run lint` -- expected: 0 warning
- `npm test` -- expected: tous verts (dont matrice `isTriggerActionAllowed`)
- `npm run build` -- expected: succès

**Manual checks:**
- Config `trigger_actions = ["instagram","loyalty"]` → la page `/{slug}` affiche 2 boutons (Instagram, Fidélité), 2 chances ; aucun bouton « Avis Google » déclencheur ; jouer chaque action tire un lot ; rejouer le même type → déjà joué.

## Suggested Review Order

**Garde d'autorisation (cœur : quelles actions débloquent un tour)**

- Garde serveur pure : `review` toujours refusé, repli tolérant `["instagram"]`.
  [`wheel.ts:36`](../../lib/wheel.ts#L36)
- La route applique la garde ; `review` retiré de `VALID_TYPES` → 400.
  [`play/route.ts:81`](../../app/api/play/route.ts#L81)
- `VALID_TYPES` sans `review` (l'avis ne débloque plus rien côté serveur).
  [`play/route.ts:13`](../../app/api/play/route.ts#L13)

**Persistance & résilience (lectures tolérantes, verrou intact)**

- `trigger_actions` lu À PART pour ne jamais perdre `daily_prize_limit` (patch revue).
  [`play/route.ts:68`](../../app/api/play/route.ts#L68)
- `CHECK` violation `23514` (0046 non appliquée) → refus propre, pas de 500 (patch revue).
  [`play/route.ts:146`](../../app/api/play/route.ts#L146)
- Migration `0046` : élargit `plays.play_type`, garde `review` valide (historique).
  [`0046_plays_trigger_play_types.sql:16`](../../supabase/migrations/0046_plays_trigger_play_types.sql#L16)
- Page publique : lit `trigger_actions` (repli global si 0045 absente).
  [`page.tsx:20`](../../app/[slug]/page.tsx#L20)

**Jeu piloté par les actions (registre unique)**

- Registre d'actions `{instagram,loyalty,optin}` (clés = `TRIGGER_ACTIONS`) : source unique HUB/badge/récap.
  [`Game.tsx:251`](../../app/[slug]/Game.tsx#L251)
- Tours dérivés de `sanitizeTriggerActions(config.trigger_actions)` ; `review` retiré du modèle.
  [`Game.tsx:438`](../../app/[slug]/Game.tsx#L438)
- HUB = boucle sur les actions configurées (plus de bloc `review` codé en dur).
  [`Game.tsx:987`](../../app/[slug]/Game.tsx#L987)

**Tests (verrouillent les invariants)**

- Test de route : action configurée → 200 tirage, non configurée → 403, avis → 400.
  [`play-route.test.ts:90`](../../tests/play-route.test.ts#L90)
- Matrice I/O de la garde pure (dont « avis toujours refusé »).
  [`wheel.test.ts:67`](../../tests/wheel.test.ts#L67)
