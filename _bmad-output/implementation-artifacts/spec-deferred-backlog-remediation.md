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
- Les migrations `0085`–`0087` sont appliquées et enregistrées dans Supabase : migration des actions Instagram (0 ancien commerce à corriger), `notified_cancelled_at`, et audit `refunded_by` / `refund_reason`.
- L'API d'annulation n'écrit `notified_cancelled_at` qu'après l'envoi confirmé d'un e-mail ou d'une notification push.
- La réconciliation Stripe vérifie le montant de la commande avant de marquer un refund `succeeded` comme total. Les refunds partiels restent non marqués comme remboursés intégralement.
- Le refund manuel informe le client par e-mail et les demandes manuelles/annulations stockent l'acteur et un motif normalisé.
- Les liens de désinscription affichent maintenant une confirmation en GET ; seul le POST explicite modifie le consentement. Le réabonnement revalide aussi le statut actif du commerce.
- Le plafond quotidien de secours ignore les anciens tours `review`. `RESUB_SECRET` peut isoler les signatures de réabonnement ; sans cette variable facultative, les liens existants restent compatibles.
- La FAQ Google, le gating fidélité et la purge à trois ans étaient déjà présents dans le code/migrations et ne nécessitaient pas de nouveau changement.

## Vérification

- `npm test` : 72 fichiers, 693 tests réussis.
- `bash scripts/relais/verifier.sh` : réussi (tests, lint et TypeScript).
- `npm run build` : réussi.

## À faire lors du déploiement

Les migrations `0085`–`0087` ont été appliquées et vérifiées sur Supabase. Le déploiement applicatif doit être relancé avec le commit final.

Les choix de collecte d'IP/User-Agent restent refusés par minimisation des données. L'accusé de réception du bandeau reste local au navigateur pour ne pas créer de suivi centralisé. La déduplication générique de chaque événement Stripe et le secret `RESUB_SECRET` configuré en production restent des optimisations facultatives.

## Reprise

- Fait : correctifs du backlog et migrations 0085–0087 appliquées/enregistrées sur Supabase.
- Reste : publier le commit final et confirmer Vercel.
- Prochaine commande : vérifier le statut de déploiement après publication.
