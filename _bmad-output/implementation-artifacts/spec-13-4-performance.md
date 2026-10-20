---
title: "Performance du site public"
status: review
---

# Performance du site public

**Agent :** codex  
**Niveau :** moyen  
**Priorité :** normale

## Objectif

Accélérer les pages publiques (`/`, `/tarifs`, `/blog`, `/{slug}`) sans changer le rendu ni les prix. Cible : meilleur LCP / moins de JS.

## Critères vérifiables

- [x] Images : `next/image` avec `width/height`, `priority` uniquement sur l'image au-dessus de la ligne de flottaison, `loading=lazy` ailleurs ; pas d'image > 200 Ko non compressée dans `public/` utilisée par les pages publiques (convertir en webp/avif si utile).
- [x] Polices : `next/font` avec `display: swap`, pas de doublon de poids inutilisés.
- [x] Composants lourds non critiques (jeu, graphiques, éditeurs) chargés via `next/dynamic` ; pas de `"use client"` sur des pages qui n'en ont pas besoin (vitrine `/`, `/tarifs`, blog).
- [x] En-têtes de cache pour `public/` statique dans `next.config.mjs` ou `vercel.json` (immutable pour les assets hachés).
- [x] `npm run build` OK ; noter dans « Reprise » la taille JS first-load avant/après des routes `/` et `/tarifs`.
- [x] Ne pas toucher à Stripe, à l'authentification, aux migrations ni aux textes de prix.
- [x] `bash scripts/relais/verifier.sh` OK.

## Reprise

Fait : images du jeu en `next/image`, jeux chargés via `next/dynamic`, polices variables sans poids dupliqués, cache des ressources publiques ; tests ciblés (22) et vérificateur OK. Build validé avec `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=/tmp/mock-fonts-13-4.cjs` car le réseau bloque Google Fonts. Les fichiers hachés `/_next/static` gardent le cache immutable natif de Next.js. Aucun raster public utilisé ne dépasse 200 Ko.
JS initial estimé depuis les chunks du manifeste de build, non compressé : `/` 584,5 → 581,7 Kio ; `/tarifs` 586,3 → 583,4 Kio.
Reste : E2E navigateur et base réelle par Claude. Prochaine commande : `bash scripts/relais/verifier.sh` après reprise.
