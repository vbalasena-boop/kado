---
title: "SEO accueil et tarifs alignés sur le nouveau positionnement"
status: ready-for-dev
---

# SEO accueil et tarifs alignés sur le nouveau positionnement

**Agent :** codex  
**Niveau :** moyen  
**Priorité :** normale

## Objectif

Positionnement actuel : « Un petit jeu. Une vraie raison de revenir. » (jeu + carte de fidélité), déjà en place dans `app/layout.tsx` (story 13-6). L'ancien message « avis Google / abonnés Instagram » survit dans le JSON-LD et le corps de l'accueil, et dans `/tarifs`. Aligner ces pages (audit SEO du 2026-10-21, points 1, 2, 4).

## Contexte

- Source de vérité du texte : `app/layout.tsx` (title/description) et `app/opengraph-image.alt.txt`. Ne rien inventer au-delà.
- L'avis Google reste une option proposée, libre, jamais liée au cadeau (pas de « review gating ») : le garder en fonction secondaire, ne pas le supprimer des FAQ/mentions légales qui l'expliquent.
- Les numéros de ligne de l'audit ont bougé : chercher avec `grep -n "avis\|Avis\|abonnés" app/page.tsx app/tarifs/page.tsx`.

## À faire

1. **JSON-LD de l'accueil** (`app/page.tsx`, bloc `description` de l'Organization/SoftwareApplication) : remplacer « jeux, avis Google, carte… » par un texte « un petit jeu et une carte de fidélité, une vraie raison de revenir ».
2. **Corps de l'accueil** (`app/page.tsx`) : réécrire les libellés qui mettent « plus d'avis / plus d'abonnés » en tête (liste de bénéfices, étape 2, entrées « desc », paragraphe final, tagline `nav-note` « Le jeu qui fait parler de vous ») pour le message jeu + fidélité. L'avis Google passe en option secondaire.
3. **`/tarifs`** (`app/tarifs/page.tsx`) :
   - mêmes réécritures (desc, lignes « Avis Google + abonnés Instagram », « Les avis font venir les clients ») ;
   - JSON-LD : ne pas redéclarer l'Organization (référencer `@id` `https://kado-app.fr/#organization`), ajouter une `description` au `SoftwareApplication`, ajouter un `FAQPage` généré depuis la FAQ existante (une seule source de données) ;
   - CTA principal : `href="/login?signup=1"` au lieu de `/login` ;
   - un H1 contenant « tarifs » et un lien vers `/blog`.

## Critères vérifiables

- [ ] `grep -n "Plus d'avis\|Boostez vos avis\|avis & abonnés" app/page.tsx app/tarifs/page.tsx` ne renvoie plus de message principal sur les avis.
- [ ] Le JSON-LD de `/tarifs` est valide : un seul `Organization`, `SoftwareApplication` avec `description`, `FAQPage` aligné sur la FAQ affichée.
- [ ] CTA de `/tarifs` vers `/login?signup=1`.
- [ ] Aucun texte ne promet un cadeau en échange d'un avis.
- [ ] Un test existant sur ces pages, s'il y en a, est mis à jour et passe.
- [ ] `bash scripts/relais/verifier.sh` OK.

## Fichiers

- `app/page.tsx`
- `app/tarifs/page.tsx`

## Ne pas toucher

`app/layout.tsx`, `app/blog/`, `app/sitemap.ts`, les images, le code métier.

## Reprise

- Fait : rien.
- Reste : tout.
- Prochaine commande : `scripts/relais/codex-session.sh lancer 13-7-seo-accueil-tarifs`
