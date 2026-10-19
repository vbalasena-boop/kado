# Kado 🎁

Kado est un SaaS pour commerces de proximité. Il regroupe des outils de jeu et de fidélité, la gestion des cadeaux, la collecte de contacts avec consentement, les commandes click & collect et au comptoir, ainsi que la gestion d'abonnements.

## Fonctionnalités présentes dans le dépôt

- **Jeu public** sur `/{slug}` : roue et cadeaux tirés côté serveur, code de retrait, limites de jeu et de cadeaux.
- **Avis Google** : lien facultatif et neutre, indépendant du jeu et de toute récompense. Un avis ne débloque jamais de tour. Ne conditionnez jamais un cadeau à la publication ou à la note d'un avis.
- **Espace commerçant** : configuration de la roue, QR code, cadeaux, fidélité, commandes, produits, horaires, notifications et facturation.
- **Commandes** : click & collect et suivi au comptoir; paiement en ligne via Stripe Connect lorsque configuré.
- **Espace admin et vendeurs** : gestion des établissements, abonnements, vendeurs et outils internes de prospection.
- **Site public** : tarifs, témoignages, blog et pages légales.

Le prototype statique de roue reste disponible dans `prototype/roue.html`. La documentation de cadrage se trouve dans `docs/`.

## Stack et scripts

- Next.js 14 (App Router), React 18 et TypeScript
- Supabase Auth et Postgres, avec migrations dans `supabase/migrations/`
- Stripe pour les abonnements et paiements, Vercel pour l'hébergement et les tâches planifiées

```bash
npm install
npm run dev       # serveur local
npm run lint      # lint Next.js
npm test          # suite Vitest
npm run build     # build de production
```

## Configuration locale

1. Crée un projet Supabase et applique les migrations selon [`supabase/README.md`](supabase/README.md).
2. Copie `.env.example` vers `.env.local` et configure au minimum `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `PLAYER_COOKIE_SECRET` et `NEXT_PUBLIC_SITE_URL`.
3. Configure `ADMIN_EMAILS` pour autoriser l'accès administrateur et les URL de redirection Supabase Auth pour `/auth/callback`.
4. Lance `npm run dev`. Le seed de démonstration est dans `supabase/seed.sql`.

Les intégrations e-mail, Stripe, push, tâches planifiées et prospection ont leurs propres variables documentées dans `.env.example`. N'active en production que les intégrations pour lesquelles les secrets et les réglages fournisseur sont effectivement configurés. La clé Supabase `service_role` est strictement serveur : ne jamais la préfixer par `NEXT_PUBLIC_`.

## Déploiement

Le projet est prévu pour Vercel et Supabase. Configure les variables d'environnement de production à partir de `.env.example`, applique les migrations avant le déploiement applicatif et ajoute les URL de production aux redirections Supabase Auth. `vercel.json` déclare les crons quotidiens; `CRON_SECRET` doit être défini pour que leurs routes restent protégées et puissent s'exécuter.

Pour Stripe, configure les clés et l'URL du webhook `/api/billing/webhook` dans le tableau de bord Stripe, puis renseigne `STRIPE_WEBHOOK_SECRET`. Les parcours de paiement en ligne des commandes nécessitent également Stripe Connect correctement configuré pour l'établissement.

## Structure

```text
app/                    Pages Next.js et routes API
  [slug]/                Jeu public, commande et fidélité
  dashboard/             Espace commerçant
  admin/                 Espace administrateur
  api/                   API publique, commerçant, admin, webhooks et crons
components/              Composants partagés
lib/                     Auth, Supabase, commandes, tirage, e-mail, Stripe…
supabase/migrations/     Évolutions du schéma Postgres
supabase/seed.sql        Données de démonstration
docs/                    Brief, PRD, architecture et notes de projet
tests/                   Tests Vitest
prototype/roue.html      Ancien prototype statique
```

## Données et règles produit

Le service traite notamment des coordonnées de joueurs et de clients qui passent commande. Les collectes marketing doivent rester facultatives et explicites; le lien de désinscription est pris en charge pour les campagnes. Les détails des finalités, durées et droits sont dans [la politique de confidentialité](/legal/confidentialite).

Le jeu et les cadeaux sont découplés des avis Google. Le lien d'avis est une invitation optionnelle, proposée sans filtrage par satisfaction. Voir `docs/prd.md` et `lib/wheel.ts` pour la règle produit et sa garde côté serveur.

## État de la documentation

Les documents `docs/brief.md`, `docs/prd.md` et `docs/architecture.md` décrivent le cadrage initial et peuvent conserver des décisions historiques. En cas d'écart avec le comportement actuel, vérifier le code et les migrations; mettre à jour ces documents lors de toute évolution produit importante.
