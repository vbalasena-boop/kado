---
title: 'Durcissement — ne plus avaler les erreurs Supabase (helper + cluster wheel)'
type: 'bugfix'
created: '2026-08-25'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'a50b3bf97571426b6508854b68292a776c2c1600'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le client supabase-js ne « throw » pas sur erreur : il résout avec `{ error }`. Quatre blocs « tolérants » de `app/api/dashboard/wheel/route.ts` (play_alerts, monthly_draw, draw, trigger_actions) enveloppent un `update` dans `try { await … } catch {}` **sans lire l'`error`** — le `catch` ne capte donc rien. Une VRAIE panne (RLS, contrainte, connectivité) est **silencieusement ignorée** et la route renvoie `{ ok: true }` → sauvegarde perdue sans que le commerçant le sache (c'est exactement le bug prod vécu sur `trigger_actions`).

**Approach:** Créer un helper partagé `isMissingColumnError(error)` (codes `42703` undefined_column, `42P01` undefined_table, `PGRST204` colonne absente du cache PostgREST) et l'appliquer aux 4 blocs du wheel route : on **n'ignore que** le cas « colonne absente » (tolérance migration préservée) ; pour **toute autre** erreur (ou un throw réseau), on **remonte un échec clair** (`reportError` + 500) au lieu de prétendre au succès. Premier créneau d'un chantier plus large (≈16 autres sites reportés en Story 2).

## Boundaries & Constraints

**Always:** helper pur `isMissingColumnError(error)` testable, basé sur `error?.code` (jamais sur le message, fragile/localisé) ; ne « tolérer » (ignorer) QUE les codes colonne/table absente ; toute autre erreur `{ error }` **ou** exception jetée → `reportError(error, { where: "dashboard/wheel", field })` + `Response.json({ error: "save_failed", detail }, { status: 500 })` ; préserver le comportement « survivre à une migration non appliquée » (colonne absente → on ignore et on continue les blocs suivants) ; conserver le succès `{ ok: true }` final quand tout va bien.

**Ask First:** convertir aussi le repli message-regex `/decor_emojis/` de l'upsert principal (l.138) vers `isMissingColumnError` ; élargir le fix au-delà du wheel route dans cette même story.

**Never:** transformer un « colonne absente » en 500 (régression de la tolérance migration) ; toucher aux ≈16 autres sites recensés (Story 2 — dont webhook/cron qui doivent rester 200 by-design → là le fix sera `reportError` sans 500) ; changer la logique métier des updates (valeurs écrites inchangées) ; modifier le wrapper de route.

## I/O & Edge-Case Matrix

`isMissingColumnError(error)` (pur) :

| Scenario | Input | Expected |
|---|---|---|
| Colonne absente | `{ code: "42703" }` | `true` |
| Table absente | `{ code: "42P01" }` | `true` |
| Cache PostgREST | `{ code: "PGRST204" }` | `true` |
| Vraie erreur | `{ code: "23505" }` (unique) / `{ code: "42501" }` (RLS) | `false` |
| Sans code | `{ message: "boom" }` / `null` / `undefined` | `false` |

Bloc tolérant (wheel route), par champ :

| Scenario | State | Expected |
|---|---|---|
| Colonne absente | `update` → `{ error: {code:"42703"} }` | ignoré, on continue ; route `{ ok: true }` |
| Vraie erreur | `update` → `{ error: {code:"23505"} }` | `reportError` + `500 save_failed` (pas de faux succès) |
| Exception jetée | `update` lève | `reportError` + `500 save_failed` |
| Succès | `{ error: null }` | on continue ; route `{ ok: true }` |

</frozen-after-approval>

## Code Map

