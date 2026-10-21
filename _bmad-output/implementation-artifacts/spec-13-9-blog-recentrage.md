---
title: "Corps des articles de blog recentrés sur « revenir »"
status: ready-for-dev
---

# Corps des articles de blog recentrés sur « revenir »

**Agent :** codex  
**Niveau :** moyen  
**Priorité :** basse

## Objectif

Positionnement : « Un petit jeu. Une vraie raison de revenir. » (jeu + carte de fidélité). Les titres, descriptions et CTA du blog sont alignés (13-8) ; il reste des mentions de Kado comme « outil à avis » dans les corps d'articles de `lib/blog.ts`.

## À faire

1. `grep -n "Kado" lib/blog.ts` : repérer les passages où Kado est présenté comme un outil pour obtenir des avis / abonnés (CTA internes, conclusions, encadrés). Les réécrire : jeu + carte de fidélité, raison de revenir. L'avis Google reste une option libre.
2. Ne pas toucher aux articles dont le sujet est l'avis Google (`comment-avoir-plus-avis-google-commerce`, `modele-message-demander-avis-google`, `repondre-avis-google-negatif`) sauf mention de Kado. Les conseils généraux et la mention du cadre légal (pas de cadeau contre un avis) restent.
3. Ajouter `modifiedDate: "2026-10-21"` aux articles dont le texte change.
4. Aucun texte ne promet un cadeau en échange d'un avis.

## Critères vérifiables

- [ ] Plus aucune phrase présentant Kado comme moyen d'obtenir « plus d'avis / d'abonnés » (`grep -n "Kado" lib/blog.ts`, relu).
- [ ] `modifiedDate` présent sur chaque article modifié.
- [ ] `bash scripts/relais/verifier.sh` OK.

## Fichiers

`lib/blog.ts`

## Ne pas toucher

Slugs, titres de métadonnées, structure des données, autres fichiers.

## Reprise

- Fait : rien.
- Reste : tout.
- Prochaine commande : `scripts/relais/codex-session.sh lancer 13-9-blog-recentrage`
