# Architecture — Kado

> Mise à jour **2026-08-24** (audit technique BMAD). Ce document remplace la v0.1
> qui ne décrivait que le MVP « roue ». Il reflète le produit réel : jeux,
> fidélité, click & collect, comptoir (bipeur digital), affiliation vendeurs,
> campagnes et paiements Stripe.

---

## 1. Vue d'ensemble

Application **fullstack Next.js 14** (App Router) déployée sur **Vercel**, adossée
à **Supabase** (Auth + Postgres + Storage). Architecture **multi-tenant** : un seul
déploiement sert tous les établissements, isolés par `business_id`.

```
   Client final (mobile)         Commerçant                Admin (toi)          Vendeur
        │                            │                         │                    │
        ▼                            ▼                         ▼                    ▼
  /{slug}  (public)         /dashboard (privé)         /admin (privé)        /vendeur/{key}
  jeu · fidélité · commande  config · stats · commandes  comptes · vendeurs   stats affilié
        │                            │                         │                    │
        └──────────────────► Next.js (Vercel) ◄───────────────┴────────────────────┘
                     Server Components + Route Handlers (API)
                                    │
             ┌──────────────────────┼───────────────────────┬──────────────┐
             ▼                      ▼                        ▼              ▼
       Supabase Auth      Supabase Postgres (RLS)     Stripe          Resend / web-push
       (OTP e-mail)       + Storage (logos/photos)  abonnements       e-mails / notifs
                                                    + Connect
```

## 2. Stack

| Couche | Choix | Rôle |
|---|---|---|
| Framework | Next.js 14 (App Router) | SSR, Route Handlers, déploiement Vercel |
| Auth | Supabase Auth (OTP e-mail) | Connexion commerçant / admin |
| Base | Supabase Postgres + RLS | Multi-tenant, 15 tables |
| Stockage | Supabase Storage (buckets publics) | Logos, fonds de roue, photos produits |
| Paiement | Stripe (abonnements + **Connect**) | Formules commerçant + encaissement click & collect |
| E-mail | Resend | Transactionnel + marketing (campagnes, anniversaires) |
| Push | web-push (VAPID) | Alertes commerçant + offres clients |
| Observabilité | Sentry (+ Vercel Analytics) | Erreurs serveur & client |
| Cron | Vercel Cron | Tâches quotidiennes (voir §7) |

## 3. Modèle de données (15 tables, toutes en RLS)

**Cœur tenant**
- `businesses` — l'établissement (tenant). Slug public, statut, plan
  (`roue`/`fidelite`/`complet`/`comptoir`), abonnement Stripe, options
  (`click_collect`, `order_tracking`, `online_payment`), compte Connect.
- `wheel_configs` — configuration 1-1 du commerce (couleurs, canaux IG/avis,
  fidélité, tirage au sort, décor, validité des lots…).
- `prizes` — lots de la roue (libellé, poids, `is_losing`).
- `plays` — tours joués (verrou serveur `unique(business_id, player_id, play_type)`,
  code de lot, `redeemed_at`).

**Fidélité & croissance**
- `loyalty_cards` — carte à tampons par (business, e-mail), code unique,
  consentement marketing, anniversaire.
- `leads` — e-mails capturés (participants tirage, marketing).
- `campaigns` — campagnes e-mail/push programmées, envoi étalé.

**Commandes (click & collect / comptoir)**
- `products` — catalogue (prix, photo, actif).
- `orders` — commandes (code de retrait, lignes, total, statut, paiement,
  mode de service, bipeur).

**Affiliation vendeurs**
- `affiliates` — apporteurs d'affaires (barèmes de commission, `stats_key`).
- `affiliate_commissions` — commissions dues (une par premier paiement client).

**Notifications & système**
- `push_subscriptions` — abonnements push des commerçants.
- `client_push_subscriptions` — abonnements push des clients (offres, commande prête).
- `rate_limits` — support de la RPC `rate_limit_hit` (limitation de débit atomique).
- `system_state` — état interne (heartbeats cron, health-check).

## 4. Isolation multi-tenant (important)

Le point clé, différent de la v0.1 du document : **toutes les 15 tables ont la RLS
activée sans policy** → « default-deny » pour `anon`/`authenticated`. Concrètement,
**personne n'accède aux données via la clé publique**.

