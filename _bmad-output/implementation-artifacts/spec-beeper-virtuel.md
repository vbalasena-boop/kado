---
title: 'Beeper virtuel : prévenir le client que sa commande est prête (pilote 1 commerce)'
type: 'feature'
created: '2026-10-24'
status: 'ready-for-dev'
context: []
---

**Agent :** autopilote
**Niveau :** complexe
**Priorité :** normale

## Objectif

Le client scanne un QR code au comptoir, reçoit un numéro de beeper sans compte ni e-mail, et sa page change (vibration + son) quand le commerçant marque la commande « prête ». Pilote sur un seul commerce, sans SMS ni push.

## Critères vérifiables

- Scan du QR du commerce (`/b/<slug>`) → un numéro (ex. 1 à 99, remis à zéro chaque jour, unique parmi les commandes actives du commerce) est attribué et affiché ; un cookie évite d'en créer un second sur le même appareil tant que la commande est active.
- Page client : état « En préparation » / « Prête », rafraîchie automatiquement (Supabase Realtime ou interrogation toutes les 5 s), vibration + son + écran maintenu allumé (Wake Lock) quand elle passe à « Prête » ; message clair si l'appareil ne permet pas l'alerte.
- Tableau de bord du commerçant (`dashboard`) : liste des numéros actifs, bouton « Prête » puis « Récupérée » ; seul le commerçant propriétaire peut changer l'état (RLS Supabase testée).
- Sur la page client, pendant l'attente : lien vers le jeu et vers l'avis Google existants du commerce.
- Limite anti-abus : au plus N numéros actifs par commerce et par appareil/IP par heure (N = 3), purge des commandes de plus de 24 h.
- Migration SQL dans `supabase/migrations/`, RLS activée, aucune donnée personnelle stockée.
- Tests unitaires (attribution du numéro, transitions d'état) + une spec E2E : scan → numéro → « Prête » vu côté client. `scripts/relais/verifier.sh` OK.

## Fichiers (à confirmer par lecture ciblée)

- `supabase/migrations/` (nouvelle table `beeper_orders`)
- `app/b/[slug]/page.tsx` (page client, nouvelle)
- `app/api/beeper/` (création, lecture d'état, changement d'état)
- `app/dashboard/` (liste + boutons)
- Réutiliser le QR existant et les liens jeu/avis déjà présents dans `app/[slug]`.

## Contraintes

- Ne pas toucher au parcours de jeu/avis existant, sauf pour y ajouter le lien depuis la page beeper.
- Pas de SMS, pas de notification push, pas de compte client.
- Style et composants existants du dashboard.

## Reprise

- Fait : fiche écrite.
- Reste : tout (migration, API, page client, dashboard, tests).
- Prochaine commande : `python3 scripts/relais/etat.py meta beeper-virtuel`, puis implémenter.
