# Architecture — Kado

> Document produit selon la **BMAD Method** · Rôle : **Architecte** · v0.1 · 2026-08-13
> Sources : `docs/brief.md`, `docs/prd.md`

---

## 1. Vue d'ensemble

Application **fullstack Next.js** (App Router) déployée sur **Vercel**, adossée à
**Supabase** pour l'authentification, la base Postgres et le stockage (logos).
Architecture **multi-tenant** : un seul déploiement sert tous les établissements,
isolés par identifiant de tenant et **Row Level Security** (RLS).

```
        Joueur (mobile)                 Commerçant                 Admin (toi)
             │                              │                          │
             ▼                              ▼                          ▼
   /{slug}  (public)             /dashboard (privé)          /admin (privé)
             │                              │                          │
             └──────────────► Next.js (Vercel) ◄──────────────────────┘
                          Server Components + API Routes
                                     │
                        ┌────────────┴─────────────┐
                        ▼                           ▼
                  Supabase Auth              Supabase Postgres (RLS)
                                             + Storage (logos)
```

## 2. Stack technique

| Couche            | Choix                        | Raison                              |
|-------------------|------------------------------|-------------------------------------|
| Framework         | Next.js 14+ (App Router)     | SSR, API routes, déploiement Vercel |
| Hébergement       | Vercel (offre Hobby)         | Gratuit, CI/CD Git intégré          |
| Auth              | Supabase Auth (e-mail/OTP)   | Gratuit, simple, sessions gérées    |
| Base de données   | Supabase Postgres + RLS      | Multi-tenant sûr, gratuit au départ |
| Stockage          | Supabase Storage             | Logos des établissements            |
| QR code           | lib `qrcode` (génération)    | Pas de service externe              |
| Roue              | Canvas (repris du prototype) | Zéro dépendance lourde              |
| Paiement (v2)     | Stripe                       | Standard abonnement                 |

## 3. Modèle de données

```sql
-- Établissement (tenant)
businesses(
  id uuid pk,
  slug text unique,              -- URL publique /{slug}
  name text,
  logo_url text,
  status text,                   -- 'active' | 'suspended'
  subscription_status text,      -- 'trial' | 'active' | 'suspended'
  owner_user_id uuid,            -- lien vers auth.users
  created_at timestamptz
)

-- Configuration de la roue (1-1 avec business)
wheel_configs(
  id uuid pk,
  business_id uuid fk,
  primary_color text,
  instagram_url text,
  review_url text,
  compliance_note text
)

-- Cadeaux de la roue (n par config)
prizes(
  id uuid pk,
  business_id uuid fk,
  label text,
  emoji text,
  weight int,                    -- probabilité relative
  position int
)

-- Tours joués (verrou serveur des 2 tours)
plays(
  id uuid pk,
  business_id uuid fk,
  player_id text,                -- issu d'un cookie signé
  play_type text,                -- 'instagram' | 'review'
  prize_label text,
  prize_code text,
  created_at timestamptz,
  unique(business_id, player_id, play_type)   -- empêche de rejouer un type
)
```

**RLS** : chaque table filtre sur `business_id` rattaché à `auth.uid()` (le commerçant
ne voit que son établissement). Un rôle **admin** (claim JWT) contourne le filtre pour
la gestion globale. La table `plays` est écrite via une **API route serveur** (clé
service), jamais directement par le client.

## 4. Routes applicatives

**Public**
- `GET /{slug}` — page de jeu (Server Component, charge config si `status = active`).
- `POST /api/play` — enregistre un tour ; refuse si le type est déjà joué (contrainte
  unique) ou si l'établissement est suspendu ; renvoie le lot tiré côté serveur.

**Commerçant (auth requise)**
- `/dashboard` — vue d'ensemble + stats.
- `/dashboard/wheel` — éditeur de roue (aperçu live).
- `/dashboard/qr` — génération/téléchargement du QR.

**Admin (rôle admin requis)**
- `/admin` — liste des comptes, statut, activité.
- `POST /api/admin/business` — créer un compte + inviter le commerçant.
- `POST /api/admin/business/{id}/status` — activer / suspendre.

## 5. Décisions clés

- **Tirage côté serveur** : le lot est déterminé dans `/api/play` (pas dans le navigateur),
  pour éviter la triche et fiabiliser les statistiques. Le front anime seulement la roue
  vers le résultat renvoyé.
- **Verrou robuste** : combinaison `cookie player_id signé` + contrainte SQL `unique`.
  Post-MVP possible : limite par empreinte réseau ou plafond global par établissement.
- **Suspension = un seul champ** : `businesses.status`. Contrôlé à la fois par la page
  publique (masque le jeu) et le middleware d'auth (bloque l'espace). Donner/retirer
  l'accès = basculer ce champ.
- **Config par défaut** : à la création d'un compte, une roue par défaut est générée pour
  que le commerçant ait immédiatement une page fonctionnelle.

## 6. Sécurité & conformité

- RLS sur toutes les tables tenant ; écritures sensibles via clé service côté serveur.
- Aucune donnée personnelle joueur stockée (seul un identifiant anonyme de navigateur).
- Mention conformité affichée (cadeau non conditionné à la note).
- Variables secrètes (clés Supabase/Stripe) uniquement en variables d'environnement Vercel.

## 7. Découpage de livraison (mapping epics)

| Epic | Livrable technique                                        |
|------|-----------------------------------------------------------|
| 1    | Projet Next.js + Supabase, schéma + RLS, page `/{slug}`, `/api/play` avec verrou |
| 2    | Auth commerçant, éditeur de roue, QR, stats               |
| 3    | Espace admin, création de compte, suspension, statut abonnement |

## 8. Prochaines étapes (BMAD)

1. ✅ Architecture (ce document) — *Architecte*
2. ➡️ Découpage fin & implémentation story par story — *Scrum Master → Dev → QA*
   - Démarrage recommandé : **Epic 1, Story 1.1** (initialisation du projet).
