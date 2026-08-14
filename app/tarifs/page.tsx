export const dynamic = "force-dynamic";

const FEATURES = [
  "Roue de la fortune illimitée",
  "Avis Google + abonnés Instagram",
  "Personnalisation (logo, couleurs, fond)",
  "Validation des cadeaux en caisse (scan)",
  "Capture d'e-mails clients (base marketing)",
  "Statistiques et export CSV",
];

export default function Tarifs() {
  return (
    <main className="vitrine">
      <section className="v-hero" style={{ paddingBottom: 10 }}>
        <div className="v-badge">🎡 Kado</div>
        <h1>Un tarif simple</h1>
        <p className="v-lede">
          Tout Kado, sans engagement. Essai gratuit, puis abonnement mensuel.
        </p>
      </section>

      <section className="v-section" style={{ display: "flex", justifyContent: "center" }}>
        <div className="v-plan">
          <div className="v-plan-name">Kado Pro</div>
          <div className="v-plan-price">
            29&nbsp;€<span>/mois</span>
          </div>
          <div className="v-plan-sub">14 jours d'essai gratuit</div>
          <ul className="v-plan-feats">
            {FEATURES.map((f) => (
              <li key={f}>✓ {f}</li>
            ))}
          </ul>
          <a className="v-btn primary" href="/login" style={{ display: "block" }}>
            Commencer l'essai gratuit
          </a>
          <p className="v-plan-note">
            L'abonnement se gère depuis votre espace commerçant.
          </p>
        </div>
      </section>

      <footer className="v-footer">
        <a href="/">Accueil</a>
        <a href="/legal/cgu">CGU</a>
        <a href="/legal/confidentialite">Confidentialité</a>
        <a href="/login">Espace commerçant</a>
      </footer>
    </main>
  );
}
