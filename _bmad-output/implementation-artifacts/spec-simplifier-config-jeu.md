---
title: "Simplifier les réglages du jeu Kado"
status: done
---

# Simplifier les réglages du jeu Kado

**Agent :** codex  
**Niveau :** simple  
**Priorité :** haute

## Objectif

Afficher d'abord les cadeaux à configurer et replier les contrôles rarement modifiés.

## Critères vérifiables

- La liste des cadeaux reste visible dès l'ouverture de l'onglet.
- Les limites, la validité des cadeaux et les alertes sont accessibles dans « Réglages avancés ».
- Les contrôles avancés restent fonctionnels et accessibles au clavier.

## Fichiers

- `app/dashboard/wheel/WheelEditor.tsx`
- `app/globals.css`

## Reprise

- Fait : regroupé les limites et notifications dans un panneau repliable.
- Reste : aucun.
- Prochaine commande : aucune — tests, lint, types et build terminés.
