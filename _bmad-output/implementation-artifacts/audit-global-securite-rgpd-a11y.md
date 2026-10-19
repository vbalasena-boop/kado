# Audit global Kado — sécurité, RGPD, accessibilité et fiabilité

**Date :** 19 octobre 2026
**Périmètre :** code local du dépôt, API Next.js, migrations Supabase, politique de confidentialité, contrôles automatisés et avis Supabase de production. Les modifications locales ne sont pas réputées déployées sans preuve de déploiement.
**Méthode :** revue BMAD NFR (sécurité, fiabilité, performance) et revue des cas limites, recherches réglementaires sur les sites officiels CNIL et EUR-Lex.

## Résumé

La suite automatisée, le lint, TypeScript et le build de production passent sur Next.js 16.4.2 avec Webpack. Les corrections locales couvrent le plafond de cadeaux et l'enregistrement d'une partie dans une transaction, la file d'e-mails et sa réservation concurrente, le contrôle du consentement avant envoi, la suppression de compte après annulation Stripe, les secrets de désinscription, la purge planifiée des données, les totaux historiques de commandes et le décodage/réencodage des images téléversées. La collecte d'e-mail exige un consentement explicite dans le formulaire et l'API.

**Kado n'est pas certifié conforme au RGPD ni à l'accessibilité par cet audit.** Les migrations `0088_audit_retention_and_atomic_claims`, `security_and_index_hardening` et `fix_mutable_function_search_paths` ont été appliquées sur la base Supabase de production et leurs objets ont été vérifiés. Restent à confirmer les rôles de Kado et des commerçants, les sauvegardes, l'applicabilité des obligations d'accessibilité et les parcours authentifiés. Le scan axe couvert dans cette passe est limité aux pages publiques d'accueil et de jeu.

## Défauts corrigés

| ID | Gravité | Constat | Correction |
|---|---|---|---|
| F-01 | Haute | `/api/play` utilisait un comptage concurrent de secours si la réservation atomique échouait ; si le plafond était atteint sans lot perdant, un nouveau lot gagnant restait attribuable. | Échec fermé si la RPC est indisponible ; si le plafond est atteint sans lot perdant, le tour est refusé. Tests de non-régression ajoutés. |
| F-02 | Haute | La suppression d'un compte commerçant ignorait les erreurs d'annulation Stripe puis supprimait les boutiques, ce qui pouvait laisser une facturation active et un compte inaccessible. L'erreur de suppression Auth était également ignorée. | Annulation Stripe requise avant suppression ; une erreur arrête le processus. L'API vérifie aussi le résultat de suppression Auth et n'envoie le courriel de confirmation qu'après réussite. |
| F-03 | Moyenne | Le drain d'e-mails traitait une erreur de lecture comme une file vide et ignorait les erreurs de mise à jour ; les crons pouvaient signaler un succès fictif. | Les erreurs de base remontent désormais au cron ; l'endpoint quotidien répond en erreur si des étapes ont échoué. |
| F-04 | Moyenne | L'état de santé considérait un heartbeat quotidien absent ou une table inaccessible comme sain. | Ces états sont désormais signalés comme dégradés. |
| F-05 | Haute | En production, le lien de désinscription de prospection pouvait être signé avec une clé de repli publique si les secrets n'étaient pas configurés. | La route échoue explicitement en production sans secret configuré ; le repli connu reste réservé au développement. |
| F-06 | Haute | Une panne d'insertion en file faisait envoyer directement des offres sans revérifier le consentement. | Le repli direct est retiré ; le drain vérifie le consentement juste avant l'envoi et ignore les messages désinscrits. |
| F-07 | Moyenne | L'API de collecte acceptait des adresses sans marqueur affirmatif, ne gardait pas de date/source de consentement et conservait la casse d'origine. | L'API exige `consent: true`, enregistre date et source, normalise les adresses et le drain ignore les anciens leads sans preuve enregistrée. |
| F-08 | Haute | Les durées publiées n'étaient pas appliquées aux données de jeu/commandes et leur suppression aurait fait perdre les statistiques historiques. | Migration 0088 : purge quotidienne bornée, archivage financier minimal à accès restreint, résumés mensuels sans détail client, et agrégats historiques. À appliquer en base avant déploiement. |

## Écarts et risques restant à traiter

