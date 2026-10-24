---
title: 'Beeper virtuel : prévenir le client que sa commande est prête (pilote 1 commerce)'
type: 'feature'
created: '2026-10-24'
status: 'review'
context: []
---

**Agent :** codex
**Niveau :** complexe
**Priorité :** normale

## Objectif

Le client scanne un QR code au comptoir, reçoit un numéro de beeper sans compte ni e-mail, et sa page change (vibration + son) quand le commerçant marque la commande « prête ». Pilote sur un seul commerce, sans SMS ni push.

## Critères vérifiables

- [x] Scan du QR du commerce (`/b/<slug>`) → un numéro (ex. 1 à 99, remis à zéro chaque jour, unique parmi les commandes actives du commerce) est attribué et affiché ; un cookie évite d'en créer un second sur le même appareil tant que la commande est active.
- [x] Page client : état « En préparation » / « Prête », rafraîchie automatiquement (Supabase Realtime ou interrogation toutes les 5 s), vibration + son + écran maintenu allumé (Wake Lock) quand elle passe à « Prête » ; message clair si l'appareil ne permet pas l'alerte.
- [ ] Tableau de bord du commerçant (`dashboard`) : liste des numéros actifs, bouton « Prête » puis « Récupérée » ; seul le commerçant propriétaire peut changer l'état (RLS Supabase testée).
- [x] Sur la page client, pendant l'attente : lien vers le jeu et vers l'avis Google existants du commerce.
- [x] Limite anti-abus : au plus N numéros actifs par commerce et par appareil/IP par heure (N = 3), purge des commandes de plus de 24 h.
- [x] Migration SQL dans `supabase/migrations/`, RLS activée, aucune donnée personnelle stockée.
- [x] Tests unitaires (attribution du numéro, transitions d'état) + une spec E2E : scan → numéro → « Prête » vu côté client. `scripts/relais/verifier.sh` OK.

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

## Implémentation et validation

- Activer uniquement le commerce pilote via `BEEPER_PILOT_SLUG=<slug>` côté serveur. Sans cette variable, les pages et API beeper sont fermées. Appliquer `supabase/migrations/20261024120000_beeper.sql` avant activation.
- Depuis `/dashboard`, ouvrir « Beeper virtuel : numéros et QR » (`/dashboard/beeper`). Le générateur QR existant (`qrcode`) encode `/b/<slug>` ; téléchargement PNG disponible. Les parcours jeu/avis restent inchangés.
- Attribution transactionnelle avec verrou du commerce, index uniques pour numéros et appareils actifs, séquence UTC 1–99, reprise par cookie HttpOnly. Capacité : 99 actifs par commerce ; trois créations par heure glissante, par commerce et appareil **ou** IP, y compris après récupération. Seuls les HMAC et identifiants aléatoires sont conservés, jamais les IP brutes ou coordonnées client.
- Interrogation toutes les 5 s ; activation audio par geste utilisateur, vibration et Wake Lock avec messages de repli. L’alerte n’est pas garantie lorsque la page est en arrière-plan. Les commandes de plus de 24 h sont exclues des lectures et purgées à la création et par le cron quotidien.
- Modifications commerçant via le client Supabase de session (RLS), droits limités à la colonne `status`, contrôle propriétaire en base et trigger des transitions. Test SQL propriétaire/autre commerce/anonyme fourni dans `supabase/tests/beeper.sql`.
- **Validé :** 13 tests unitaires ciblés (routes publiques, cookies, quotas, authentification et transitions), `scripts/relais/verifier.sh` complet (unitaires, lint, TypeScript). Tests SQL d’attribution, unicité, quota IP/appareil, capacité, transitions, remise à zéro et purge exécutés sur PostgreSQL 16 autonome, sans erreur.
- **Reste à valider :** RLS sur une vraie connexion PostgreSQL (`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/beeper.sql`). Le bac à sable interdit les sockets PostgreSQL ; le mode autonome désactive la RLS et ne permet donc pas de la certifier. Le critère dashboard reste ouvert uniquement pour cette validation.
- Spec `e2e/beeper.spec.js` fournie, **non exécutée** conformément à la demande. Configurer `BEEPER_PILOT_SLUG` et `E2E_MERCHANT_STORAGE_STATE` (session du propriétaire de test). Le dépôt n’avait pas de dépendance Playwright et son paquet n’est pas en cache : l’environnement autopilote doit fournir `@playwright/test` (par exemple `npm install --no-save --package-lock=false @playwright/test`) et son navigateur, puis lancer `scripts/relais/e2e.sh e2e/beeper.spec.js`. Utiliser exclusivement une base de test avec quota disponible.

## Reprise

- Fait : relecture des différences et de tous les nouveaux fichiers contre chaque critère ; aucun défaut confirmé nécessitant une correction du code ; `scripts/relais/verifier.sh` relancé et OK (unitaires, lint, types) ; aucun commit/push.
- Reste : appliquer la migration sur la base de test, valider réellement la RLS (critère dashboard toujours ouvert), puis exécuter les E2E via l’autopilote ; Playwright non lancé pendant cette relecture ; configurer le slug pilote au déploiement.
- Prochaine commande : `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/beeper.sql` sur une base de test migrée, puis E2E selon les prérequis ci-dessus.
