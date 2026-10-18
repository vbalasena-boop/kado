---
title: 'Donner une identité visuelle singulière à la vitrine Kado'
type: 'feature'
created: '2026-10-18'
status: 'done'
review_loop_iteration: 0
baseline_commit: '023cd287abe2b3657a7ea71978de54d5da075df4'
context: []
---

**Agent :** codex
**Niveau :** moyen
**Priorité :** normale

## Objectif

Remplacer l’esthétique SaaS sombre, brillante et très animée de la page d’accueil par une direction éditoriale chaleureuse, reconnaissable et liée aux commerces de proximité.

## Critères vérifiables

- La page d’accueil a une composition et des détails visuels propres à Kado, pas un assemblage de dégradés, cartes translucides et animations de démonstration.
- Le premier écran montre clairement le produit et ses appels à l’action sur ordinateur et mobile.
- Les sections, le jeu interactif, les tarifs et le pied de page restent accessibles et cohérents dans la nouvelle identité.
- Le parcours conserve ses liens et contenus fonctionnels.

## Fichiers

- `components/HeroCinematic.tsx`
- `app/page.tsx`
- `app/globals.css`

## Reprise

- Fait : accueil restructuré en affiche éditoriale « papier de comptoir », sections harmonisées et contrastes vérifiés dans le navigateur ; changement poussé et publié sur kado-app.fr.
- Reste : aucun point bloquant pour cette story.
- Vérification : `scripts/relais/verifier.sh` réussi (tests, lint, TypeScript) ; compilation et vérification du diff déjà réussies.
- Prochaine commande : aucune.