| ID | Gravité | Constat vérifié | Action recommandée |
|---|---|---|---|
| R-01 | Résolu en base | La migration `20261019141139_0088_audit_retention_and_atomic_claims` est enregistrée sur le projet Supabase de production. Les migrations de durcissement `20261019172508` et `20261019172638` y sont aussi enregistrées ; fonctions et droits vérifiés par requête SQL. La CLI locale Supabase n'est pas installée. | Après publication du code, surveiller la purge quotidienne et vérifier les volumes, erreurs et rétention sur la base réelle. |
| R-04 | Haute | Les commandes brutes sont supprimées après 13 mois ; une trace par commande (date, statut, montant) sans coordonnées est conservée 10 ans. Le Code de commerce prévoit dix ans pour les documents comptables et pièces justificatives, mais la trace minimale de Kado ne remplace pas nécessairement ces pièces. | Faire valider par le conseil comptable/juridique la répartition des rôles, les pièces requises et le contenu exact de l'archive avant d'appliquer la rétention. La CNIL décrit la séparation en archive à accès restreint. |
| R-02 | Haute | La politique distingue maintenant Kado et le commerçant selon les finalités, mais le rôle exact peut varier par fonctionnalité ; les contrats de sous-traitance et la procédure opérationnelle de transmission des demandes ne sont pas dans le dépôt. | Faire valider la répartition juridique, signer les clauses requises et documenter le traitement des demandes de droits. |
| S-01 | Résolu localement | Les routes d'upload logo/fond valident la signature, décodent les formats autorisés, limitent pixels/dimensions, réorientent et réencodent sans métadonnées avant publication. SVG reste refusé. | Ajout de Sharp, normalisation côté serveur et tests de rejet d'image malformée/trop lourde. |
| S-02 | Moyenne | La réservation atomique et le bail empêchent deux crons de réclamer le même e-mail. Un crash après acceptation par le fournisseur mais avant finalisation peut encore provoquer un doublon après expiration du bail. | Vérifier si Resend permet une clé d'idempotence ; le comportement reste « au moins une fois » en attendant. |
| S-03 | Corrigé en base | Les 13 fonctions `SECURITY INVOKER` signalées utilisaient un `search_path` mutable. Elles ont toutes maintenant `search_path=public, pg_temp` ; la migration `20261019172638` est enregistrée et les 13 configurations ont été relues. L'alerte correspondante a disparu du Security Advisor. | Aucun suivi supplémentaire requis pour cette alerte. |
| S-04 | À arbitrer | Supabase signale la protection contre les mots de passe compromis désactivée. Le projet est sur l'offre gratuite ; cette fonction est réservée aux offres admissibles supérieures. | Activer lors d'un changement d'offre si son coût est accepté ; aucune mise à niveau payante n'a été faite. |
| S-05 | Information | 23 tables ont RLS activé sans politique dédiée. Elles sont des tables internes, accessibles au serveur avec le rôle de service ; sans politique, l'accès client est refusé par défaut. | Conserver le défaut refusé et vérifier les privilèges si un usage client direct est ajouté. |
| R-03 | Résolu sous réserve de migration | Réservation du compteur cadeau et insertion de la partie dans la même transaction SQL. | Appliquer et vérifier la migration 0088. |
| P-01 | Partiellement corrigé | Totaux des commandes, meilleures ventes et métriques de jeu déplacés vers SQL et archives. Les temps de préparation et modes de service lisent encore jusqu'à 2 000 commandes récentes ; pas de test de charge. | Mesurer la latence sous volume réaliste et décider si ces deux métriques doivent aussi être agrégées en SQL. |
| A-01 | Partiellement vérifié | Accueil et jeu de production consultés : aucun contrôle axe n'a été exécuté dans cette passe. Sur l'accueil local, vérifications DOM : 1 repère principal, aucun contrôle interactif sans nom, aucune image sans texte alternatif ; deux ID SVG dupliqués ont été corrigés. Un lien de saut au contenu principal a été ajouté à tous les points d'entrée `<main>`. Le dashboard et le lecteur d'écran ne sont pas couverts. | Scanner les pages publiques et authentifiées avec axe, puis valider au clavier et avec un lecteur d'écran. |
| A-02 | À qualifier | L'applicabilité des obligations françaises/UE d'accessibilité dépend du service concerné et notamment de la taille de l'entreprise ; les informations de taille et de modèle d'exploitation ne sont pas dans le dépôt. | Faire qualifier l'applicabilité EAA/loi française et publier une déclaration d'accessibilité et un canal de signalement si requis. |
| O-01 | À vérifier | Aucun exercice de restauration réelle ni contrôle documenté de la région et de la rétention des sauvegardes n'a été exécuté. | Planifier un test de restauration documenté et vérifier les paramètres de sauvegarde/région chez Supabase et Vercel. |
| P-02 | Information | L'Advisor signale 23 index sans utilisation observée. Les tables sont peu volumineuses ; certains index viennent d'être ajoutés pour couvrir des clés étrangères et n'ont pas encore eu de trafic. | Ne pas supprimer sur cette seule métrique ; réévaluer avec un historique d'utilisation représentatif. |
| O-02 | Résolu en production / à suivre en développement | Les dépendances directes vulnérables ont été mises à jour (Next 16.4.2, Sentry 11.8.0, Nodemailer 10.1.7). `npm audit --omit=dev` ne signale aucune vulnérabilité. L'audit complet conserve cinq avis élevés dans la chaîne de lint `eslint-config-next → fast-glob → micromatch → braces`; la version publique la plus récente de `braces` (3.0.3) est encore dans la plage vulnérable et il n'existe pas de version corrigée vers laquelle mettre à jour sans remplacer la chaîne. | Suivre la publication d'une version corrigée en amont ; conserver ces outils en dépendances de développement seulement. |
| M-01 | À vérifier en préproduction | Next.js 16 utilise React 19 et le point d'entrée `proxy.ts` Node.js ; l'ancien middleware Edge n'est plus utilisé. Le build compile avec ces versions, mais l'authentification Supabase et la réécriture des domaines commerçants doivent être vérifiées dans l'environnement de préproduction. | Effectuer les parcours de connexion, rafraîchissement de session et commandes sur domaine personnalisé en préproduction. |

