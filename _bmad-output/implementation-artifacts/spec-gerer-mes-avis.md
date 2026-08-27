---
title: 'Gérer mes avis Google'
type: 'feature'
created: '2026-08-27'
status: 'draft'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On ne peut pas supprimer un avis Google négatif. Les commerçants Kado n'ont aujourd'hui aucun endroit pour agir face à un avis : répondre, signaler un avis abusif, ou obtenir de l'aide à la rédaction d'une réponse.

**Approach:** Ajouter un espace dashboard « Gérer mes avis » qui (a) renvoie vers la fiche Google du commerçant pour répondre/signaler, (b) rappelle les motifs de signalement valables, (c) génère un brouillon de réponse courtoise (logique pure, sans IA externe) que le commerçant personnalise. Aucune donnée d'avis n'est stockée.

## Boundaries & Constraints

**Always:** Réutiliser `review_url` de `wheel_configs` (lecture tolérante) et le durcir via `hardenExternalUrl`. Page en `merchantRoute`/`getMyBusiness` (auth + scoping). Logique de rédaction PURE et testée en `lib/`. Français. Respecter la conformité Google (répondre/signaler uniquement).

**Ask First:** _None._

**Never:** Ne JAMAIS prétendre supprimer un avis, ni acheter/truquer/filtrer des avis. Aucun appel à une IA/LLM externe (générateur = gabarits). Ne pas stocker le texte des avis en base. Ne pas appeler l'API Google (hors périmètre).

## I/O & Edge-Case Matrix

Fonction pure `draftReviewReply({ shopName, kind, tone, authorName? })` :

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Avis négatif, ton sobre | kind="negatif", tone="sobre", authorName="Marc" | Brouillon FR : salutation nominative, excuse mesurée, invitation à résoudre hors-ligne, signature commerce | N/A |
| Avis positif, ton chaleureux | kind="positif", tone="chaleureux" | Brouillon FR : remerciement chaleureux + invitation à revenir | N/A |
| Avis mitigé | kind="mitige" | Brouillon FR : remercie, prend note du point négatif, promet de s'améliorer | N/A |
| Sans prénom | authorName absent/vide | Salutation générique (« Bonjour, ») | N/A |
| shopName vide | shopName="" | Signature de repli (« L'équipe ») sans plantage | N/A |

## Tasks & Acceptance

**Execution:**
- [ ] `lib/review-reply.ts` -- créer `draftReviewReply(input)` pur : type `ReviewReplyKind = 'negatif'|'mitige'|'positif'`, `ReviewReplyTone = 'sobre'|'chaleureux'`. Assemble salutation (nominative si `authorName`), corps selon `kind` (négatif→excuse+résolution ; mitigé→note+amélioration ; positif→remerciement), nuance de `tone`, signature `${shopName} via ...` ou repli « L'équipe ». Échappe/`trim` `authorName` (garder texte simple, pas de HTML). -- cœur métier testable
- [ ] `tests/review-reply.test.ts` -- couvrir les 5 scénarios de la matrice + variations de ton -- garantir la logique pure
- [ ] `app/dashboard/avis/page.tsx` -- page serveur : `getMyBusiness`, lecture tolérante de `review_url` (admin client), calcule `reviewHref = hardenExternalUrl(review_url)`. Rend : bloc « Répondre / signaler sur Google » (lien si `reviewHref`, sinon invite à renseigner le lien dans « Mon jeu ») ; bloc mémo des motifs de signalement ; `<AvisClient shopName=… />`. -- point d'entrée
- [ ] `app/dashboard/avis/AvisClient.tsx` -- client : zone de texte (coller l'avis, pour référence), sélecteurs `kind` + `tone`, champ prénom facultatif, bouton « Générer un brouillon » → appelle `draftReviewReply`, affiche le brouillon éditable + bouton « Copier ». -- assistant de réponse
- [ ] `app/dashboard/layout.tsx` -- ajouter un lien nav `⭐ Avis` (`Icon name="star"`) vers `/dashboard/avis` -- accès
- [ ] `app/globals.css` -- styles minimaux pour la page avis (mémo, brouillon) en réutilisant les classes `dash-card`/`field` existantes -- présentation

**Acceptance Criteria:**
- Given un commerçant connecté avec `review_url` renseigné, when il ouvre `/dashboard/avis`, then il voit un lien direct vers sa fiche Google (href durci) + le mémo + l'assistant.
- Given `review_url` absent, when il ouvre la page, then un message l'invite à renseigner son lien d'avis dans « Mon jeu » (aucun lien vide, aucune erreur).
- Given un avis collé + un `kind`/`tone` choisis, when il clique « Générer », then un brouillon FR cohérent s'affiche, éditable et copiable, sans appel réseau.
- Given la nav du dashboard, when la page se charge, then l'entrée « Avis » est présente et pointe vers `/dashboard/avis`.

## Code Map

- `app/dashboard/layout.tsx:117-157` -- nav sidebar (`<nav className="dash-nav">`), `hasModule`/`Icon` déjà importés ; y ajouter l'entrée. Icône `star` disponible (components/icons.tsx).
- `lib/wheel.ts:175` -- `hardenExternalUrl(raw)` (anti-XSS), et `reviewCtaHref`/`shouldShowReviewCta` (patterns d'usage de `review_url`).
- `app/dashboard/wheel/page.tsx` -- exemple de lecture tolérante de `wheel_configs` via `getAdminClient` + `getMyBusiness`.
- `lib/auth.ts` -- `getMyBusiness()` (business + scoping).
- `components/icons.tsx` -- `Icon`, contient `star`, `redeem`, etc.
- `app/globals.css:~2180` -- variables thème (`--g-blue`…) et classes `dash-card`, `field`, `btn` réutilisables.

## Design Notes

Générateur = gabarits FR assemblés (pas d'IA). Exemple (négatif, sobre, « Marc ») :
```
Bonjour Marc,

Merci d'avoir pris le temps de partager votre retour, et navré que votre
expérience n'ait pas été à la hauteur. Ce n'est pas ce que nous souhaitons
pour nos clients. Nous aimerions comprendre ce qui s'est passé et trouver une
solution : n'hésitez pas à nous contacter directement.

Bien à vous,
L'équipe de {shopName}
```
Le ton « chaleureux » ajoute des formulations plus chaudes ; « sobre » reste factuel. Le texte de l'avis collé sert de référence à l'écran, il n'est PAS analysé (honnête : pas de fausse « compréhension »).

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: aucune erreur
- `npx vitest run tests/review-reply.test.ts` -- expected: tous verts
- `npx next lint --file lib/review-reply.ts --file app/dashboard/avis/page.tsx --file app/dashboard/avis/AvisClient.tsx --file app/dashboard/layout.tsx` -- expected: no warnings
- `npx next build` -- expected: build OK
