---
title: "SEO blog, image de partage et sitemap"
status: ready-for-dev
---

# SEO blog, image de partage et sitemap

**Agent :** codex  
**Niveau :** moyen  
**Priorité :** normale

## Objectif

Positionnement : « Un petit jeu. Une vraie raison de revenir. » (jeu + carte de fidélité). Aligner le blog et corriger les manques techniques relevés par l'audit SEO du 2026-10-21 (points 3 et 5). Indépendante de 13-7 (fichiers différents).

## Contexte

- L'avis Google reste une option libre, jamais liée au cadeau : ne pas promettre de cadeau contre un avis.
- Numéros de ligne de l'audit périmés : chercher avec `grep -n "avis\|Avis" app/blog lib/blog.ts`.
- `lib/blog.ts` contient ~90 occurrences de « avis » : ne réécrire que les titres, descriptions, extraits et introductions qui servent de message principal ; laisser les articles de fond sur les avis Google qui restent exacts.

## À faire

1. **Blog** : réécrire la description de l'index (`app/blog/page.tsx`, ~l.9), les accroches ~l.37 et ~l.57, et la description d'article (`app/blog/[slug]/page.tsx`, ~l.133) autour de « jeu + carte, revenir ».
2. **JSON-LD Article** (`app/blog/[slug]/page.tsx`) : `dateModified` distinct de `datePublished` si la donnée existe (sinon l'omettre), `image` (image de partage du site), `publisher`/`author` en référence `@id` `https://kado-app.fr/#organization`. Ajouter `openGraph.images` et `twitter.images` à la page article.
3. **Image de partage** : `lib/public-metadata.ts` n'a pas d'`og:image`/`twitter:image` ; vérifier d'abord si `app/opengraph-image.png` est hérité par les routes enfants, sinon l'ajouter explicitement.
4. **Sitemap** (`app/sitemap.ts`) : ajouter `/cafe-lumiere` (si la page est indexable), vérifier que `/temoignages` existe, remplacer `lastModified: now` par des dates fixes (constantes) pour les pages hors blog.

## Critères vérifiables

- [ ] `grep -n "avis" app/blog/page.tsx "app/blog/[slug]/page.tsx"` ne renvoie plus de message principal sur les avis.
- [ ] Une page article rendue expose `og:image` et `twitter:image`.
- [ ] Le sitemap ne contient que des URLs existantes et plus de `new Date()` pour les pages statiques.
- [ ] Aucun texte ne promet un cadeau en échange d'un avis.
- [ ] Tests existants mis à jour et passent ; `bash scripts/relais/verifier.sh` OK.

## Fichiers

`app/blog/page.tsx`, `app/blog/[slug]/page.tsx`, `lib/blog.ts` (titres/extraits seulement), `lib/public-metadata.ts`, `app/sitemap.ts`

## Ne pas toucher

`app/page.tsx`, `app/tarifs/page.tsx`, `app/layout.tsx` (fiche 13-7 / 13-6), les images, le code métier.

## Reprise

- Fait : rien.
- Reste : tout.
- Prochaine commande : `scripts/relais/codex-session.sh lancer 13-8-seo-blog-sitemap`
