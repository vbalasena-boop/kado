# Base de données Kado — migrations & CLI Supabase

Le schéma vit dans `supabase/migrations/`, en fichiers SQL numérotés
séquentiellement (`0001_init.sql` → `0044_…`). Deux façons de les appliquer.

## Option A — CLI Supabase (recommandé)

La CLI applique les migrations **en attente** et garde un **suivi de version** (table
`supabase_migrations.schema_migrations`), ce qui supprime l'incertitude « quelles
migrations ont déjà tourné ? ».

```bash
# 1. Installer la CLI (une fois) — voir https://supabase.com/docs/guides/cli
brew install supabase/tap/supabase        # ou : npm i -g supabase

# 2. Lier le projet hébergé (une fois). Le ref est dans l'URL du dashboard.
supabase link --project-ref <ton-project-ref>

# 3. Voir l'état (local vs distant)
supabase migration list

# 4. Appliquer les migrations en attente au projet lié
supabase db push
```

### Première adoption sur une base DÉJÀ migrée à la main

Si les migrations `0001`→`0044` ont été appliquées manuellement (SQL Editor),
la table de suivi de la CLI est vide : `db push` croirait devoir tout rejouer.
On marque donc l'historique comme **déjà appliqué**, une seule fois :

```bash
supabase migration repair --status applied \
  0001 0002 0003 0004 0005 0006 0007 0008 0009 0010 0011 \
  0012 0013 0014 0015 0016 0017 0018 0019 0020 0021 0022 \
  0023 0024 0025 0026 0027 0028 0029 0030 0031 0032 0033 \
  0034 0035 0036 0037 0038 0039 0040 0041 0042 0043 0044
supabase migration list   # tout doit être aligné (Local ✓ / Remote ✓)
```

Ensuite, `db push` n'appliquera plus que les migrations réellement nouvelles.

### Créer une nouvelle migration

Conserver la **convention numérique séquentielle** (prochain numéro libre, ex.
`0045_ma_feature.sql`) pour rester cohérent avec l'historique et garder un ordre
d'application non ambigu.

```bash
# Édite directement un nouveau fichier supabase/migrations/00XX_nom.sql
# (le nom peut aussi être généré par : supabase migration new nom — mais il
#  utilise un préfixe horodaté ; préfère la numérotation séquentielle ici.)
```

## Option B — SQL Editor (manuel, historique)

Coller le contenu des fichiers dans **Dashboard → SQL Editor**, dans l'ordre
croissant. Sans suivi de version : à réserver au tout premier bootstrap ou à un
correctif ponctuel.

## Règles

- **Idempotence** : toute migration doit être ré-exécutable sans erreur
  (`create table if not exists`, `add column if not exists`, `create index if not
  exists`, `create or replace function`, `drop policy if exists` avant
  `create policy`). C'est déjà le cas de l'historique — le rester.
- **Ne pas réécrire** une migration déjà appliquée en production : ajouter une
  nouvelle migration plutôt que d'éditer une ancienne (sinon le suivi de version
  de la CLI se désynchronise).
- **Un numéro = un fichier** : pas de collision de préfixe.

## Shims de compatibilité `42703`

Historiquement, faute d'outil garantissant l'application des migrations, le code
portait des **béquilles défensives** : replis sur l'erreur Postgres `42703`
(colonne inexistante) et `try/catch { /* colonne absente */ }`.

**Fait** (après vérification que les 66 colonnes attendues existent en prod) : les
**5 fallbacks `42703` explicites** ont été retirés — `app/api/play/route.ts`
(sélection lots + insert `is_losing`), `app/api/dashboard/redeem/route.ts`
(`is_losing`), `lib/prizes.ts`. Le chemin de code n'est plus doublé pour ces
colonnes.

**Conservé volontairement** : les `try/catch` mous (`lib/campaigns.ts`,
`app/[slug]/commander/page.tsx`, webhook, etc.) qui protègent aussi contre des
erreurs runtime légitimes, pas seulement l'absence de colonne. À réévaluer au cas
par cas, pas en bloc — le gain (simplicité) ne justifie pas le risque tant que la
distinction colonne-absente / erreur-réelle n'est pas triée.