Les accès applicatifs passent par le **client `service_role`** (`lib/supabase/admin.ts`),
qui **contourne la RLS**. L'isolation tenant repose donc sur une **discipline
applicative** : chaque requête filtre explicitement par `.eq("business_id", …)`
(dérivé côté serveur du compte connecté, jamais de l'entrée client).

Trois clients Supabase, usage strict :
- `admin.ts` (service_role) — toutes les lectures/écritures de données.
- `ssr.ts` (session cookie) — identifie l'utilisateur connecté (`auth.getUser()`).
- `client.ts` (anon, navigateur) — uniquement le flux de connexion.

> Risque assumé : un oubli de filtre `business_id` = fuite cross-tenant. Piste
> d'évolution : réintroduire des policies RLS et lire via `ssr` pour les données
> tenant. En attendant, le **wrapper de route** (§5) et les tests réduisent le risque.

## 5. Couche API & conventions

Les Route Handlers (`app/api/**`) suivent un **wrapper commun** `lib/api.ts` :
`publicRoute` / `merchantRoute` / `adminRoute`. Il centralise le garde d'auth, le
parsing + la **validation zod** du corps, le rate-limit optionnel et le format
d'erreur (`{ error: "code" }`). Migration incrémentale en cours (routes historiques
encore en parsing manuel, comportement identique).

- **Auth commerçant** : `getMyBusiness()` → établissements dont
  `owner_user_id = auth.uid()`.
- **Auth admin** : `getAdminUser()` → e-mail dans `ADMIN_EMAILS`.
- **Rate-limit** : RPC Postgres atomique `rate_limit_hit`, avec **repli mémoire**
  si la RPC échoue (jamais « fail-open »).
- **TypeScript** : `strict: true`.

## 6. Intégrations

- **Stripe abonnements** : formules commerçant. Le webhook
  (`/api/billing/webhook`) vérifie la **signature** et applique l'état à
  `businesses` (plan, statut, échéance).
- **Stripe Connect** : encaissement en ligne du click & collect — l'argent va
  directement au compte du commerçant (`payment_intent_data.transfer_data`),
  commission plateforme optionnelle (`KADO_ORDER_FEE_BPS`).
- **Parrainage & affiliation** : gérés dans le webhook au premier paiement
  (récompense parrain, commission vendeur — une seule fois, idempotent).
- **web-push** : alertes commerçant (nouvelle commande) et clients (offres,
  commande prête).
- **Resend** : e-mails transactionnels et marketing (réputations séparées via
  `EMAIL_FROM` / `EMAIL_FROM_MARKETING`).

## 7. Tâches planifiées (Vercel Cron)

`/api/cron/daily` (protégé par `CRON_SECRET`, **obligatoire**) :
1. Relance des essais à J-3.
2. E-mails d'anniversaire (fidélité).
3. Campagnes programmées + envoi étalé (une fournée/jour).
4. Récap hebdomadaire (le lundi).
5. Tirage au sort programmé.

Les boucles d'envoi sont **parallélisées** (concurrence bornée, `lib/async.ts`)
pour tenir dans `maxDuration`. `/api/cron/health` effectue un contrôle de santé.

## 8. Performance

- **Page de jeu `/{slug}`** (chemin critique mobile) : les données statiques
  (établissement + config + lots) sont mises en **cache** (`unstable_cache`,
  revalidation 60 s + invalidation par tag `biz-<slug>` à chaque édition). Les
  tours joués (par joueur) restent hors cache.
- **Pages marketing** (accueil, tarifs) : statiques (SSG), servies CDN.
- **En-têtes de sécurité** globaux (anti-clickjacking, HSTS, nosniff) via
  `next.config.mjs`.

## 9. Migrations

Fichiers SQL numérotés dans `supabase/migrations/`, appliqués via le SQL Editor
Supabase. Numérotation unique (les collisions historiques ont été résolues).
Le code reste tolérant aux colonnes récentes (repli si une migration n'est pas
encore appliquée). Piste : adopter la CLI Supabase avec suivi de version.

## 10. Historique

Les documents `brief.md`, `prd.md`, `roadmap.md` datent du cadrage initial (MVP
roue) et sont conservés à titre d'historique — le produit les a largement dépassés.
