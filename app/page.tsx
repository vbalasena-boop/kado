export const dynamic = "force-dynamic";

/** Page d'accueil minimale (vitrine). Le cœur du produit est la page /{slug}. */
export default function Home() {
  return (
    <main className="landing">
      <div className="landing-card">
        <div className="landing-logo">🎡</div>
        <h1>
          Scannez, jouez,<br />
          <span>régalez-vous&nbsp;!</span>
        </h1>
        <p>
          Kado transforme la demande d'avis en jeu&nbsp;: vos clients scannent,
          jouent 2&nbsp;tours (un pour un suivi Instagram, un pour un avis Google) et
          gagnent un cadeau. Plus d'avis, plus d'abonnés, plus de visites.
        </p>
        <div className="landing-actions">
          <a className="landing-btn" href="/cafe-lumiere">
            Voir la démo →
          </a>
        </div>
        <p className="landing-fine">
          Commerçant ? <a href="/login">Accéder à mon espace</a>
          <br />
          Démo de test : <code>/cafe-lumiere</code> (nécessite la base configurée).
        </p>
        <p className="landing-fine" style={{ marginTop: 10 }}>
          <a href="/legal/mentions">Mentions légales</a> ·{" "}
          <a href="/legal/confidentialite">Confidentialité</a> ·{" "}
          <a href="/legal/cgu">CGU</a>
        </p>
      </div>
    </main>
  );
}
