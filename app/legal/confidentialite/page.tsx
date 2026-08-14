export const metadata = { title: "Politique de confidentialité — Kado" };

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
          Un <b>identifiant anonyme</b> stocké dans un cookie technique
          (<code>sr_pid</code>), pour empêcher de rejouer plus de 2 fois. Il ne
          contient aucune donnée personnelle.
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
        <li>Statistiques agrégées : <b>intérêt légitime</b>.</li>
      </ul>

      <h2>Durée de conservation</h2>
      <p>
        Cookie joueur : 12 mois. Données de jeu : 13 mois. E-mails collectés :
        jusqu'au retrait du consentement ou 3 ans sans interaction. Comptes
        commerçants : durée de la relation contractuelle + obligations légales.
      </p>

      <h2>Sous-traitants</h2>
      <p>
        Hébergement et base de données : Vercel, Supabase (Europe). Envoi
        d'e-mails : Resend. Paiement : Stripe. Ces prestataires agissent
        conformément au RGPD.
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

      <p className="legal-date">Dernière mise à jour : 15 août 2026.</p>
    </article>
  );
}
