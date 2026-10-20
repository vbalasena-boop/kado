---
title: "SEO et conversion de la page tarifs"
status: ready-for-dev
---

# SEO et conversion de la page tarifs

**Agent :** codex  
**Niveau :** moyen  
**Priorité :** normale

## Objectif

Mieux se positionner sur Google (commerces de proximité : roue cadeaux, avis Google, carte de fidélité, bipeur digital) et convertir davantage sur `/` et `/tarifs`.

## Critères vérifiables

- [ ] Chaque page publique (`/`, `/tarifs`, `/vendeur`, `/temoignages`, `/blog`, articles) a un `<title>` unique (≤ 60 car.), une meta description (≤ 155 car.), une URL canonique et des balises Open Graph/Twitter.
- [ ] Données structurées JSON-LD : `Organization` + `SoftwareApplication` avec `offers` (Jeux 19, Fidélité 19, Complet 44, Comptoir 19 €/mois) sur `/tarifs` ; `FAQPage` sur `/` à partir de la FAQ existante ; les prix du JSON-LD sont lus depuis le même tableau que la page (pas de valeur dupliquée à la main).
- [ ] `app/sitemap.ts` liste toutes les pages publiques et articles ; `robots` autorise le public et bloque `/dashboard`, `/admin`, `/api`.
- [ ] Un seul `<h1>` par page ; hiérarchie h2/h3 cohérente ; `alt` sur toutes les images.
- [ ] Conversion `/tarifs` : bouton principal visible sans défiler sur mobile, même libellé que `/` (« Commencer l'essai gratuit »), mention « 14 jours, sans carte bancaire » près de chaque bouton, bloc de réassurance (RGPD, sans engagement) avant la grille.
- [ ] Aucune promesse conditionnant un cadeau à un avis Google (règle du projet).
- [ ] Ne pas modifier prix, Stripe, auth, migrations.
- [ ] `bash scripts/relais/verifier.sh` OK.

## Reprise

Fait : rien.
