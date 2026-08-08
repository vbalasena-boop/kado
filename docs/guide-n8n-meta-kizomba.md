# Convertir des prospects Meta (Kizomba) avec n8n — gratuitement

Guide pratique pour transformer les prospects venus des pubs **Facebook / Instagram (Meta Lead Ads)** en élèves de tes **cours de Kizomba**, sans payer de logiciel, grâce à **n8n**.

---

## 1. Pourquoi n8n (et comment l'avoir gratuitement)

n8n est un outil d'automatisation (comme Zapier/Make) mais **open-source et auto-hébergeable = gratuit à vie**. Trois options :

| Option | Coût | Pour qui |
|---|---|---|
| **n8n auto-hébergé (Community Edition)** | **Gratuit** (juste le serveur) | La vraie option gratuite recommandée |
| n8n Cloud – essai | Gratuit ~14 jours puis payant | Tester vite sans installer |
| n8n en local (ton PC) | Gratuit | Tests / apprentissage (le PC doit rester allumé) |

### Installer n8n gratuitement (auto-hébergé)

- **Le plus simple / vraiment gratuit :** un petit VPS (Hetzner ~4 €/mois, Oracle Cloud « Always Free » = 0 €) + Docker :
  ```bash
  docker run -d --restart always --name n8n \
    -p 5678:5678 \
    -e N8N_HOST="ton-domaine.fr" \
    -e WEBHOOK_URL="https://ton-domaine.fr/" \
    -v n8n_data:/home/node/.n8n \
    docker.n8n.io/n8nio/n8n
  ```
- **Pour juste tester sur ton PC :**
  ```bash
  npx n8n
  ```
  puis ouvre `http://localhost:5678`.

> ⚠️ Le déclencheur Meta Lead Ads a besoin d'une **URL publique en HTTPS** pour recevoir les webhooks. En local, utilise un tunnel (`npx n8n start --tunnel`) ou héberge sur un VPS.

---

## 2. Le parcours de conversion (la logique)

```
Pub Meta (Kizomba)
   → Formulaire Instantané Meta (Lead Ad)
      → n8n reçoit le prospect en temps réel
         ├─ 1) Enregistre dans un CRM gratuit (Google Sheets)
         ├─ 2) Email de bienvenue immédiat + lien de réservation
         ├─ 3) Alerte à ton équipe (Telegram) → rappel sous 5 min
         └─ 4) Relance automatique à J+2 si pas de réservation
```

**Règle d'or de la conversion :** un prospect contacté **dans les 5 minutes** convertit jusqu'à **5× mieux**. Tout l'intérêt de n8n = déclencher l'email + l'alerte **instantanément**, automatiquement.

---

## 3. Mise en place, étape par étape

### Étape A — Côté Meta
1. Crée une **campagne « Prospects »** dans le Gestionnaire de publicités Meta.
2. Crée un **Formulaire instantané** avec les champs : `Prénom`, `Email`, `Téléphone`, `Ville`. Ajoute une question de qualification (ex. *« Ton niveau ? Débutant / Intermédiaire »*).
3. Note l'**ID de ta Page** et l'**ID du formulaire**.

### Étape B — Connecter Meta à n8n
1. Dans n8n, importe le workflow fourni : **`workflows/meta-kizomba-lead-conversion.json`**
   *(Menu → Import from File)*.
2. Ouvre le noeud **« Meta Lead Ads Trigger »**, crée la credential **Facebook Graph / Lead Ads** (connexion OAuth à ta Page), choisis ta Page + ton formulaire, puis clique **Listen / Execute** pour t'abonner aux webhooks.

> **Sans app Facebook validée / trop compliqué ?** Deux alternatives gratuites :
> - Remplace le trigger par le noeud **Webhook** de n8n et relie-le avec **Make/Zapier (offre gratuite)** qui, lui, sait lire les Lead Ads.
> - Ou exporte les leads en **CSV depuis Meta** et injecte-les via le noeud **Google Sheets Trigger**.

### Étape C — Configurer les 4 actions
Dans le workflow importé, remplace les valeurs `REMPLACE_PAR_...` :

| Noeud | À configurer |
|---|---|
| **CRM gratuit (Google Sheets)** | Credential Google + `documentId` de ta feuille + onglet `Prospects` |
| **Email de bienvenue** | Credential SMTP (Gmail gratuit ou Brevo 300 emails/j offerts) + ton **lien de réservation** |
| **Alerte équipe (Telegram)** | Credential Bot Telegram (gratuit) + ton `chatId` |
| **Relance J+2** | Même SMTP + lien de réservation |

### Étape D — Activer
Bascule le workflow sur **Active** (en haut à droite). C'est en production 🎉

---

## 4. Le « lien de réservation » (le point qui convertit)

L'email envoie vers **un créneau réservable**. Outils gratuits :
- **Calendly** (offre gratuite) ou **Cal.com** (open-source, gratuit),
- ou un simple **Google Form / lien WhatsApp** (`https://wa.me/33XXXXXXXXX?text=Je%20veux%20mon%20cours%20d'essai`).

Mets **le 1er cours d'essai offert** en accroche : c'est le meilleur convertisseur pour de la danse.

---

## 5. Coût total

| Brique | Coût |
|---|---|
| n8n (auto-hébergé) | 0 € (Oracle Free) à ~4 €/mois (VPS) |
| Google Sheets (CRM) | 0 € |
| Email SMTP (Gmail / Brevo) | 0 € |
| Telegram (alertes) | 0 € |
| Calendly / Cal.com (réservation) | 0 € |
| **Total** | **≈ 0 €** (hors budget pub Meta) |

---

## 6. Idées pour aller plus loin

- **SMS** au lieu de l'email (via un noeud comme Brevo/Twilio) — encore plus ouvert.
- **Segmentation** : router les « Débutants » vers un cours découverte, les « Intermédiaires » vers un autre.
- **Score de chaud/froid** : si le prospect a cliqué le lien → alerte prioritaire à l'équipe.
- **Tableau de bord** : une 2e feuille Google Sheets qui compte les leads / réservations / conversions par semaine.

---

*Kit d'automatisation pour La Table d'Alice — cours de Kizomba.*
