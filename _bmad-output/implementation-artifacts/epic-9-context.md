# Epic 9 Context: Conformité avis & actions déclenchantes du jeu

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Découpler la récompense du jeu de l'action « avis Google » (décision produit **option A**,
prise sur la base d'une recherche conformité) et rendre **configurable** l'action qui
débloque chaque tour. Aujourd'hui, un tour se débloque en ouvrant la page d'avis Google —
ce qui s'apparente à un avis incité et expose la **fiche Google du commerçant** à la
suppression rétroactive d'avis. Après cet epic, les tours se débloquent uniquement par des
**actions non-avis** (suivi Instagram, inscription fidélité, opt-in offres) et l'avis
Google devient un **CTA optionnel non récompensé**. Bénéfice : protéger le commerçant et
offrir un argument commercial (« Kado ne met pas vos avis en danger »).

## Stories

- Story 9.1: Configurer les actions déclenchantes (non-avis)
- Story 9.2: Débloquer les tours par des actions non-avis
- Story 9.3: Avis Google en CTA neutre non récompensé
- Story 9.4: Migrer les configurations « avis » existantes

## Requirements & Constraints

- La récompense du jeu ne doit **jamais** être conditionnée à un avis (écriture ou note).
- Le commerçant choisit quelles actions non-avis débloquent les tours ; **au moins une
  action reste active** en permanence (garde-fou anti-blocage du jeu).
- La configuration est **persistée** au niveau de l'établissement (table `wheel_configs`,
  1-1 avec `businesses`).
- L'avis Google reste proposé à **tous les clients, au neutre** (pas de *review gating*).
- Rétrocompatibilité : les établissements configurés aujourd'hui avec l'action « avis »
  doivent basculer proprement (story 9.4) sans casser leur page de jeu.

## Technical Decisions

- App **Next.js 14 App Router** (brownfield). La page de jeu publique `/{slug}` est un
  Server Component qui lit `wheel_configs` (avec cache `unstable_cache` + invalidation par
  tag `biz-<slug>` à l'édition). Le composant de jeu est **client** (`Game.tsx`).
- Les **routes API** utilisent le wrapper `lib/api.ts` (`merchantRoute` + schéma zod) ;
  l'édition de la roue passe par `POST /api/dashboard/wheel` (upsert `wheel_configs`,
  `revalidateTag`). L'éditeur commerçant est `app/dashboard/wheel/WheelEditor.tsx`.
- Toute nouvelle colonne = **migration SQL** idempotente (`add column if not exists`),
  numérotation séquentielle (**prochaine = 0045**), appliquée via la CLI Supabase.
- Les lectures de `wheel_configs` côté serveur restent tolérantes (repli global si une
  colonne récente manque) — cf. patterns existants.
- **Tests** : vitest (logique pure) ; valider `tsc` (strict), `eslint`, `build`.

## UX & Interaction Patterns

- La story 9.1 ajoute, dans `WheelEditor`, une section « Actions qui débloquent un tour »
  avec des interrupteurs pour Instagram / Fidélité / Opt-in offres (pas d'avis). L'UI doit
  empêcher de tout désactiver (au moins une active).
- Les stories 9.2/9.3 (hors périmètre de 9.1) toucheront la présentation côté joueur.

## Cross-Story Dependencies

- 9.2 dépend de 9.1 (la config des actions doit exister avant de l'appliquer au jeu).
- 9.3 est indépendante (présentation de l'avis). 9.4 (migration) s'appuie sur le schéma
  introduit en 9.1.
