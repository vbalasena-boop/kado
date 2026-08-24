# Kado 🎁

SaaS « **scannez, jouez, gagnez** » : un jeu de roue de la fortune qui aide n'importe
quel commerce à obtenir plus **d'avis Google** et **d'abonnés Instagram**.
Chaque client scanne un QR code, débloque **2 tours** (un pour un suivi Instagram, un
pour un avis Google) et gagne un cadeau.

> Projet cadré avec la **BMAD Method** — voir `docs/brief.md`, `docs/prd.md`,
> `docs/architecture.md`. Pour installer BMAD dans Claude Code : `docs/bmad-install.md`.

---

## Ce qui est déjà construit (Epic 1)

- ✅ Page de jeu publique `/{slug}` (règles → 2 tours → cadeau + confettis)
- ✅ **Verrou serveur des 2 tours** — double signal : cookie joueur signé **+**
  empreinte d'appareil (bloque aussi le rejeu en navigation privée / cookies
  vidés sur le même appareil). Garde-fou anti-fraude ultime : code cadeau à
  usage unique + plafond quotidien, validés en boutique.
- ✅ Tirage du cadeau **côté serveur** (anti-triche, stats fiables)
- ✅ Base de données multi-établissements (Supabase + RLS)
- ✅ Suspension d'un établissement = page publique bloquée

Prototype 100 % statique (sans base) toujours dispo : `prototype/roue.html`.

À venir : espace commerçant (config + QR + stats) et espace admin (gestion des accès).

---

## Stack

Next.js (App Router) · Supabase (Auth + Postgres) · déploiement Vercel — **offres gratuites**.

---

## Installation pas à pas (≈ 15 min, 0 €)

### 1. Créer la base de données (Supabase)

1. Va sur [supabase.com](https://supabase.com) → **New project** (gratuit).
2. Une fois créé, ouvre **SQL Editor** et exécute le contenu de :
   - `supabase/migrations/0001_init.sql` (crée les tables)
   - puis `supabase/seed.sql` (ajoute la démo « Café Lumière »)
3. Va dans **Settings → API** et note :
   - **Project URL** → `SUPABASE_URL` **et** `NEXT_PUBLIC_SUPABASE_URL` (même valeur)
   - clé **`service_role`** (secrète) → `SUPABASE_SERVICE_ROLE_KEY`
   - clé **`anon`** (publique) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Pour la connexion des commerçants (**Auth**) : va dans **Authentication → URL
   Configuration** et ajoute ton URL de site + `…/auth/callback` dans les
   **Redirect URLs** (ex. `http://localhost:3000/auth/callback` et
   `https://ton-site.vercel.app/auth/callback`).

### 2. Lancer en local (optionnel, pour tester)

```bash
npm install
cp .env.example .env.local     # puis colle tes clés dedans
npm run dev                     # ouvre http://localhost:3000/cafe-lumiere
```

### 3. Mettre en ligne (Vercel)

1. Va sur [vercel.com](https://vercel.com) → **Add New → Project** → importe ce dépôt GitHub.
2. Dans **Settings → Environment Variables**, ajoute :
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `PLAYER_COOKIE_SECRET` (une longue chaîne aléatoire de ton choix)
   - `NEXT_PUBLIC_SITE_URL` (l'URL Vercel du site)
3. **Deploy**. Ta page de démo : `https://ton-site.vercel.app/cafe-lumiere`

---

## Espace admin (toi)

1. Ajoute ton e-mail dans la variable `ADMIN_EMAILS` (plusieurs possibles, séparés
   par des virgules).
2. Connecte-toi sur `/login` avec cet e-mail, puis va sur **`/admin`**.
3. Depuis `/admin` tu peux :
   - **Créer un compte** commerçant (nom + e-mail → génère slug, roue et cadeaux
     par défaut, et envoie une invitation par mail) ;
   - **Suspendre / Réactiver** un compte (= donner ou retirer l'accès : coupe la
     page de jeu **et** l'espace commerçant) ;
   - voir l'activité (tours joués) et le statut d'abonnement de chaque compte.

> L'envoi des invitations utilise l'e-mail intégré de Supabase (limité). Pour un
> usage réel, configure un SMTP dans Supabase (Authentication → Emails).

## Tester l'espace commerçant

1. Va sur `/login`, entre ton e-mail, clique le lien reçu par mail.
2. À la première connexion, ton compte n'est lié à aucun établissement. Pour
   tester avec la démo, récupère ton `user id` dans Supabase (**Authentication →
   Users**) puis exécute dans le **SQL Editor** :

   ```sql
   update businesses set owner_user_id = 'TON_USER_ID'
   where slug = 'cafe-lumiere';
   ```

3. Recharge `/dashboard` : tu accèdes à la vue d'ensemble, à l'éditeur de roue et
   au QR. *(La création/liaison automatique des comptes arrivera avec l'Epic 3.)*

## Structure

```
app/
  page.tsx              Accueil (vitrine)
  [slug]/page.tsx       Page de jeu (serveur : charge la config)
  [slug]/Game.tsx       Jeu (client : roue, écrans, appels API)
  api/play/route.ts     Enregistre un tour + verrou + tirage serveur
  api/health/route.ts   Health-check
lib/
  supabase/admin.ts     Client Supabase (serveur uniquement)
  player.ts             Cookie joueur signé (verrou des 2 tours)
  draw.ts               Tirage pondéré + génération de code
supabase/
  migrations/0001_init.sql   Schéma + RLS
  seed.sql                   Données de démo
docs/                    Documents BMAD (brief, PRD, architecture)
prototype/roue.html      Prototype statique (sans base)
```

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé secrète serveur (jamais côté navigateur) |
| `PLAYER_COOKIE_SECRET` | Signe le cookie anonyme du joueur |
| `NEXT_PUBLIC_SITE_URL` | URL publique (QR codes) |
