---
title: "Migrations rejouables sur une base vierge"
status: ready-for-dev
---

# Migrations rejouables sur une base vierge

**Agent :** codex  
**Niveau :** complexe  
**Priorité :** normale

## Objectif

Une base Supabase neuve doit pouvoir être construite en appliquant `supabase/migrations/` dans l'ordre, sans erreur. Production existe déjà : aucune migration modifiée ne doit changer son état (tout doit rester idempotent, `if not exists`).

## Contexte

- PR vbalasena-boop/kado#209 ajoute `0002_plays_redeemed_at.sql` (colonne créée à la main en prod). Avant de commencer : `git checkout origin/fix/migration-plays-redeemed-at -- supabase/migrations/0002_plays_redeemed_at.sql` (ne pas la recréer ; disparaît du diff une fois #209 fusionnée).
- Banc d'essai : `scripts/relais/migrations-base-vierge.sh` (Postgres 16 local, stubs auth/storage). Sortie 1 tant qu'une migration échoue.
- Erreurs connues restantes :
  1. `0011_growth.sql` : `alter table leads` alors que `leads` est créée en `0017_leads.sql`.
  2. `0050_perf_indexes.sql` : index sur `prospect_messages` / `prospect_events`, créées dans `20261019135753_legacy_prospection.sql`.

## Critères vérifiables

- [ ] `bash scripts/relais/migrations-base-vierge.sh` sort 0 (aucune erreur).
- [ ] Les correctifs sont idempotents (`if not exists`, blocs gardés) : rejouer une migration sur une base déjà à jour ne change rien.
- [ ] Préférer déplacer/garder les statements (ex. `to_regclass(...) is not null`) plutôt que renommer des fichiers déjà appliqués en prod : le suivi `supabase_migrations` repose sur les noms de fichiers.
- [ ] Documenter le choix dans `supabase/README.md` (3 lignes) et mentionner le script.
- [ ] `bash scripts/relais/verifier.sh` OK.

## Fichiers

`supabase/migrations/0011_growth.sql`, `supabase/migrations/0050_perf_indexes.sql`, `supabase/README.md`, `scripts/relais/migrations-base-vierge.sh`.

## Contraintes

Ne pas toucher aux autres migrations ni au code applicatif. Sécurité base de données : `CHEMINS_SENSIBLES` → l'autopilote ouvrira une PR brouillon, Claude relit.

## Reprise

- Fait : banc d'essai écrit, deux erreurs identifiées.
- Reste : corriger 0011 et 0050, documenter.
- Prochaine commande : `bash scripts/relais/migrations-base-vierge.sh`
