---
title: "Performance du site public"
status: ready-for-dev
---

# Performance du site public

**Agent :** codex  
**Niveau :** moyen  
**Priorité :** normale

## Objectif

Accélérer les pages publiques (`/`, `/tarifs`, `/blog`, `/{slug}`) sans changer le rendu ni les prix. Cible : meilleur LCP / moins de JS.

## Critères vérifiables

- [ ] Images : `next/image` avec `width/height`, `priority` uniquement sur l'image au-dessus de la ligne de flottaison, `loading=lazy` ailleurs ; pas d'image > 200 Ko non compressée dans `public/` utilisée par les pages publiques (convertir en webp/avif si utile).
- [ ] Polices : `next/font` avec `display: swap`, pas de doublon de poids inutilisés.
- [ ] Composants lourds non critiques (jeu, graphiques, éditeurs) chargés via `next/dynamic` ; pas de `"use client"` sur des pages qui n'en ont pas besoin (vitrine `/`, `/tarifs`, blog).
- [ ] En-têtes de cache pour `public/` statique dans `next.config.mjs` ou `vercel.json` (immutable pour les assets hachés).
- [ ] `npm run build` OK ; noter dans « Reprise » la taille JS first-load avant/après des routes `/` et `/tarifs`.
- [ ] Ne pas toucher à Stripe, à l'authentification, aux migrations ni aux textes de prix.
- [ ] `bash scripts/relais/verifier.sh` OK.

## Reprise

Fait : rien.
