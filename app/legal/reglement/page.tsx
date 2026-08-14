export const metadata = { title: "Règlement du jeu — Kado" };

export default function Reglement() {
  return (
    <article className="legal-doc">
      <h1>Règlement du jeu</h1>
      <p className="legal-note">
        ⚠️ Modèle type. Chaque commerçant doit l'adapter à son établissement et
        à ses lots.
      </p>

      <h2>Article 1 — Organisateur</h2>
      <p>
        Le jeu est organisé par l'établissement <b>[nom du commerce]</b> via
        l'outil Kado. Il est gratuit et sans obligation d'achat.
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
        est valable une seule fois et pour une durée limitée (ex. 30 jours).
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

      <p className="legal-date">Dernière mise à jour : [date].</p>
    </article>
  );
}
