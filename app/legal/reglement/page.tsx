export const metadata = {
  title: "Règlement du jeu",
  description:
    "Règlement du jeu (roue de la fortune, grattage, machine à sous) proposé par les commerces via Kado.",
  alternates: { canonical: "/legal/reglement" },
};

export default function Reglement() {
  return (
    <article className="legal-doc">
      <h1>Règlement du jeu</h1>
      <p className="legal-note">
        Règlement type applicable aux jeux proposés via Kado. Chaque
        établissement organisateur reste responsable de ses lots et de leur
        remise.
      </p>

      <h2>Article 1 — Organisateur</h2>
      <p>
        Le jeu est organisé par l'établissement commerçant qui l'affiche, via
        l'outil Kado (édité par Vobinson BALASENA, entrepreneur individuel). Il
        est gratuit et sans obligation d'achat.
      </p>

      <h2>Article 2 — Participation</h2>
      <p>
        Le jeu est ouvert à toute personne physique majeure. Chaque participant
        peut jouer au maximum <b>2 tours</b> : un débloqué par un suivi
        Instagram, un par le dépôt d'un avis. Le cadeau <b>n'est en aucun cas
        conditionné à la note</b> ou au contenu de l'avis laissé.
      </p>

      <h2>Article 3 — Dotations</h2>
      <p>
        Les lots proposés sont définis par l'établissement (ex. boisson offerte,
        réduction, etc.). Les lots ne peuvent être échangés contre leur valeur
        en argent. Un nombre de lots par jour peut être limité.
      </p>

      <h2>Article 4 — Remise des lots</h2>
      <p>
        Le gagnant présente son <b>code cadeau</b> à l'établissement. Chaque code
        est valable une seule fois et pour une durée limitée, indiquée au moment du gain (30 jours par défaut, selon le commerce).
      </p>

      <h2>Article 4 bis — Tirage au sort (le cas échéant)</h2>
      <p>
        Certains établissements peuvent proposer un <b>tirage au sort</b> gratuit
        et sans obligation d'achat, à une fréquence qu'ils définissent
        (hebdomadaire, mensuelle, etc.). Le cas échéant&nbsp;: un gagnant est
        désigné de façon aléatoire, à la date prévue, parmi les participants
        ayant communiqué leur adresse e-mail au cours de la période. Le gagnant
        est informé par e-mail et récupère son lot sur présentation du code
        reçu. La participation reste entièrement gratuite.
      </p>

      <h2>Article 5 — Données personnelles</h2>
      <p>
        Le jeu ne collecte aucune donnée personnelle du joueur (voir la{" "}
        <a href="/legal/confidentialite">politique de confidentialité</a>).
      </p>

      <h2>Article 6 — Conformité</h2>
      <p>
        Ce jeu respecte les règles des plateformes concernées. Il ne s'agit pas
        d'un achat d'avis : la récompense est liée à la participation au jeu,
        pas à la teneur de l'avis.
      </p>

      <p className="legal-date">Dernière mise à jour : 15 août 2026.</p>
    </article>
  );
}
