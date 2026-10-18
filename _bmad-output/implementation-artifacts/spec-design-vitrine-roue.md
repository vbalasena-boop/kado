---
title: "Refonte visuelle de la vitrine et de la roue Kado"
status: done
---

# Refonte visuelle de la vitrine et de la roue Kado

**Agent :** codex  
**Niveau :** moyen  
**Priorité :** haute

## Objectif

Rendre la page d'accueil Kado et l'expérience de la roue plus distinctives, cohérentes et soignées, sur mobile comme sur ordinateur, sans changer les règles du jeu ni les couleurs choisies par les commerces.

## Critères vérifiables

- La vitrine adopte une direction éditoriale cohérente et lisible sur petits et grands écrans.
- L'aperçu de roue et la roue jouée ont un habillage tactile distinctif, avec des contrôles accessibles.
- Les couleurs, probabilités, lots et résultat du jeu restent pilotés par la configuration serveur existante.
- Les animations respectent la préférence de réduction des mouvements.

## Fichiers

- `app/globals.css`
- `components/HomeWheel.tsx`
- `components/HeroEditorial.tsx` si nécessaire

## Reprise

- Fait : nouvelle direction « ticket de comptoir », roue de démo recolorée avec retour accessible, habillage de la roue 3D et adaptations mobile ; build réussi, déploiement Vercel prêt et nouvelle vitrine vérifiée sur `kado-app.fr`.
- Reste : aucun.
- Prochaine commande : aucune.
