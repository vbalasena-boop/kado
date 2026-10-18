---
title: "Clôture du backlog différé Kado"
status: done
---

# Clôture du backlog différé Kado

**Agent :** codex  
**Niveau :** moyen  
**Priorité :** haute

## Décision

Réviser les constats reportés par rapport au code actuel, corriger les risques concrets sans rouvrir les décisions produit/RGPD explicitement gelées, puis valider l'application et le build.

## Correctifs livrés

- `/api/loyalty/extra` refuse une réactivation marketing quand `unsubscribed_at` est encore renseigné ; seul le parcours de confirmation de réabonnement peut retirer cette protection.
- Migration `0085_reconcile_legacy_wheel_actions.sql` retire Instagram des actions de jeu des établissements qui l'avaient désactivé dans l'ancien modèle, tout en préservant fidélité et opt-in.
- Migration `0086_order_cancel_notification_timestamp.sql` ajoute `notified_cancelled_at` ; l'API l'écrit seulement après l'envoi confirmé d'un e-mail ou d'une notification push d'annulation.
- La réconciliation Stripe vérifie le montant de la commande avant de marquer un refund `succeeded` comme total. Les refunds partiels restent non marqués comme remboursés intégralement.
- La FAQ Google, le gating fidélité et la purge à trois ans étaient déjà présents dans le code/migrations et ne nécessitaient pas de nouveau changement.

## Vérification

- `npm test` : 688 tests réussis.
- `bash scripts/relais/verifier.sh` : réussi (tests, lint et TypeScript).
- `npm run build` : réussi avant les derniers garde-fous de réconciliation ; rebâtir après ces changements avant publication.

## À faire lors du déploiement

Appliquer les migrations `0085` et `0086` à Supabase avant ou avec le déploiement applicatif. Les décisions de collecte de métadonnées de consentement et de déduplication générique Stripe restent des choix distincts, non requis pour fermer les risques corrigés ici.

## Reprise

- Fait : correctifs de consentement, migration des anciennes actions, horodatage d'annulation et garde refunds partiels.
- Reste : déployer le code et appliquer les migrations 0085–0086 sur Supabase.
- Prochaine commande : `bash scripts/relais/verifier.sh` puis publication sur la branche de travail.