- `lib/db-errors.ts` (nouveau) -- `isMissingColumnError(error: unknown): boolean` : lit `error?.code` et le compare à `{ "42703", "42P01", "PGRST204" }`. Aucune dépendance ; défensif (`error` inconnu / null → `false`). Cf. usages ad-hoc existants `app/api/play/route.ts:155` (`code === "42703"`).
- `app/api/dashboard/wheel/route.ts` -- 4 blocs tolérants (l.153-160 play_alerts, l.163-174 monthly_draw, l.175-190 draw, l.195-202 trigger_actions). Nouveau motif par bloc :
  ```
  try {
    const { error } = await admin.from("wheel_configs").update({ … }).eq("business_id", business.id);
    if (error && !isMissingColumnError(error)) {
      reportError(error, { where: "dashboard/wheel", field: "play_alerts" });
      return Response.json({ error: "save_failed", detail: error.message }, { status: 500 });
    }
  } catch (e) {
    reportError(e, { where: "dashboard/wheel", field: "play_alerts" });
    return Response.json({ error: "save_failed" }, { status: 500 });
  }
  ```
  (la logique de calcul de `period`/`nextDate` du bloc draw reste inchangée, à l'intérieur du `try`). `reportError` importé depuis `@/lib/report`. Ne PAS toucher l'upsert principal ni le repli `/decor_emojis/` (Ask-First).
- `tests/db-errors.test.ts` (nouveau) -- matrice `isMissingColumnError`.
- `tests/wheel-route.test.ts` -- étendre : pour un bloc tolérant (ex. trigger_actions), simuler `{ error: {code:"42703"} }` → route `{ ok: true }` ; `{ error: {code:"23505"} }` → 500 `save_failed`. S'appuyer sur le builder mock existant (`then` résout `{ error }`, cf. `tests/wheel-route.test.ts` / `tests/refund-reconcile.test.ts:185`).

## Tasks & Acceptance

**Execution:**
- [x] `lib/db-errors.ts` -- `isMissingColumnError` (codes 42703 / 42P01 / PGRST204, défensif)
- [x] `app/api/dashboard/wheel/route.ts` -- 4 blocs : inspecter `{ error }` + throw → `reportError` + 500 ; colonne absente → ignoré
- [x] `tests/db-errors.test.ts` -- matrice du helper
- [x] `tests/wheel-route.test.ts` -- colonne absente → ok ; vraie erreur → 500

**Acceptance Criteria:**
- Given une colonne récente absente (migration non appliquée), when le commerçant enregistre, then le bloc est ignoré et l'enregistrement réussit (`{ ok: true }`) — comportement préservé.
- Given une VRAIE erreur d'écriture (RLS, contrainte, connectivité) sur un bloc tolérant, when le commerçant enregistre, then la route renvoie **500 `save_failed`** (plus de faux `{ ok: true }`) et l'erreur est envoyée à `reportError`.
- Given tout se passe bien, when le commerçant enregistre, then la route renvoie `{ ok: true }` (aucune régression).

## Design Notes

- **Pourquoi `error.code` et pas le message :** le message est localisé/versionné (fragile) ; le code PostgREST/Postgres est stable. On remplace la logique `catch {}` inopérante par une inspection du code.
- **Échec partiel assumé :** ces 4 updates portent sur des colonnes de la MÊME ligne, après l'upsert principal. Une vraie erreur est quasi toujours systémique (RLS/connectivité) → tous les blocs échoueraient pareil ; surfacer un 500 au premier est honnête (le commerçant réessaie ; les updates sont idempotents). L'ancien silence était le vrai danger.
- **Story 2 (reportée) :** ≈16 autres sites (onboarding, unsubscribe, orders, connect, webhook/cron…) — pour webhook/cron le fix sera `reportError` sans 500 (200 by-design).

## Suffix — Post-Review Fix

Revue adversariale : **aucun défaut fix-now** (correctness/sécurité). Confirmé : le silent-lost-save est fermé, la tolérance migration est préservée par le **bon** code (`PGRST204` couvre la fenêtre « cache de schéma PostgREST périmé » ; `42703` le « pas encore migré »), aucun code réel (RLS `42501`, contraintes `23xxx`) ne collisionne avec l'ensemble toléré. Échec partiel jugé acceptable (updates idempotents par `business_id` → le ré-enregistrement converge). **Polish appliqué (tests)** : ajout des cas `PGRST204` (toléré), `42501` RLS → 500, **exception jetée → capturée → 500** (le chemin `catch`, non couvert auparavant), et clarification que la « vraie erreur » 500 se déclenche au 1er bloc (blocs structurellement identiques). `detail: error.message` conservé (cohérent avec le `config_error` existant ; route commerçant authentifiée, message = métadonnée de schéma). **Reporté (Story 2)** : appliquer le helper aux ~16 autres sites + convertir les replis message-regex.

## Suggested Review Order

- Helper pur : lit `error.code`, ensemble des codes « absent », défensif.
  [`db-errors.ts:18`](../../lib/db-errors.ts#L18)
- Motif appliqué aux 4 blocs tolérants (colonne absente ignorée ; sinon reportError + 500).
  [`wheel/route.ts:155`](../../app/api/dashboard/wheel/route.ts#L155)
- Tests : matrice helper + tolérance/vraie erreur/RLS/throw au niveau route.
  [`wheel-route.test.ts:81`](../../tests/wheel-route.test.ts#L81)

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: 0 erreur
- `npm run lint` -- expected: 0 warning
- `npm test` -- expected: tous verts (dont db-errors + wheel-route)
- `npm run build` -- expected: succès
