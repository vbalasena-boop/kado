# Intention — Acquisition de commerçants pour Kado (GTM zéro budget)

> Condensé issu de la session de brainstorming du 2026-08-24 (mode Partenaire créatif).
> Destiné à alimenter `bmad-spec` / `bmad-prd`. Sources : `.memlog.md`.

## Objectif

Acquérir les premiers commerçants **payants** pour Kado **sans budget publicitaire**
(bootstrap, en solo), et poser une machine d'acquisition qui se propage seule.

## Insight fondateur

Le *job* du commerçant n'est pas « avoir plus d'avis » — c'est **la notoriété locale
relative** : *passer devant le commerce voisin* dans le classement Google. C'est
émotionnel, local, et guidé par la rivalité de quartier.

**Conséquence stratégique :** un rituel de vente unique — le **Constat + Projection** —
irrigue tous les canaux (email, DM, script oral, argumentaire des affiliés) :
1. **Constat** : montrer au commerçant son rang / son nombre d'avis vs le concurrent le plus fort (douleur chiffrée).
2. **Projection** : ce que Kado lui rapporterait à son volume de clients (espoir chiffré).

## Canaux retenus

- **Email à froid** ultra-personnalisé (objet = le Constat) — *automatisé (agent construit)*.
- **Instagram** (DM à froid + contenu preuve) pour les commerces sans e-mail visible.
- **Terrain** rue par rue (contagion géographique : signer 1 commerce → pression sur ses voisins).

## Moteur d'acquisition auto-propagé (direction centrale)

Trois briques qui s'emboîtent :

1. **Boucle produit** — chaque roue est déjà chez un commerçant ; certains joueurs
   *sont* des commerçants. CTA sur l'écran de gain → lead automatique et gratuit.
   *(v1 livrée : CTA vers `/tarifs?ref=<slug>`.)*
2. **Affiliés** — réutiliser le système `/vendeur` existant : recruter des ambassadeurs
   déjà au contact des commerçants (comptables, graphistes, fournisseurs, imprimeurs),
   payés à la **commission récurrente**. Zéro coût fixe.
3. **Referral (les 250 de Girard)** — chaque commerçant signé parraine ses pairs et
   peut devenir affilié → chaque nouveau client devient un nouveau nœud.

## Arsenal de vente produit (playbook)

- **Script « Straight Line » (Belfort)** : ouverture (objet = Constat) → Constat →
  Projection → pont Kado → close micro-engagement.
- **Séquence de relance** : J+3 (preuve) · J+7 (rareté « 1 par rue ») · J+12 (break-up).
- **Banque d'objections** : « pas le temps » (judo : 0 min), « c'est cher » (close par
  les maths + risk reversal), « c'est de la triche » (cadeau non conditionné à la note),
  « déjà essayé » (jeu + cadeau = la différence).
- **Close ultime = risk reversal** : essai **14 jours gratuits, sans engagement**.
- **Tarifs** : Jeux 29 €/mois (roue → avis), Fidélité 19 €, Complet 44 €, Comptoir 19 €.
  Rentabilité : panier 20 € ⇒ ~1,5 client/mois suffit.

## Déjà réalisé dans le repo

- Agent de prospection e-mail (`tools/prospection/`) : Google Places → e-mail →
  Constat+Projection → 5 mails/jour via Resend, garde-fous RGPD.
- Boucle produit v1 : CTA commerçant sur l'écran de gain.

## Candidats produit à spécifier (entrées pour un PRD)

1. **Attribution de la boucle produit** : capter `?ref=<slug>` jusqu'à la souscription
   pour récompenser le commerce hôte (referral) — boucler produit ↔ affiliés.
2. **Onboarding affiliés** : page de recrutement + activation du système `/vendeur`
   (barème de commission récurrente, kit de vente = ce playbook).
3. **Canal Instagram** : outil/relais de DM à froid pour les commerces sans e-mail.
4. **Séquences de relance automatisées** dans l'agent de prospection (J+3/7/12).

## Prochaine étape recommandée

Passer ce document à `bmad-prd` (ou `bmad-spec`) en ciblant **un** candidat produit
ci-dessus — le plus prometteur étant l'**attribution boucle produit ↔ affiliés**,
qui transforme l'acquisition en réaction en chaîne.
