export const metadata = {
  title: "Politique de confidentialité",
  description:
    "Politique de confidentialité de Kado : quelles données sont collectées, pourquoi, et vos droits (RGPD).",
  alternates: { canonical: "/legal/confidentialite" },
};

export default function Confidentialite() {
  return (
    <article className="legal-doc">
      <h1>Politique de confidentialité (RGPD)</h1>

      <h2>Responsable du traitement</h2>
      <p>
        Vobinson BALASENA (entrepreneur individuel), éditeur du service Kado.
        Contact : vbalasena@instant-events.fr.
      </p>

      <h2>Données collectées</h2>
      <h3>Joueurs (clients des commerces)</h3>
      <ul>
        <li>
          L'adresse IP de la requête est utilisée pour limiter les abus et les
          tentatives automatisées. Les compteurs contenant cette adresse sont
          purgés chaque jour après expiration de leur fenêtre de limitation
          (48 heures d'inactivité).
        </li>
        <li>
          Un identifiant <b>pseudonyme</b> stocké dans un cookie technique
          (<code>sr_pid</code>), utilisé pour éviter les rejouements. Il ne
          contient pas directement votre nom ou vos coordonnées, mais les
          parties enregistrées en base peuvent être reliées à vos tours.
        </li>
        <li>
          Seulement après votre accord explicite dans le jeu, le navigateur
          peut calculer une empreinte technique dérivée de caractéristiques de
          l'appareil et du navigateur (agent utilisateur, langue, plateforme,
          écran, fuseau horaire et rendu graphique). Seule son empreinte SHA-256 est transmise et associée aux
          tours pour limiter les rejouements, y compris après suppression du
          cookie. Le jeu reste accessible en cas de refus. Vous pouvez retirer
          votre accord depuis la page du jeu; l'empreinte des tours associés à
          cet identifiant de jeu est alors effacée. Cette empreinte n'est pas utilisée
          à des fins publicitaires.
        </li>
        <li>
          Le <b>lot gagné</b> et un <b>code cadeau</b>, associés à cet
          identifiant anonyme, pour le fonctionnement du jeu.
        </li>
        <li>
          Le cas échéant, si le commerçant l'a activé et si le joueur y consent
          explicitement : son <b>e-mail</b>, pour recevoir les offres du
          commerce.
        </li>
        <li>
          <b>Carte de fidélité</b> (si utilisée) : e-mail, et, de façon
          facultative et avec consentement, jour et mois d'anniversaire (pour
          une attention du commerce) et accord de recevoir les offres.
        </li>
        <li>
          <b>Commande en ligne</b> (si utilisée) : nom, téléphone et,
          facultativement, e-mail — uniquement pour permettre au commerce de
          préparer la commande et de contacter le client à son sujet.
        </li>
        <li>
          <b>Notifications</b> (si activées par le client) : un identifiant
          technique d'abonnement fourni par le navigateur, après autorisation
          explicite. Désactivables à tout moment dans les réglages du
          navigateur.
        </li>
      </ul>
      <h3>Commerçants</h3>
      <ul>
        <li>Adresse e-mail (connexion sans mot de passe).</li>
        <li>Informations de leur établissement et configuration de la roue.</li>
        <li>
          Données de facturation gérées par notre prestataire de paiement
          (Stripe) — aucune donnée bancaire n'est stockée par Kado.
        </li>
      </ul>

      <h2>Finalités & base légale</h2>
      <ul>
        <li>
          Fonctionnement du jeu et anti-triche : <b>intérêt légitime</b>
          (cookie technique nécessaire).
        </li>
        <li>Gestion des comptes et abonnements : <b>exécution du contrat</b>.</li>
        <li>Collecte d'e-mail des joueurs : <b>consentement</b>.</li>
        <li>
          Commande en ligne : <b>exécution de la commande</b> demandée par le
          client.
        </li>
        <li>
          Offres par e-mail et notifications : <b>consentement</b>, retirable à
          tout moment (lien de désinscription dans chaque e-mail, réglages du
          navigateur pour les notifications).
        </li>
        <li>Statistiques agrégées : <b>intérêt légitime</b>.</li>
      </ul>

      <h2>Durée de conservation</h2>
      <p>
        Cookie joueur : 12 mois. Données de jeu et commandes : 13 mois. E-mails
        collectés et cartes de fidélité : jusqu'au retrait du consentement ou 3
        ans sans interaction. Abonnements aux notifications : jusqu'à
        désactivation. Comptes commerçants : durée de la relation contractuelle
        + obligations légales.
      </p>

      <h2>Sous-traitants</h2>
      <p>
        Hébergement et base de données : Vercel, Supabase (Europe). Envoi
        d'e-mails : Resend. Paiement : Stripe. Remise des notifications :
        services de notification des navigateurs (Apple, Google, Mozilla). Ces
        prestataires agissent conformément au RGPD.
      </p>

      <h2>Vos droits</h2>
      <p>
        Vous disposez d'un droit d'accès, de rectification, d'effacement,
        d'opposition et de portabilité. Exercez-les à :
        vbalasena@instant-events.fr. Vous pouvez saisir la CNIL (www.cnil.fr) en
        cas de litige.
      </p>

      <h2>Cookies</h2>
      <p>
        Kado n'utilise qu'un <b>cookie technique</b> nécessaire au jeu et un
        cookie de session pour la connexion des commerçants. Aucun cookie
        publicitaire ni de suivi tiers n'est déposé.
      </p>

      <p className="legal-date">Dernière mise à jour : 18 octobre 2026.</p>
    </article>
  );
}
