---
title: "Refonte visuelle de la vitrine et de la roue Kado"
status: review
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

- Fait : nouvelle direction « ticket de comptoir », roue de démo recolorée avec retour accessible, habillage de la roue 3D et adaptations mobile ; build de production réussi et commit local créé.
- Reste : publier et vérifier le déploiement Vercel. Le contrôle automatique a refusé la publication parce que le transfert de `app/globals.css` était tronqué ; le site en ligne n'a pas été modifié.
- Prochaine commande : obtenir l'accord de l'utilisateur avant une autre méthode de publication.
