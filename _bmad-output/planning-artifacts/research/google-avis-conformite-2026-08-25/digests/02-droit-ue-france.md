# Digest 02 — Cadre légal UE + France applicable aux avis en ligne incités

- **Run** : 2026-08-25 (date d'accès de toutes les sources ci-dessous)
- **Sujet** : cadre LÉGAL (au-delà des CGU Google) pour un jeu où le client débloque un tour + cadeau en cliquant un bouton qui ouvre la page d'avis Google. Cadeau donné pour l'action, NON conditionné à l'écriture d'un avis ni à la note.
- **Produit** : vendu à des commerçants français.

## ⚠️ Note méthodologique sur les sources (à lire d'abord)

Contrainte technique de ce run : l'accès `WebFetch` aux **sources primaires** (Légifrance, EUR-Lex, economie.gouv.fr/DGCCRF, signal.conso.gouv.fr, normalisation.afnor.org) a été **bloqué par la politique d'egress de l'organisation (403/407)** sur tous les domaines .gouv.fr, europa.eu et afnor.org testés. Le contenu ci-dessous provient donc de recherches web (`WebSearch`) exécutées CE RUN, qui restituent et citent ces sources primaires via des intermédiaires (cabinets d'avocats, éditeurs spécialisés, presse) ainsi que des extraits des pages officielles remontées par le moteur. **Distinction primaire/secondaire signalée pour chaque claim.** Les numéros d'articles et les montants sont concordants entre plusieurs sources indépendantes ; ils devraient être re-vérifiés directement sur Légifrance/EUR-Lex avant tout usage contractuel ou juridique. Là où une date de publication n'a pas pu être confirmée, c'est écrit « date non confirmée ».

---

## 1. Directive Omnibus (UE) 2019/2161 et sa transposition française

**Claim 1.1 — Adoption et objet.** La directive (UE) 2019/2161 dite « Omnibus » du 27 novembre 2019 modifie plusieurs directives de consommation, dont la directive 2005/29/CE sur les pratiques commerciales déloyales, pour l'adapter aux plateformes et aux avis en ligne.
- Source (secondaire) : cms.law, « Transposition de la directive Omnibus » — https://cms.law/fr/fra/news-information/transposition-de-la-directive-omnibus — date de publication non confirmée ce run. Accès 2026-08-25.
- Corroboré par : review-collect.com, glossaire « Directive Omnibus » — https://www.review-collect.com/en/glossaire/omnibus-directive — accès 2026-08-25.

**Claim 1.2 — Transposition en France.** Transposée par l'**ordonnance n° 2021-1734 du 22 décembre 2021** (annoncée par la loi DDADUE du 3 décembre 2020) ; **entrée en application le 28 mai 2022** (art. 10 de l'ordonnance).
- Source (secondaire, citant les textes) : cms.law — https://cms.law/fr/fra/news-information/transposition-de-la-directive-omnibus — accès 2026-08-25.
- Corroboré (primaire indirect) : DGCCRF / economie.gouv.fr, remonté par WebSearch : « Depuis le 28 mai 2022, le code de la consommation interdit deux nouvelles pratiques commerciales trompeuses… » — https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/avis-en-ligne-attention-aux-faux-commentaires (page officielle non fetchable ce run ; extrait via moteur). Accès 2026-08-25.

**Claim 1.3 — Deux nouvelles pratiques trompeuses interdites « en toutes circonstances » (liste noire, annexe I de la dir. 2005/29 ; transposées au Code de la consommation, art. L121-4).** Depuis le 28 mai 2022 il est interdit :
  (a) d'**affirmer que des avis émanent de consommateurs ayant réellement acheté/utilisé le produit sans avoir pris de mesures raisonnables et proportionnées pour le vérifier** ;
  (b) de **diffuser de faux avis ou de fausses recommandations de consommateurs, ou de commander/charger un tiers de le faire, ou de dénaturer des avis** pour promouvoir des produits.
