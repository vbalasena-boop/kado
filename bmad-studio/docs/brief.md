# Project Brief — BMAD Studio

> Document produit selon la **BMAD Method** · Rôle : **Analyste (Mary)** · v0.1 · 2026-08-20
> _(Dogfooding : l'outil qui automatise BMAD, cadré avec BMAD.)_

---

## Résumé exécutif

**BMAD Studio** est une application web qui transforme une simple description d'idée
en un **dossier de cadrage complet** : analyse de faisabilité, PRD, architecture et
roadmap. Chaque étape est jouée par un rôle BMAD incarné par Claude, chaque étape
s'appuyant sur les artefacts de la précédente.

La promesse centrale n'est pas « générer du code », mais **sécuriser la phase amont** —
là où la plupart des projets échouent : mauvaise évaluation de la faisabilité, périmètre
flou, risques ignorés.

## Problème

- Les porteurs d'idées (entrepreneurs, PME, indies) manquent d'une **méthode structurée**
  pour évaluer une idée avant d'investir temps et argent.
- Les outils IA existants sautent directement au code et **ignorent le cadrage**
  (faisabilité, exigences, risques).
- Faire ce travail à la main demande de l'expérience produit que tout le monde n'a pas.

## Solution proposée

Une chaîne BMAD guidée :
- **entrée minimale** (idée + 4 questions de cadrage) pour un résultat solide ;
- **sortie structurée** pour la faisabilité (score, verdict, avantages, contraintes,
  risques, hypothèses) — pas juste un mur de texte ;
- **chaînage** : le PRD s'appuie sur l'analyse, l'architecture sur le PRD, la roadmap
  sur l'architecture ;
- **honnêteté** : le rapport sépare faits et hypothèses à valider — aide à la décision,
  pas oracle.

## Utilisateurs cibles

**Segment primaire — le porteur d'idée** : entrepreneur solo, PME, product manager
junior, freelance. Veut savoir vite si une idée tient la route et comment la découper.

**Segment secondaire — l'équipe produit** : utilise le dossier généré comme premier
jet à challenger, pour gagner du temps de cadrage.

## Objectifs & métriques de succès

- Produire une analyse de faisabilité exploitable en < 1 minute.
- Un dossier complet (4 artefacts) prêt à exporter en < 5 minutes.
- Sortie assez spécifique pour être utile (jamais générique).

## Périmètre du MVP

**Inclus**
- Saisie idée + cadrage guidé.
- Étape Analyste avec rendu structuré (faisabilité).
- Étapes PM / Architecte / SM en markdown, chaînées.
- Export markdown du dossier complet.

**Exclu (plus tard)**
- Persistance / comptes / historique des dossiers.
- Streaming des réponses (UX temps réel).
- Édition inline des artefacts + régénération partielle.
- Génération de code / scaffolding réel.
- Collaboration multi-utilisateurs.

## Contraintes

- **Qualité dépendante de l'entrée** → mitigée par le cadrage guidé obligatoire.
- **Coût par dossier** (tokens) → modèle configurable, artefacts à la demande.
- **« Faisabilité » ≠ vérité** → cadrage explicite comme aide à la décision.
- **Latence** en « effort high » → à surveiller côté déploiement serverless.

## Hypothèses à valider

- Les utilisateurs acceptent de répondre à 4 questions de cadrage pour un meilleur résultat.
- La sortie structurée de faisabilité est jugée plus utile qu'un texte libre.
- Le chaînage des étapes apporte assez de valeur pour justifier l'attente.

## Prochaines étapes

1. Valider la qualité des sorties sur 5–10 idées réelles.
2. Ajouter la persistance (sauver/rouvrir un dossier).
3. Passer les étapes longues en streaming.
4. Édition inline + régénération ciblée d'une section.
