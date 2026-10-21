---
title: "Métadonnées alignées sur le nouveau positionnement"
status: ready-for-dev
---

# Métadonnées alignées sur le nouveau positionnement

**Agent :** codex  
**Niveau :** simple  
**Priorité :** normale

## Objectif

Depuis la PR #217, l'image de partage annonce « Un petit jeu. Une vraie raison de revenir. » (jeu + carte de fidélité). Les métadonnées de `app/layout.tsx` parlent encore d'avis Google, d'abonnés Instagram et de « roue de la fortune » : un lien partagé affiche donc la nouvelle image sous l'ancien message. Les aligner.

## Contexte

- Source de vérité du message : `app/opengraph-image.png.alt.txt` et le titre/accroche de l'accueil dans `app/page.tsx`. Ne rien inventer au-delà.
- À modifier dans `app/layout.tsx` (≈ lignes 44-90) : `title.default`, `description`, `keywords`, `openGraph.title/description`, `twitter.title/description`.
- L'avis Google reste une option proposée, jamais le message principal ni lié au cadeau (pas de « review gating » : ne rien écrire qui promette des avis en échange d'un cadeau).
- Ne pas toucher : `metadataBase`, `icons`, `robots`, `alternates`, les images, les autres pages (blog inclus).
- Style : français, sans tiret long, titre ≤ 60 caractères, description ≤ 160.

## Critères vérifiables

- [ ] Aucune occurrence de « abonnés Instagram », « roue de la fortune » ni « avis 5★ » dans `title`, `description`, `keywords`, `openGraph`, `twitter` de `app/layout.tsx`.
- [ ] Titre et description cohérents avec le texte de `opengraph-image.png.alt.txt`.
- [ ] `title.default` ≤ 60 caractères, descriptions ≤ 160.
- [ ] Un test existant sur les métadonnées, s'il y en a, est mis à jour et passe.
- [ ] `bash scripts/relais/verifier.sh` OK.

## Fichiers

- `app/layout.tsx`

## Reprise

- Fait : rien.
- Reste : tout.
- Prochaine commande : `scripts/relais/codex-session.sh lancer 13-6-metadonnees-positionnement`
