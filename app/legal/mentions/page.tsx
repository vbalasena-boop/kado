export const metadata = { title: "Mentions légales — Kado" };

export default function Mentions() {
  return (
    <article className="legal-doc">
      <h1>Mentions légales</h1>
      <p className="legal-note">
        ⚠️ Modèle à compléter avec vos informations réelles avant mise en
        production. Faites relire par un professionnel si besoin.
      </p>

      <h2>Éditeur du service</h2>
      <p>
        Le service <b>Kado</b> est édité par <b>[À COMPLÉTER : nom / raison
        sociale]</b>, <b>[forme juridique]</b> au capital de <b>[montant]</b>,
        immatriculée au RCS de <b>[ville]</b> sous le numéro <b>[SIREN/SIRET]</b>.
      </p>
      <ul>
        <li>Siège social : [adresse complète]</li>
        <li>E-mail : [e-mail de contact]</li>
        <li>Téléphone : [téléphone]</li>
        <li>Directeur de la publication : [nom]</li>
        <li>TVA intracommunautaire : [numéro]</li>
      </ul>

      <h2>Hébergement</h2>
      <p>
        Le site est hébergé par <b>Vercel Inc.</b> (340 S Lemon Ave #4133,
        Walnut, CA 91789, USA) et la base de données par <b>Supabase</b>. Les
        données sont stockées dans l'Union européenne (région choisie :
        Europe).
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        L'ensemble des contenus du service (hors contenus fournis par les
        commerçants clients) est protégé. Les marques et logos tiers
        (Google, Instagram…) appartiennent à leurs propriétaires respectifs.
      </p>

      <h2>Contact</h2>
      <p>Pour toute question : [e-mail de contact].</p>

      <p className="legal-date">Dernière mise à jour : [date].</p>
    </article>
  );
}
