---
title: "Simplifier l'espace commerçant Kado"
status: in-progress
---

# Simplifier l'espace commerçant Kado

**Agent :** codex  
**Niveau :** moyen  
**Priorité :** haute

## Objectif

Réduire la charge de choix dans l'espace commerçant : placer les actions fréquentes au premier plan et révéler l'aide et les outils secondaires à la demande, sans retirer de fonction.

## Critères vérifiables

- Les tâches fréquentes restent accessibles directement depuis la navigation principale, y compris sur mobile sans bouton de menu supplémentaire.
- Les outils moins fréquents sont regroupés dans une section repliable, ouverte automatiquement sur une page secondaire.
- La vidéo d'aide ne concurrence plus la checklist de démarrage.
- La navigation repliable reste utilisable au clavier et sur mobile.

## Fichiers

- `app/dashboard/DashboardNav.tsx`
- `app/dashboard/layout.tsx`
- `app/dashboard/page.tsx`
- `app/globals.css`

## Reprise

- Fait : actions courantes dans la navigation principale, outils secondaires dans « Autres outils », aide vidéo repliable et onglets de la roue renommés clairement.
- Reste : passer les contrôles, puis publier les changements.
- Prochaine commande : lancer `scripts/relais/verifier.sh`.
