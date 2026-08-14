export const metadata = { title: "Politique de confidentialité — Kado" };

export default function Confidentialite() {
  return (
    <article className="legal-doc">
      <h1>Politique de confidentialité (RGPD)</h1>
      <p className="legal-note">
        ⚠️ Modèle à adapter à votre situation réelle avant mise en production.
      </p>

      <h2>Responsable du traitement</h2>
      <p>
        [À COMPLÉTER : nom de la société], éditeur du service Kado. Contact :
        [e-mail]. Délégué à la protection des données (le cas échéant) : [DPO].
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
          Aucun nom, e-mail ou téléphone n'est demandé au joueur (sauf
          fonctionnalité future explicitement proposée et consentie).
        </li>
      </ul>
      <h3>Commerçants</h3>
      <ul>
        <li>Adresse e-mail (connexion sans mot de passe).</li>
        <li>Informations de leur établissement et configuration de la roue.</li>
      </ul>

      <h2>Finalités & base légale</h2>
      <ul>
        <li>
          Fonctionnement du jeu et anti-triche : <b>intérêt légitime</b>
          (cookie technique nécessaire).
        </li>
        <li>Gestion des comptes commerçants : <b>exécution du contrat</b>.</li>
        <li>Statistiques agrégées : <b>intérêt légitime</b>.</li>
      </ul>

      <h2>Durée de conservation</h2>
      <p>
        Cookie joueur : 12 mois. Données de jeu : [durée, ex. 13 mois].
        Comptes commerçants : durée de la relation contractuelle + obligations
        légales.
      </p>

      <h2>Sous-traitants</h2>
      <p>
        Hébergement et base de données : Vercel, Supabase. Envoi d'e-mails :
        Resend. Ces prestataires agissent conformément au RGPD.
      </p>

      <h2>Vos droits</h2>
      <p>
        Vous disposez d'un droit d'accès, de rectification, d'effacement,
        d'opposition et de portabilité. Exercez-les à : [e-mail]. Vous pouvez
        saisir la CNIL (www.cnil.fr) en cas de litige.
      </p>

      <h2>Cookies</h2>
      <p>
        Kado n'utilise qu'un <b>cookie technique</b> nécessaire au jeu et un
        cookie de session pour la connexion des commerçants. Aucun cookie
        publicitaire ni de suivi tiers n'est déposé.
      </p>

      <p className="legal-date">Dernière mise à jour : [date].</p>
    </article>
  );
}