- Source (primaire indirect, DGCCRF) : economie.gouv.fr, fiche « Avis en ligne : attention aux faux commentaires » — formulation reprise mot pour mot par WebSearch — https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/avis-en-ligne-attention-aux-faux-commentaires — accès 2026-08-25.
- Base UE (primaire, non fetchable ce run) : directive 2005/29/CE, annexe I, points ajoutés par l'Omnibus (communément numérotés 23 ter / 23 quater) — EUR-Lex CELEX 32005L0029 et guidance de la Commission CELEX 52021XC1229(05) — https://eur-lex.europa.eu/legal-content/FR/TXT/HTML/?uri=CELEX:32005L0029 — accès (bloqué) 2026-08-25, référence non vérifiée directement.

**Claim 1.4 — Obligation d'information / transparence (art. L111-7-2 du Code de la consommation).** Toute personne dont l'activité consiste, même à titre accessoire, à **collecter, modérer ou diffuser des avis en ligne de consommateurs** doit délivrer une information **loyale, claire et transparente** sur les modalités de publication et de traitement des avis. En particulier : indiquer si les avis font l'objet d'un contrôle et, le cas échéant, ses caractéristiques principales ; afficher la date de l'avis et de ses mises à jour ; indiquer aux auteurs les motifs de rejet d'un avis ; offrir une fonctionnalité gratuite de signalement de doute sur l'authenticité.
- Source (secondaire, citant l'article) : donneespersonnelles.fr, « Avis clients en ligne : les obligations légales 2026 » — https://www.donneespersonnelles.fr/avis-clients-en-ligne — accès 2026-08-25.
- Références primaires (non fetchables ce run) : Légifrance, art. L111-7-2 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049571119 ; version historique doctrine.fr LEGIARTI000033207118 — accès 2026-08-25.
- ⚠️ Portée : L111-7-2 vise ceux qui **collectent/modèrent/diffusent** des avis. Google est la plateforme diffusante ; un commerçant qui se contente d'inviter ses clients à laisser un avis sur Google n'est en principe pas « éditeur d'avis » au sens de L111-7-2, mais reste soumis à l'interdiction des pratiques trompeuses (L121-2 s.). Nuance importante pour le cas — voir §4.

**Claim 1.5 — Sanctions.** Voir §2 (harmonisées avec le régime des pratiques commerciales trompeuses).

---

## 2. DGCCRF — contrôles et sanctions

**Claim 2.1 — Définition opérationnelle du faux avis.** La DGCCRF définit le faux avis comme un commentaire publié par une personne qui n'a jamais réellement acheté ou utilisé le produit/service évalué ; sa publication est une pratique commerciale trompeuse « en toutes circonstances ».
- Source (primaire indirect, DGCCRF) : economie.gouv.fr, fiche « Avis en ligne : attention aux faux commentaires » — extraits via WebSearch — accès 2026-08-25.
- Corroboré (secondaire) : signal.conso.gouv.fr, actualité « Faux avis » — https://signal.conso.gouv.fr/fr/actualites/faux-avis (non fetchable ce run) — accès 2026-08-25.

**Claim 2.2 — Sanctions et montants (pratiques commerciales trompeuses, art. L132-2 s. du Code de la consommation).**
  - Régime « classique » : jusqu'à **2 ans d'emprisonnement et 300 000 €** d'amende.
  - Lorsque la pratique est commise via internet / support numérique : jusqu'à **5 ans et 750 000 €**.
  - L'amende peut être portée à **10 % du chiffre d'affaires moyen annuel** (3 derniers exercices) ou **50 % des dépenses engagées** pour la pratique.
- Source (secondaire, concordante multi-sources) : dreyfus.fr, « Faux avis en ligne : la France renforce son encadrement » (2025) — https://www.dreyfus.fr/en/2025/06/30/fake-online-reviews-france-strengthens-legal-oversight/ — date de publication ~30 juin 2025. Accès 2026-08-25.
- Corroboré : guest-suite.com, « Récompense en échange d'avis clients : est-ce vraiment légal ? » — https://www.guest-suite.com/blog/recompense-echange-avis-clients (non fetchable ce run, extraits WebSearch) — accès 2026-08-25.

**Claim 2.3 — Outil de détection « Polygraphe ».** La DGCCRF exploite un outil algorithmique interne (« Polygraphe ») analysant schémas linguistiques, fréquence de dépôt et données géographiques pour détecter les faux avis.
- Source (primaire indirect, DGCCRF) : economie.gouv.fr, « Comment la DGCCRF enquête sur les faux avis » — https://www.economie.gouv.fr/dgccrf/actualites-dgccrf/comment-la-dgccrf-enquete-sur-les-faux-avis (extraits WebSearch) — accès 2026-08-25.

**Claim 2.4 — Mesures correctives.** La DGCCRF peut ordonner des mesures techniques (déréférencement dans les moteurs, restriction d'accès par les FAI) ; un site e-commerce a été bloqué pour faux avis.
- Source (secondaire) : jacquelinebrunelet-avocat.com, « Faux avis en ligne : la DGCCRF bloque un site e-commerce » — https://jacquelinebrunelet-avocat.com/dgccrf-faux-avis-bloque-site-ecommerce — date non confirmée. Accès 2026-08-25.

**Claim 2.5 — Résultats de contrôle (à consolider — chiffres divergents entre sources).**
  - Version A : « **55 %** des sites contrôlés en 2024 présentaient des irrégularités » dans la collecte/modération/publication des avis.
    - Source (secondaire) : legatineauexpress.com, « Faux avis en ligne : la DGCCRF muscle ses contrôles en 2026 » — https://www.legatineauexpress.com/conso-shopping/faux-avis-en-ligne-dgccrf-controles-2026/ — accès 2026-08-25.
  - Version B : « **près d'un tiers des 397 établissements** contrôlés en 2024 pour faux avis présentaient des anomalies », dans le cadre du **bilan 2024 de la DGCCRF présenté le 13 mars 2025** (Véronique Louwagie, ministre déléguée au Commerce ; Sarah Lacoche, directrice). Bilan global : ~65 000 établissements/sites inspectés, >2 300 amendes, >3 350 procès-verbaux.
    - Source (primaire indirect) : presse.economie.gouv.fr, « Présentation du bilan 2024 de la DGCCRF » — https://presse.economie.gouv.fr/presentation-du-bilan-2024-de-la-dgccrf/ (extraits WebSearch) — accès 2026-08-25.
  - ⚠️ **Non vérifié** : les deux chiffres (55 % de sites vs un tiers de 397 établissements) ne concordent pas ; probablement deux périmètres/enquêtes différents. À trancher sur la source officielle avant citation.
  - Question sénatoriale récente confirmant l'attention parlementaire : senat.fr, « Faux commentaires et avis en ligne » (2025) — https://www.senat.fr/questions/base/2025/qSEQ250504537.html — accès 2026-08-25.

---

## 3. Norme AFNOR NF Z74-501 / ISO 20488

**Claim 3.1 — Nature et périmètre.** NF Z74-501 « Avis en ligne de consommateurs — Principes et exigences portant sur les processus de collecte, modération et restitution des avis en ligne » est une **norme volontaire** (non obligatoire), publiée en **juillet 2013** (disponible le 4 juillet 2013), destinée à lutter contre les faux avis par la transparence.
- Source (primaire indirect, AFNOR) : normalisation.afnor.org, « AFNOR publie la première norme volontaire pour fiabiliser le traitement des avis en ligne » (non fetchable ce run) — https://normalisation.afnor.org/actualites/afnor-publie-la-premiere-norme-volontaire-pour-fiabiliser-le-traitement-des-avis-en-ligne-de-consommateurs/ — accès 2026-08-25.
- Corroboré (secondaire, daté) : clubic.com, « L'Afnor présente sa norme NF Z74-501 » — https://www.clubic.com/pro/actualite-e-business/actualite-569786-afnor-norme-ligne.html (juillet 2013) — accès 2026-08-25 ; les-infostrateges.com — https://www.les-infostrateges.com/actu/faux-avis-de-consommateurs-a-propos-de-la-norme-afnor-z74-501 — accès 2026-08-25.

**Claim 3.2 — Passage à l'international : ISO 20488.** NF Z74-501 a servi de base à la norme internationale **ISO 20488, publiée en octobre 2018**, sur le même objet.
- Source (secondaire) : plus-que-pro-solution.fr, « La norme NF Z74-501 donne naissance à la norme ISO 20488 » — https://www.plus-que-pro-solution.fr/une-nouvelle-norme-iso-sur-le-traitement-en-ligne-des-avis-clients/ — accès 2026-08-25.
- Fiche produit : boutique.afnor.org, NF Z74-501 — https://www.boutique.afnor.org/en-gb/standard/nf-z74501/... — accès 2026-08-25.

**Claim 3.3 — Exigences clés (dont incitation/contrepartie).** La norme prévoit notamment : **interdiction d'acheter des avis** ; auteur identifiable et joignable par le modérateur (identité masquée à la publication) ; **vérification de la preuve de consommation** ; fraîcheur des avis ; affichage chronologique de **tous** les avis ; modération a priori et rapide ; motifs de rejet indiqués dans les CGU. **Point spécifique à l'incitation** : lorsque des avis sont collectés **en échange d'une contrepartie**, un **tirage au sort** doit être organisé parmi les participants — la contrepartie ne peut donc pas être liée au dépôt individuel d'un avis (encore moins à sa teneur).
- Source (secondaire, citant le contenu normatif) : les-infostrateges.com — https://www.les-infostrateges.com/actu/faux-avis-de-consommateurs-a-propos-de-la-norme-afnor-z74-501 — accès 2026-08-25.
- Corroboré : skeepers (help.rr.skeepers.com), « La norme AFNOR et l'encadrement des avis clients » — https://help.rr.skeepers.com/hc/fr/articles/16812047355036 — accès 2026-08-25.
- ⚠️ Pertinence pour le cas : le mécanisme « tirage au sort parmi les participants » de la norme AFNOR est proche de la logique « cadeau pour l'action, non lié à la teneur ». La norme est toutefois **volontaire** (référentiel de certification « NF Service – Avis en Ligne »), pas une obligation légale.

---

## 4. Distinction clé — inciter vs. fausser (réponse directe à la mission)

**Claim 4.1 — La loi ne sanctionne PAS l'invitation à laisser un avis en soi ; elle sanctionne les FAUX avis, les avis TROMPEURS, et le défaut de TRANSPARENCE.** Solliciter/inviter ses clients réels à déposer un avis est licite. Ce qui est interdit : publier/commander de faux avis, prétendre sans vérification que les avis émanent d'acheteurs réels, dénaturer/supprimer sélectivement des avis, et — plus largement — toute pratique de nature à tromper le consommateur sur la sincérité/représentativité des avis.
- Source (primaire indirect, DGCCRF) : economie.gouv.fr, fiche « Avis en ligne… » (les 2 pratiques interdites depuis le 28/05/2022) — accès 2026-08-25.
- Corroboré (secondaire) : blogdumoderateur.com, « Offrir une contrepartie contre un avis en ligne : c'est légal, ça ? » — https://www.blogdumoderateur.com/offrir-contrepartie-contre-avis-legal-ou-pas/ (non fetchable ce run, extraits WebSearch) — accès 2026-08-25.

**Claim 4.2 — Un avis INCITÉ avec contrepartie (cadeau/remise) reste toléré SOUS CONDITIONS STRICTES DE TRANSPARENCE ; il devient trompeur s'il est conditionné à un avis positif / à la note, ou si la contrepartie n'est pas divulguée.** Le point de bascule juridique est double : (a) **non-conditionnalité à la teneur/note** (interdit de « payer » un 5 étoiles) ; (b) **transparence** de la contrepartie (mention type « Récompensé et vérifié »). Un cadeau donné pour l'**action** et **non conditionné** à l'écriture ni à la note est le montage le moins risqué, à condition que la contrepartie soit transparente et que le dispositif ne biaise pas la représentativité des avis.
- Source (secondaire) : blogdumoderateur.com (même URL) — « offrir une contrepartie en échange d'un avis positif… peut être qualifié de trompeur car cela fausse la sincérité de l'avis » — accès 2026-08-25.
- Corroboré : guest-suite.com, « Récompense en échange d'avis clients : est-ce vraiment légal ? » — https://www.guest-suite.com/blog/recompense-echange-avis-clients — accès 2026-08-25 ; fr.custplace.com, « Avis Google incentivé : guide complet et conformité » — https://fr.custplace.com/business/avis-google-incentive/ — accès 2026-08-25 ; fr.avis-verifies.com, « Des récompenses en échange d'avis clients » (mention « Récompensé et vérifié ») — https://fr.avis-verifies.com/blog/des-recompenses-en-echange-davis-clients-une-strategie-gagnante/ — accès 2026-08-25.

**Claim 4.3 — Nuance forte propre au cas décrit (cadeau pour l'ACTION de cliquer, non pour l'avis).** Dans le montage décrit, le cadeau récompense le fait de **jouer / cliquer** (ce qui ouvre la page d'avis Google), sans obligation d'écrire ni de noter. Si aucun avis n'est exigé pour obtenir le cadeau, il devient difficile de qualifier le dispositif de « contrepartie contre avis » : l'avis éventuel provient d'un client réel et n'est pas « faux ». Le risque résiduel n'est donc pas le « faux avis » (art. L121-4 / annexe I) mais :
  (i) la **pratique trompeuse par omission** si l'incitation matérielle influence la représentativité des avis sans être divulguée ;
  (ii) le **caractère trompeur** si l'ergonomie du jeu **oriente vers un avis positif / 5 étoiles** (là, conditionnement de fait à la note).
  ➜ Recommandation de conformité : transparence sur l'existence du jeu/récompense, aucune orientation vers une note ou un contenu, cadeau non retiré si le client ne publie pas d'avis, et pas d'affirmation trompeuse sur l'origine/sincérité des avis.
- Base : synthèse des Claims 4.1–4.2 (sources ci-dessus). **Qualification propre au cas = raisonnement d'application, à faire valider par un conseil juridique ; non tirée telle quelle d'une source unique.**

**Claim 4.4 — Attention : les CGU de Google sont plus strictes que la loi.** Google interdit formellement toute récompense/cadeau en échange d'un avis, indépendamment de la licéité au regard du droit FR/UE. Un montage légalement admissible peut donc violer les règles de la plateforme (risque de suppression d'avis / suspension de fiche), ce qui est un risque distinct du risque légal.
- Source (secondaire) : agence-avis.fr / liteupseo.com / custplace.com (concordants) — https://liteupseo.com/un-cadeau-contre-un-avis-5-etoiles/ ; https://fr.custplace.com/business/avis-google-incentive/ — accès 2026-08-25. (Détail des CGU Google traité dans un digest distinct.)

---

## Lacunes / à consolider (données minces)

- **Sources primaires non fetchables ce run** (egress bloqué) : Légifrance (L111-7-2, L121-4, L132-2), EUR-Lex (2019/2161 ; 2005/29 annexe I ; guidance 2021), DGCCRF/economie.gouv.fr, AFNOR. Les claims reposent sur des restitutions secondaires concordantes ; re-vérifier le libellé exact et la numérotation des articles/points directement à la source.
- **Chiffres de contrôle DGCCRF 2024 divergents** (55 % de sites vs un tiers de 397 établissements) — périmètres à clarifier (Claim 2.5).
- **Numérotation « 23 ter / 23 quater »** de l'annexe I : usage courant en doctrine, non vérifié sur EUR-Lex ce run.
- **Absence de jurisprudence FR spécifique** aux « jeux/roues de la fortune » ouvrant la page d'avis : aucun cas récupéré ce run ; qualification du montage (Claim 4.3) reste un raisonnement d'application, non un précédent.
- Dates de publication de plusieurs analyses secondaires non confirmées (marquées « date non confirmée »).
