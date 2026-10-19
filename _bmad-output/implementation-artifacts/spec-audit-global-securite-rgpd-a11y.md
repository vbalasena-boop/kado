---
title: "Audit global sécurité, conformité et qualité Kado"
status: done
---

**Agent :** codex
**Niveau :** complexe
**Priorité :** haute

## Objectif

Auditer le code actuellement déployé de Kado, vérifier ses parcours et risques, corriger les défauts confirmés et documenter les écarts réglementaires qui nécessitent encore une décision ou une preuve externe.

## Critères vérifiables

- Examiner les API, l'authentification, les droits, les données personnelles, les cookies, les paiements et les entrées utilisateur.
- Vérifier les exigences d'accessibilité pertinentes et consigner les limites des parcours non testables.
- Exécuter les tests, le lint, TypeScript et la compilation ; corriger les problèmes reproductibles.
- Produire un rapport avec preuves, sévérité, corrections et points qui demandent une validation juridique ou opérationnelle.

## Fichiers

- Routes et composants de l'application
- `supabase/migrations/`
- `_bmad-output/implementation-artifacts/audit-global-securite-rgpd-a11y.md`

## Reprise

- Fait : corrections locales, tests/lint/TypeScript/build réussis ; migrations de rétention, concurrence, droits, index et `search_path` appliquées et vérifiées sur Supabase (`20261019141139`, `20261019172508`, `20261019172638`).
- Reste : validations juridiques et accessibilité manuelle ; protection des mots de passe compromis indisponible sur l'offre Supabase gratuite ; pas de test de restauration ni de parcours authentifié en préproduction.
- Prochaine commande : `bash scripts/relais/verifier.sh`, puis publier après contrôle des changements et vérifier le déploiement Vercel.
