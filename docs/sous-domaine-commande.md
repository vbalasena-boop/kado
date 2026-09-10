# Commande en ligne sur le domaine du commerçant

Le Click & Collect Kado peut être servi sur un sous-domaine du commerçant,
par exemple `commander.qustos.fr`. Le client ne voit jamais `kado-app.fr`,
et un lien « Retour au site » le ramène sur la vitrine (Wix, Shopify…).

## Comment ça marche

1. Le commerçant renseigne dans **Espace commerçant > Commandes > Votre lien
   de commande** :
   - l'adresse de son site (lien « Retour au site »),
   - son sous-domaine de commande (`commander.mon-commerce.fr`).
2. `middleware.ts` reconnaît tout hôte qui n'est pas Kado, retrouve le
   commerce (`businesses.order_domain`) et réécrit l'URL :

   | URL demandée                        | Page servie              |
   | ----------------------------------- | ------------------------ |
   | `commander.qustos.fr/`              | `/qustos/commander`      |
   | `commander.qustos.fr/suivi/AB12`    | `/qustos/suivi/AB12`     |
   | `commander.qustos.fr/n-importe-quoi`| `/qustos/commander`      |

   L'API (`/api/*`), les assets et les fichiers statiques passent tels quels.
   Stripe Checkout renvoie vers `https://commander.qustos.fr/qustos/suivi/…`
   (chemin déjà préfixé, servi sans réécriture).
3. La résolution hôte → slug est mise en cache 5 min par isolat Edge.

## Marche à suivre DNS (côté commerçant)

Chez le registrar du domaine (Wix, OVH, Gandi, IONOS…) :

| Type  | Nom         | Cible                  | TTL  |
| ----- | ----------- | ---------------------- | ---- |
| CNAME | `commander` | `cname.vercel-dns.com` | auto |

Sur **Wix** : Domaines → le domaine → Enregistrements DNS avancés →
« Ajouter un enregistrement » CNAME. Le sous-domaine ne remplace pas le site
Wix : la racine `qustos.fr` reste servie par Wix.

## Activation (côté Kado)

1. Vercel → projet `kado` → Settings → Domains → **Add** →
   `commander.qustos.fr`. Vercel émet le certificat HTTPS dès que le CNAME est
   propagé (quelques minutes à quelques heures).
2. Vérifier que le commerçant a bien enregistré le même hôte dans son espace
   (sinon la page renvoie « Page introuvable »).
3. Test : `curl -sI https://commander.qustos.fr/` doit renvoyer 200, et la
   page affiche le menu du commerce.

Une automatisation via l'API Domains de Vercel (`POST
/v9/projects/{id}/domains`) est possible plus tard pour supprimer l'étape 1.

## Migration

`supabase/migrations/0083_order_domain.sql` ajoute `website_url` et
`order_domain` (unique) sur `businesses`. Tant qu'elle n'est pas passée, les
lectures sont tolérantes : la page de commande et l'espace commerçant
fonctionnent comme avant, sans ces réglages.

## Sur le site Wix du commerçant

Un bouton « Commander » qui pointe vers `https://commander.qustos.fr` suffit.
Pas d'iframe : Stripe Checkout et les notifications push refusent de
fonctionner dans un cadre, et Kado envoie `X-Frame-Options: DENY`.
