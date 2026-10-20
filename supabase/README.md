# Base de données Kado — migrations & CLI Supabase

Le schéma vit dans `supabase/migrations/`. Les migrations numérotées vont de
`0001` à `0087`, mais certains préfixes historiques sont dupliqués (`0041`,
`0042`, `0043`). Les
fichiers sont donc ordonnés par préfixe puis par nom; un préfixe seul ne
constitue pas un identifiant unique de migration. Deux façons de les appliquer.

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

Si des migrations ont été appliquées manuellement (SQL Editor), la table de suivi
de la CLI peut être vide : `db push` pourrait tenter de les rejouer. **Ne lance
pas le bloc `migration repair` ci-dessous à l'aveugle** : l'exemple historique
ci-dessous ne couvre que `0001`→`0044` et l'historique comporte maintenant des
préfixes dupliqués ainsi que `0045` et `0046`. Compare d'abord les fichiers,
l'historique distant et l'état réel du schéma. En cas de doute, fais une
sauvegarde et demande une revue avant de réparer l'historique.

Il n'y a volontairement pas de commande `migration repair` à copier ici : les
préfixes dupliqués empêchent de décrire un historique distant fiable avec une
simple liste de versions. Réconcilie chaque fichier avec le schéma réel, la table
`supabase_migrations.schema_migrations` et la version de la CLI utilisée avant
de réparer ou de lancer `db push`. Pour une base neuve, valide d'abord sur une
base jetable que la CLI reconnaît toutes les migrations locales sans collision.

### Créer une nouvelle migration

L'historique utilise des préfixes numériques courts, mais les collisions
`0041`–`0043` rendent l'ordre par numéro insuffisant et compliquent le suivi de
version Supabase. Avant d'ajouter une migration, vérifier la compatibilité avec
la CLI et le déploiement du projet; utiliser un identifiant unique reconnu par
Supabase, sans renommer les migrations déjà appliquées en production. Documenter
explicitement toute migration manuelle et son état distant.

```bash
# Édite directement un nouveau fichier supabase/migrations/00XX_nom.sql
# (le nom peut aussi être généré par : supabase migration new nom — mais il
#  utilise un préfixe horodaté ; préfère la numérotation séquentielle ici.)
```

Les migrations `0085`–`0087` ont été appliquées au projet de production `kado`
le 18 octobre 2026 et enregistrées dans `supabase_migrations.schema_migrations`.
Elles réconcilient les anciennes actions Instagram, ajoutent l'horodatage de
notification d'annulation et les champs d'audit des remboursements.

La migration `0084_one_time_game_passes.sql` avait ajouté un système de codes
de jeu à usage unique, appliqué au projet de production `kado` le 18 octobre
2026. Le parcours a depuis été retiré car trop complexe pour les commerces. La
table, la colonne et la fonction restent inactives dans le schéma : elles sont
conservées pour éviter une suppression de données ou un changement destructif.

## Option B — SQL Editor (manuel, historique)

Coller le contenu des fichiers dans **Dashboard → SQL Editor**, dans l'ordre
croissant. Sans suivi de version : à réserver au tout premier bootstrap ou à un
correctif ponctuel.

## Règles

Compatibilité base vierge : `0011` et `0050` gardent leurs noms et protègent les tables tardives par `to_regclass`, avec des ajouts `if not exists`.
`0017` crée déjà `leads.unsubscribed_at` ; rejouer `0050` après les migrations horodatées ajoute les deux index facultatifs de prospection ignorés au premier passage.
Vérification locale jetable, sans accès à la production : `bash scripts/relais/migrations-base-vierge.sh`.

- **Idempotence** : toute migration doit être ré-exécutable sans erreur
  (`create table if not exists`, `add column if not exists`, `create index if not
  exists`, `create or replace function`, `drop policy if exists` avant
  `create policy`). C'est déjà le cas de l'historique — le rester.
- **Ne pas réécrire** une migration déjà appliquée en production : ajouter une
  nouvelle migration plutôt que d'éditer une ancienne (sinon le suivi de version
  de la CLI se désynchronise).
- **Pas de nouvelle collision** : les doublons historiques `0041`–`0043` doivent
  être traités comme une dette de migration, pas reproduits.

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
