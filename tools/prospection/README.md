# Agent de prospection Kado 📨

Un petit outil en ligne de commande qui **trouve des commerces**, **récupère leur
e-mail**, **personnalise** un message (le rituel *Constat + Projection*) et
**envoie 5 mails par jour** — sans budget publicitaire.

Chaque mail montre au commerçant son **écart d'avis Google** avec son concurrent
le plus fort, puis propose Kado comme moyen de le combler.

---

## Comment ça marche

1. **`seed`** — pour une recherche (ex. `restaurant Lyon 6`), l'outil interroge
   **Google Places**, identifie le concurrent le plus fort (le plus d'avis),
   puis pour chaque autre commerce récupère son site web et y cherche un e-mail
   de contact. Chaque prospect est stocké avec son *Constat* (ses avis vs le leader).
2. **`send`** — envoie les prochains mails personnalisés via **Resend**, dans la
   limite de **5/jour**, en évitant les doublons et les désinscrits.
3. Sur un **VPS**, un `cron` appelle `send` chaque jour automatiquement.

Les données sont dans `data/db.json` (aucune base externe requise).

---

## Installation (≈ 15 min)

### 1. Récupérer les 2 clés gratuites

| Clé | Où | Note |
|---|---|---|
| `GOOGLE_PLACES_API_KEY` | [console.cloud.google.com](https://console.cloud.google.com) → active **Places API** → crée une clé | Crédit gratuit 200 $/mois (≈ 0 €) |
| `RESEND_API_KEY` | [resend.com](https://resend.com) → **API Keys** | 100 mails/jour offerts |

Dans Resend, **ajoute et vérifie ton domaine** (Domains → Add) pour que tes mails
n'atterrissent pas en spam, puis utilise une adresse de ce domaine dans `FROM_EMAIL`.

### 2. Configurer

```bash
cd tools/prospection
npm install
cp .env.example .env      # puis remplis .env (clés + ton identité d'expéditeur)
```

### 3. Tester sans rien envoyer

```bash
# Mets DRY_RUN=true dans .env pour simuler, puis :
npm run seed -- "coiffeur Bordeaux centre"
npm run list        # voir les prospects trouvés
npm run send        # simule l'envoi (aucun mail réel)
npm run stats
```

Quand tout te convient, repasse `DRY_RUN=false`.

---

## Commandes

```bash
npm run seed -- "<recherche>"   # trouver des commerces + e-mails
npm run send                    # envoyer les prochains mails (max 5/jour)
npm run list                    # prospects en attente
npm run stats                   # état de la base
npm run suppress -- <email>     # ne plus jamais contacter (réponse « STOP »)
```

---

## Mise en production sur un VPS

```bash
crontab -e
# puis colle la ligne de crontab.example (adapte les chemins)
```

Le `seed` reste manuel : lance-le quand tu veux ajouter une ville ou un secteur.
Le `send` tourne tout seul via le cron.

---

## Conformité RGPD (démarchage B2B)

L'outil applique les règles du démarchage professionnel en France :

- **Uniquement des adresses professionnelles/génériques** (`contact@`, `info@`…),
  jamais d'adresses personnelles nominatives.
- **Identification claire** de l'expéditeur dans chaque mail (nom + entité).
- **Désinscription simple** : mention « répondez STOP » + en-tête `List-Unsubscribe`.
- Quand un commerçant répond STOP, ajoute-le : `npm run suppress -- son@email.fr`.

> ⚠️ Reste mesuré : cible des commerces réellement pertinents, n'insiste pas si on
> te demande d'arrêter, et n'augmente pas le volume au point de nuire à ta
> délivrabilité (et à ta réputation).