## Résultats des contrôles

- `npm test` : **73 fichiers, 707 tests réussis** après la migration Next 16.
- `npm run lint` : réussi ; 206 avertissements hérités (liens `<a>` internes et nouvelles règles React Hooks), aucune erreur ESLint.
- `npx tsc --noEmit` : réussi après migration des API asynchrones Next 16.
- `npm run build` (`next build --webpack`) : réussi après migration vers React 19 et `proxy.ts`.
- `bash scripts/relais/verifier.sh` : réussi après les corrections de code ; tests, lint et TypeScript passent.
- `npm run build` : réussi ; 35 routes statiques générées.
- Supabase Security Advisor après durcissement : aucune alerte de `search_path` mutable ni d'exécution publique de fonction privilégiée ; une alerte Auth reste liée au plan et 23 notices RLS sans politique (accès refusé par défaut).
- Supabase Performance Advisor : aucune clé étrangère sans index ni doublon d'index signalé ; 23 index sans usage observé, à réévaluer après trafic représentatif.
- Scan axe via navigateur distant : pages d'accueil et de jeu vérifiées ; voir A-01. Les corrections locales ne sont pas déployées.
- `npm audit --omit=dev --audit-level=high` : **0 vulnérabilité** dans les dépendances de production.
- `npm audit` complet : **5 avis élevés** confinés à la chaîne de lint de développement via `braces <=3.0.3`; aucune version corrigée n'est publiée au registre consulté.

## Références réglementaires officielles

- CNIL, prospection électronique : https://www.cnil.fr/fr/la-prospection-commerciale-par-courrier-electronique-sms-mms-et-automate-dappel
- CNIL, réutilisation de données publiques à des fins commerciales : https://cnil-d10.cnil.fr/fr/reutilisation-de-vos-donnees-publiees-sur-internet-des-fins-commerciales
- CNIL, recommandation cookies consolidée (janvier 2026) : https://www.cnil.fr/sites/default/files/2026-01/recommandation_cookies_consolidee.pdf
- Directive européenne sur l'accessibilité : https://eur-lex.europa.eu/eli/dir/2019/882/oj?locale=fr
- EUR-Lex, résumé des règles d'accessibilité des produits et services : https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=LEGISSUM%3A4403933
- CNIL, durées de conservation et archivage intermédiaire : https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees
- Code de commerce, article L. 123-22 (conservation des pièces comptables) : https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000006219327/2026-01-26

## Conclusion

Le code local compile et les migrations de base ont été appliquées et vérifiées sur le projet Supabase de production. Les validations juridiques des rôles et durées, un test de restauration, l'accessibilité des écrans authentifiés et la vérification fonctionnelle en préproduction restent nécessaires. Le dépôt comporte encore des changements locaux non publiés : ce rapport ne prétend pas qu'ils sont déjà déployés sur le site.
