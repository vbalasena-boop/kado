---
title: "Page tarifs : prix réel lisible et comparaison"
status: ready-for-dev
---

# Page tarifs : prix réel lisible et comparaison

**Agent :** codex  
**Niveau :** moyen  
**Priorité :** normale

## Objectif

Étude concurrence (20/10/2026) : Kado est au plancher du marché (Jeux 29 €, Fidélité 19 €, Complet 44 € vs 55 à 80 € pour Jeux + Fidélité chez les concurrents), mais la page ne le montre pas. Rendre le prix réel et l'économie évidents. Aucun prix ni logique de facturation modifié.

## Critères vérifiables

- [x] Sur `Complet`, afficher « Tout inclus : jeux, fidélité, commande en ligne, bipeur » et une ligne « Jeux + Fidélité séparément chez d'autres éditeurs : 55 à 80 €/mois » (formulation factuelle, sans nommer de concurrent).
- [x] Mention « Illimité, sans palier de clients ni de joueurs » sur Jeux, Fidélité et Complet.
- [x] Section frais d'installation : ajouter « Offerts avec un abonnement annuel » uniquement si cela existe déjà côté facturation ; sinon ne rien promettre et le noter dans « Reprise ».
- [x] Aucun changement de prix, de Stripe ni de `app/api/billing/*`.
- [ ] `bash scripts/relais/verifier.sh` OK.

## Fichiers

- `app/tarifs/page.tsx` (tableau `PLANS`, ligne ~24, et note sous les plans, ligne ~193)

## Reprise

Fait : mentions ajoutées sur les trois formules ; aucune offre annuelle trouvée côté facturation, donc aucune gratuité d'installation promise. Tests : 707/707 via configuration Vitest temporaire, lint et TypeScript OK.
Reste : `bash scripts/relais/verifier.sh` à relancer hors bac à sable (Vitest ne peut pas écrire dans `node_modules/.vite-temp`, lien vers un répertoire externe en lecture seule). E2E à lancer par Claude.
Prochaine commande : `bash scripts/relais/verifier.sh`.
