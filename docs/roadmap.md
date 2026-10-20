# Roadmap — Kado

> Mise à jour le 2026-10-20 (remplace la version BMAD du 2026-08-14, devenue obsolète).
> Vérifié par lecture du code, pas par test en production.

## Livré ✅

- **Jeu public** : roue, carte à gratter, machine à sous ; tirage et anti-triche côté serveur ; limite de requêtes sur `/api/play` ; mode test.
- **Cadeaux** : code de retrait, validation en caisse (atomique), expiration configurable par commerce (`prize_validity_days`) et affichée au joueur.
- **Espace commerçant** : éditeur de jeu, QR code aux couleurs du commerce, fidélité, commandes click & collect et comptoir, produits, horaires, notifications, facturation.
- **Monétisation** : Stripe (abonnements, Connect pour les commandes), page tarifs.
- **Croissance** : collecte de contacts avec consentement, exports CSV (stats, parcours, contacts), campagnes e-mail, SMS, push, parrainage.
- **Admin / vendeurs / prospection**, site public (blog, témoignages, pages légales).
- **Base de données** : migrations rejouables sur une base vierge (`scripts/relais/migrations-base-vierge.sh`).

## À décider (aucun n'est urgent)

| Sujet | Détail |
|---|---|
| Multi-langues | Aucun système de traduction : tout est en français. Gros chantier, à lancer si des clients hors France le demandent. |
| Autres canaux d'avis | Seul Google est géré (TripAdvisor, Facebook…). |

## Petite dette

- Numéros de migration en double (`0041`, `0042`, `0043`) ; les migrations récentes sont horodatées.
- Le build CI échoue parfois au téléchargement de la police Google (Next.js) : héberger la police en local si ça se répète.
- Les index `prospect_*` de `0050` ne sont créés sur base neuve qu'en rejouant `0050` après les migrations horodatées.

## Hors périmètre vérifié

Pas de test E2E ni de test de charge faits lors de cette mise à jour.
