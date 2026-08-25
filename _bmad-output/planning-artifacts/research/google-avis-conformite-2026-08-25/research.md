# Recherche décisionnelle — Conformité du mécanisme d'avis Google (Kado)

> BMAD Deep Recon · type domaine + concurrentiel · forme *select* · 2026-08-25
> Décision à éclairer : quelle option (A/B/C) inscrire au PRD pour le mécanisme
> « débloquer un tour de jeu en ouvrant la page d'avis Google ».

## ⚠️ Fiabilité des sources (à lire d'abord)
L'accès direct aux sources primaires (Google Help, Légifrance, EUR-Lex, DGCCRF,
AFNOR) a été **bloqué par la politique réseau (403)** durant ce run. Les affirmations
reposent sur des **restitutions secondaires concordantes** (éditeur + URL + date
d'accès 2026-08-25) ; les **dates de publication et libellés exacts restent à
re-vérifier** en lecture directe. **Aucune jurisprudence** spécifique aux « roues
de la fortune ouvrant la page d'avis » n'a été trouvée. Pour un usage juridique,
faire valider par un conseil.

## Le cas évalué
Un tour de jeu (roue/gratter) se débloque quand le client clique un bouton qui
**ouvre la page d'avis Google** du commerce. Le cadeau est donné pour l'**action de
clic/visite** — **non conditionné** à l'écriture d'un avis ni à une note positive,
sans vérification. Mention « le cadeau n'est pas conditionné à la note » affichée.

## Constat n°1 — Droit FR/UE : défendable si transparent
- La loi (directive **Omnibus** UE 2019/2161, transposée FR le 28/05/2022) interdit
  les **faux avis** et l'**absence de transparence**, **pas** l'invitation à laisser
  un avis. *(DGCCRF/economie.gouv.fr, accès 2026-08-25 — source secondaire.)*
- Offrir une contrepartie est **licite sous 2 conditions** : (a) **non conditionnée**
  à la teneur/note, (b) **transparente**. *(blogdumoderateur, guest-suite.)*
- La norme **AFNOR NF Z74-501 / ISO 20488** (volontaire) tolère une contrepartie
  **par tirage au sort parmi les participants**, jamais liée au dépôt/teneur — proche
  de la logique « cadeau pour l'action ». *(les-infostrateges, afnor.)*
- Sanction pratique trompeuse : jusqu'à **5 ans / 750 000 €**, portable à **10 % du CA**.
  *(dreyfus.fr, ~2025.)*
- **Application** : le design de Kado (cadeau pour jouer, non conditionné) est le
  **montage le moins risqué légalement**. Risque résiduel = tromperie par omission si
  la contrepartie n'est pas transparente, ou si le jeu oriente vers un avis positif.

## Constat n°2 — Google (plateforme) : plus strict que la loi, et ça mord
- Les CGU Google interdisent **toute** incitation « en échange de la publication de
  **tout** avis » (positif ou négatif) : réductions, cartes cadeaux, points,
  **participations à des jeux/concours inclus**. *(Google « Incentivized/Biased
  Reviews » & « Prohibited content », via sources secondaires ; WiserReview cite
  explicitement les « spin the wheel prize games ».)*
- **Enforcement récent (~août-sept. 2025)** : Google Maps demande aux utilisateurs
  *« ce commerce offre-t-il une récompense en échange d'avis ? »* ; un **« oui »**
  déclenche la **suppression rétroactive** des avis. *(PPC Land, Search Engine
  Roundtable, Thrive.)* → un client ayant tourné la roue **puis** été routé vers la
  page d'avis peut légitimement répondre « oui ».
- **Zone grise reconnue** : la lettre vise « en échange de publier un avis » ; Kado ne
  conditionne pas à la publication. Mais aucune source ne montre de **dérogation**
  Google pour « récompenser la visite » ; la mécanique **couple** la récompense au
  parcours d'avis → traitée en pratique comme « cadeau contre avis ».

## Constat n°3 — Pratiques concurrentes : le point de conformité = *quelle action*
- Outils « tap for review » (NFC/QR) : se disent conformes **parce qu'ils ne
  récompensent rien** (simplifient l'accès, demandent à tous, au neutre).
- Jeux/roues d'avis (Boostigo, Cadeo, Riwil, Digilor, Up Review) : les plus prudents
  rendent **l'action déclenchante configurable et de préférence *non-avis*** (suivi
  réseaux / coordonnées), pour affirmer « on ne récompense pas l'avis ». *(digilor,
  glozz, guest-suite.)*
- **Consensus** : récompenser **l'action d'aller sur la page d'avis** = **risqué**
  (couplé à l'avis) ; récompenser un **suivi Instagram / une inscription** = **plus
  sûr** (hors périmètre avis).

## Verdict de synthèse
Il y a un **écart entre le droit et la plateforme** :
- **Légalement (FR/UE)** : le design de Kado est **défendable** s'il est transparent.
- **Côté Google** : le mécanisme est en **zone grise penchant risqué**, et
  l'**enforcement 2025 le rend activement dangereux** — le risque (suppression d'avis,
  fiche signalée) est porté par **le commerçant**, ce qui en fait un enjeu de
  **confiance B2B**, pas seulement de conformité.

## Recommandation → Option B (découpler la mécanique)
**Récompenser le jeu / le scan (ou une action *non-avis* : suivi Instagram, inscription
fidélité, opt-in), et faire de l'avis Google un CTA optionnel NON récompensé** (« pendant
que vous êtes là, un avis nous aiderait 🙏 »). Concrètement :
1. Le tour se débloque par une **action non-avis** ou par le simple fait de jouer.
2. Le lien « laisser un avis Google » devient un **CTA à part, sans lien avec le cadeau**.
3. Rendre l'action déclenchante **configurable** par commerçant (pattern des acteurs prudents).
4. Conserver la **mention de transparence** (exigence légale) + un règlement de jeu.

**Pourquoi B plutôt que :**
- **A** (sortir totalement l'avis) : plus sûr encore, mais Kado y perd un CTA d'avis
  organique utile ; B garde l'avis en organique sans le récompenser → même bénéfice
  plateforme, plus de valeur.
- **C** (statu quo + CGU) : ne règle pas le risque Google (couplage maintenu) ; la
  responsabilité transférée au commerçant ne le protège pas de la suppression d'avis.

**Impact produit** : changement modéré, localisé (`Game.tsx` : ce qui débloque le 2ᵉ
tour + présentation du lien avis). À cadrer en story.

## Questions ouvertes
- **[V]** Re-vérifier les libellés Google exacts + dates en lecture directe (egress bloqué ce run).
- **[V]** Confirmer avec un **conseil juridique FR** avant de communiquer un argumentaire de conformité aux commerçants.
