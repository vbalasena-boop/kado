export const metadata = { title: "Mentions légales — Kado" };

export default function Mentions() {
  return (
    <article className="legal-doc">
      <h1>Mentions légales</h1>

      <h2>Éditeur du service</h2>
      <p>
        Le service <b>Kado</b> est édité par <b>Vobinson BALASENA</b>,
        entrepreneur individuel (EI).
      </p>
      <ul>
        <li>Immatriculé au RCS de Créteil sous le numéro <b>810&nbsp;067&nbsp;348</b></li>
        <li>Siège / adresse : 5 rue Émile Cousin, 78000 Versailles, France</li>
        <li>E-mail : vbalasena@instant-events.fr</li>
        <li>Directeur de la publication : Vobinson BALASENA</li>
        <li>TVA : TVA non applicable, article 293 B du CGI (franchise en base de TVA)</li>
      </ul>

      <h2>Hébergement</h2>
      <p>
        Le site est hébergé par <b>Vercel Inc.</b> (340 S Lemon Ave #4133,
        Walnut, CA 91789, USA) et la base de données par <b>Supabase</b>
        (région Europe). L'envoi des e-mails est assuré par <b>Resend</b>.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        L'ensemble des contenus du service (hors contenus fournis par les
        commerçants clients) est protégé. Les marques et logos tiers (Google,
        Instagram…) appartiennent à leurs propriétaires respectifs.
      </p>

      <h2>Contact</h2>
      <p>Pour toute question : vbalasena@instant-events.fr.</p>

      <p className="legal-date">Dernière mise à jour : 15 août 2026.</p>
    </article>
  );
}
