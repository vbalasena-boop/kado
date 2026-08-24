---
title: "Architecture — Prospection Kado"
status: draft
created: 2026-08-24
updated: 2026-08-24
---

# Architecture — Système de prospection Kado

> Document produit selon la **BMAD Method** · Rôle : **Architecte (Winston)** · v0.1 · 2026-08-24
> Amont : `docs/brief-prospection.md`, `docs/prd-prospection.md`. Base : `docs/architecture.md`.

---

## 1. Principe : brancher, ne pas réinventer

Le module de prospection **se greffe sur l'app Kado existante** (Next.js App Router +
Supabase + Vercel + Resend). On **réutilise** les briques déjà en place plutôt que d'en
créer de nouvelles — c'est ce qui garantit **0 € de coût marginal** et la cohérence.

| Besoin prospection | Brique Kado réutilisée |
|---|---|
| Envoi email (Resend) | `lib/email.ts` (`sendEmail`, `sendBatch`, `emailLayout`) |
| Désinscription | `lib/unsub.ts` (`unsubToken`) + `app/api/unsubscribe/route.ts` |
| Tâches planifiées | Cron Vercel `app/api/cron/daily` (secret `CRON_SECRET`) |
| Accès base sécurisé | `lib/supabase/admin.ts` (clé service, côté serveur) |
| Erreurs | `lib/report.ts` (Sentry, déjà branché) |
| Validation entrées | `zod` (déjà utilisé) |
| Zone admin / auth | Espace `/admin` + middleware existants |

**Nouveau à ajouter** : intégration **Google Places**, tables `prospect*`, le **scoring**,
la **génération de messages**, l'**UI d'administration prospection**, et un **cron dédié**.

## 2. Vue d'ensemble

```
                       Opérateur (toi) — /admin/prospection
                                     │
                                     ▼
                        Next.js (Vercel) — API routes
   ┌──────────────┬───────────────┬───────────────┬────────────────────┐
   ▼              ▼               ▼               ▼                    ▼
Sourcing      Scoring        Génération       Envoi email          File Insta
(Google       (avis Google   messages         (Resend, cadence     (assistée,
 Places API)   au cœur)       (gabarits)        lente, warm-up)      copie 1 clic)
   │              │               │               │                    │
   └──────────────┴───────────────┴───────────────┴────────────────────┘
                                     │
                          Supabase Postgres (RLS admin)
                     prospects · prospect_messages · prospect_events
                              · suppression_list
                                     │
                        Cron Vercel /api/cron/prospection
                 (drip email + relances, plafond quotidien, bounces)
```

## 3. Modèle de données (nouvelles tables)

