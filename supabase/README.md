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

## Plan : retrait des shims de compatibilité `42703`

Tant qu'aucun outil ne garantissait l'application des migrations, le code porte des
**béquilles défensives** : replis sur l'erreur Postgres `42703` (colonne
inexistante) et `try/catch { /* colonne absente */ }`. On les trouve notamment
dans :

- `app/api/play/route.ts` (colonne `is_losing`)
- `app/api/dashboard/redeem/route.ts` (`is_losing`, `prize_validity_days`)
- `lib/orders.ts` / `app/api/order/route.ts` (colonnes commande récentes)
- `lib/prizes.ts`, `lib/campaigns.ts`, `app/[slug]/page.tsx` (lectures tolérantes)

**Une fois la CLI adoptée** et `supabase migration list` confirmant que TOUTES les
migrations sont appliquées (un « socle » de version garanti), ces shims peuvent
être retirés dans une PR dédiée : le schéma est alors garanti complet, et chaque
nouvelle colonne n'a plus à doubler le chemin de code. À faire en une passe,
après vérification `migration list` sur l'environnement de production.
