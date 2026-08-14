export const metadata = { title: "CGU — Kado" };

export default function CGU() {
  return (
    <article className="legal-doc">
      <h1>Conditions générales d'utilisation</h1>
      <p className="legal-note">
        ⚠️ Modèle à adapter (notamment tarifs et modalités d'abonnement) avant
        mise en production.
      </p>

      <h2>1. Objet</h2>
      <p>
        Kado est un service en ligne permettant à un commerce de proposer un
        jeu de roue de la fortune à ses clients, en échange d'un suivi sur les
        réseaux sociaux ou d'un avis en ligne, afin de gagner un cadeau.
      </p>

      <h2>2. Compte commerçant</h2>
      <p>
        L'accès à l'espace commerçant se fait par e-mail (code de connexion).
        Le commerçant est responsable de la configuration de sa roue, de ses
        lots et du respect des règles des plateformes tierces.
      </p>

      <h2>3. Abonnement</h2>
      <p>
        L'accès au service est fourni sous forme d'abonnement (essai gratuit
        puis formule payante — voir [page tarifs]). En cas de non-paiement ou
        de fin d'abonnement, l'accès au jeu et à l'espace peut être suspendu.
      </p>

      <h2>4. Obligations du commerçant</h2>
      <ul>
        <li>Honorer les cadeaux gagnés par ses clients.</li>
        <li>
          Ne pas conditionner un cadeau à une note positive (interdit par
          Google). Le cadeau récompense la participation au jeu.
        </li>
        <li>Respecter la réglementation applicable aux jeux et concours.</li>
      </ul>

      <h2>5. Responsabilité</h2>
      <p>
        L'éditeur fournit l'outil technique. Il ne saurait être tenu
        responsable des lots offerts, des litiges avec les clients finaux, ni
        des décisions des plateformes tierces (Google, Instagram…).
      </p>

      <h2>6. Résiliation</h2>
      <p>
        Le commerçant peut cesser d'utiliser le service à tout moment. L'éditeur
        peut suspendre un compte en cas de manquement aux présentes CGU.
      </p>

      <p className="legal-date">Dernière mise à jour : [date].</p>
    </article>
  );
}