Migration `supabase/migrations/00XX_prospection.sql`. RLS : **accès admin uniquement**
(mêmes règles que les tables d'exploitation Kado ; écritures via clé service).

```sql
-- Un commerce prospecté
prospects(
  id uuid pk,
  place_id text unique,          -- identifiant Google Places (déduplication)
  name text,
  category text,                 -- segment: resto | beaute | boutique | sport | ...
  city text,
  address text,
  google_rating numeric,         -- note moyenne
  google_reviews_count int,      -- nombre d'avis (signal central)
  google_last_review_at date,    -- fraîcheur (si disponible)
  website text,
  email text,                    -- si trouvable
  instagram_handle text,         -- si trouvable
  instagram_active boolean,      -- activité détectée
  score int,                     -- score de priorité calculé
  score_factors jsonb,           -- explication du score
  status text default 'new',     -- new | queued | emailed | dm_pending | dm_sent
                                  -- | replied | interested | client | excluded
  exclude_reason text,
  note text,                     -- note libre opérateur
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)

-- Messages générés (email + DM) par prospect
prospect_messages(
  id uuid pk,
  prospect_id uuid fk,
  channel text,                  -- 'email' | 'instagram'
  step int default 1,            -- 1 = initial, 2 = relance
  subject text,                  -- (email)
  body text,
  status text default 'draft',   -- draft | approved | sent | skipped
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz default now()
)

-- Journal d'événements (audit + idempotence)
prospect_events(
  id uuid pk,
  prospect_id uuid fk,
  type text,                     -- sourced | scored | approved | email_sent
                                 -- | email_bounced | email_replied | dm_sent
                                 -- | unsubscribed | excluded
  meta jsonb,
  created_at timestamptz default now()
)

-- Liste de suppression (ne JAMAIS recontacter)
suppression_list(
  id uuid pk,
  email text,
  reason text,                   -- unsubscribed | bounced | manual
  created_at timestamptz default now(),
  unique(email)
)
```

## 4. Sourcing — Google Places (Epic A)

- **API officielle** (crédit mensuel gratuit ; au volume artisanal → reste 0 €). Clé en
  **variable d'environnement Vercel** (`GOOGLE_PLACES_API_KEY`), appels **côté serveur
  uniquement** (jamais exposée au client).
- Flux : `Text/Nearby Search` (par ville + type) → pour chaque résultat, `Place Details`
  (note, nb d'avis, site, `place_id`). Instagram/email : dérivés du **site web** quand
  présent (parse léger de la home / page contact), sinon champ vide.
- **Déduplication** par `place_id` (contrainte `unique`).
- **Garde-quota** : compteur d'appels + arrêt propre avant la limite ; le sourcing est
  **reprenable** (pagination stockée), aucun doublon.
- Route : `POST /api/admin/prospection/source` (params : ville, segments, plafond).

## 5. Scoring & qualification (Epic B)

Fonction pure `lib/prospection/score.ts` → `score` + `score_factors` :

- **Avis Google (poids fort)** : peu d'avis → score haut ; note perfectible → bonus ;
  pas d'avis récent → bonus « timing ».
- **Instagram actif** : présence + activité → bonus.
- **Joignabilité** : email trouvé (canal email dispo) → bonus.
- Hors-cible (chaîne, fermé, aucun canal) → `status = excluded` + motif.
- Filtres/ tris exposés à l'UI (segment, seuil d'avis, note max, « a un Instagram »).

## 6. Génération des messages (Epic C)

- **MVP = gabarits par segment** (`lib/prospection/templates.ts`) avec **champs de
  fusion** : nom, ville, `google_reviews_count`, accroche métier. Personnalisation réelle
  sans coût ni dépendance externe (cohérent budget 0 €).
- Anti-spam : contrôle des marqueurs (mots déclencheurs, excès liens/majuscules), signalé
  dans l'UI si risque.
- Email : gabarit rendu via `emailLayout` (cohérence visuelle Kado) + **lien de
  désinscription** (`unsubToken`) + **mentions RGPD** (origine des données).
- **Édition** possible avant approbation ; l'édition écrase le brouillon (`prospect_messages`).
- *(Post-MVP : génération assistée par LLM si un budget est débloqué — l'interface reste
  la même.)*

## 7. Envoi email & délivrabilité (Epic D) — cœur du risque

- **Domaine dédié** : sous-domaine d'envoi distinct du transactionnel Kado
  (ex. `hello.prospection.kado-app.fr`) pour **isoler la réputation**. **SPF, DKIM,
  DMARC** configurés dans Resend + DNS.
- **Cadence lente & plafond** : `MAX_PROSPECT_EMAILS_PER_DAY` (petit au départ), montée
  **progressive** (warm-up). Envois pilotés par le **cron** (pas de rafale).
- **Séquence** : message initial → **1 relance** après N jours si pas de réponse.
- **Suppression** : avant tout envoi, contrôle `suppression_list` ; un désinscrit / bounce
  dur n'est **jamais** recontacté.
- **Bounces & plaintes** : **webhook Resend** → `POST /api/webhooks/resend` met à jour
  `prospect_events` + ajoute à `suppression_list`. Alerte si taux dépasse un seuil.
- **Détection des réponses** : `Reply-To` sur une **boîte dédiée**. MVP : marquage
  « répondu » (manuel dans l'UI) qui **stoppe la relance** ; post-MVP : ingestion
  automatique (webhook inbound / IMAP).
- Cron dédié : `app/api/cron/prospection/route.ts` (secret `CRON_SECRET`, même patron que
  `cron/daily`) — sélectionne les envois du jour dans la limite du plafond, idempotent
  (via `prospect_events`, pas de double envoi).

## 8. File Instagram assistée (Epic E)

- **Aucune automatisation d'envoi** (CGU Meta). L'UI liste les DM `dm_pending` : profil,
  message, **bouton copier**, lien vers le profil Instagram.
- L'opérateur poste depuis son compte, puis clique **« marqué envoyé »** → `dm_sent`.
- **Quota** `MAX_PROSPECT_DM_PER_DAY` (prudent) affiché et respecté (compteur du jour).

## 9. Routes & UI

**API (admin uniquement, réutilise le garde d'auth existant)**
- `POST /api/admin/prospection/source` — lancer un sourcing.
- `POST /api/admin/prospection/score` — (re)scorer.
- `POST /api/admin/prospection/[id]/generate` — générer/regénérer messages.
- `POST /api/admin/prospection/[id]/approve` — approuver (email → séquence, DM → file).
- `POST /api/admin/prospection/[id]/status` — changer statut / exclure / noter.
- `POST /api/webhooks/resend` — bounces/plaintes (public, signé).
- `GET /api/cron/prospection` — drip + relances (cron, secret).

**UI**
- `/admin/prospection` — liste filtrable/triable (score, avis Google, statut) + indicateurs.
- `/admin/prospection/[id]` — fiche prospect : signaux, messages (relire/éditer), actions.
- `/admin/prospection/instagram` — file d'envoi assistée.

## 10. Configuration (variables d'environnement)

| Variable | Rôle |
|---|---|
| `GOOGLE_PLACES_API_KEY` | Sourcing (serveur uniquement) |
| `PROSPECT_EMAIL_FROM` | Expéditeur (sous-domaine dédié) |
| `PROSPECT_REPLY_TO` | Boîte de réception des réponses |
| `MAX_PROSPECT_EMAILS_PER_DAY` | Plafond quotidien email (warm-up) |
| `MAX_PROSPECT_DM_PER_DAY` | Plafond quotidien DM Instagram |
| `RESEND_API_KEY`, `CRON_SECRET` | *(déjà présents)* |

## 11. Sécurité & conformité

- Toutes les routes prospection sont **admin-only** ; clé service côté serveur, RLS admin.
- **RGPD** : base légale intérêt légitime B2B ; désinscription 1 clic + `suppression_list`
  persistante ; mentions d'origine dans chaque email ; journal `prospect_events` (preuve).
- **CGU Meta** : aucun DM automatisé — envoi humain uniquement.
- **Secrets** en variables d'environnement Vercel ; clé Places jamais côté client.
- **Anti-blacklist** : domaine dédié, SPF/DKIM/DMARC, warm-up, plafond, purge bounces,
  surveillance du taux de plainte.

## 12. Découpage de livraison (mapping epics)

| Epic | Livrable technique |
|------|--------------------|
| A | Migration `prospects` + intégration Google Places + `POST /source` + dédup |
| B | `lib/prospection/score.ts` + filtres/tri UI + exclusion |
| C | `templates.ts` + génération email/DM + édition + anti-spam |
| D | Envoi Resend (domaine dédié, warm-up), séquence, webhook bounces, cron dédié |
| E | File Instagram assistée + tableau de bord + statuts + quotas |

**Démarrage recommandé** : **Epic A story A1** (migration + sourcing d'une ville), car
tout le reste s'appuie sur des prospects réels en base.

## 13. Prochaines étapes (BMAD)

1. ✅ Architecture (ce document) — *Architecte* → `docs/architecture-prospection.md`
2. ➡️ **Epics & stories** détaillées prêtes au build — puis *Dev / QA*.
