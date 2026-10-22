---
title: "Limite de tours par IP pour les joueurs sans empreinte"
status: ready-for-dev
---

# Limite de tours par IP pour les joueurs sans empreinte

**Agent :** codex  
**Niveau :** complexe  
**Priorité :** normale

## Objectif

Un joueur qui refuse l'empreinte n'est contrôlé que par son cookie : il peut rejouer en le supprimant (ou en navigation privée). Ajouter un plafond quotidien par commerce et par IP, appliqué **uniquement quand `deviceHash` est nul** (refus, consentement absent ou version obsolète). Le jeu doit rester utilisable après refus (RGPD) ; les démos restent illimitées.

## À faire

1. Dans `app/api/play/route.ts`, après le bloc `rateLimit` existant (ligne ~152), si `!isDemo && !deviceHash` : appliquer `rateLimit("play-nofp:<biz.id>:<hashRateLimitKey(ip)>", 20, 24*3600)`. Dépassement → `429 { error: "rate_limited" }`.
2. Vigilance : plusieurs vrais clients partagent le wifi du commerce (même IP). Le plafond de 20/jour ne compte donc que les tours sans empreinte, et doit rester une constante nommée en haut du fichier, facile à ajuster.
3. Côté `app/[slug]/Game.tsx`, vérifier que `429` affiche déjà un message clair et non une erreur technique ; sinon l'ajouter (texte en français, sans mentionner « IP »).
4. Ne pas collecter ni stocker l'IP en clair (réutiliser `hashRateLimitKey`). Aucun changement de texte de consentement ni de `confidentialite`.

## Critères vérifiables

- [x] Test dans `tests/play-route.test.ts` : sans `deviceHash`, le 21e tour du jour depuis la même IP et le même commerce renvoie 429.
- [x] Test : avec empreinte consentie, la limite `play-nofp` n'est pas appliquée.
- [x] Test : un commerce démo n'est jamais limité.
- [x] `bash scripts/relais/verifier.sh` OK.

## Fichiers

`app/api/play/route.ts`, `app/[slug]/Game.tsx`, `tests/play-route.test.ts`

## Ne pas toucher

`lib/rate-limit.ts`, migrations SQL, `lib/fingerprint-consent.ts`, pages légales.

## Reprise

- Fait : plafond 20 tours/24 h par commerce et IP hachée sans empreinte ; message 429 en français ; tests et verifier.sh OK.
- Reste : E2E non lancés (pas de spec dédiée).
- Prochaine commande : aucune.
