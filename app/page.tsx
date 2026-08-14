export const dynamic = "force-dynamic";

const STEPS = [
  {
    n: "1",
    t: "Vos clients scannent",
    d: "Un QR code sur la table, le ticket ou un sticker. Aucune app à installer.",
  },
  {
    n: "2",
    t: "Ils suivent & laissent un avis",
    d: "Un tour de roue pour un suivi Instagram, un tour pour un avis Google.",
  },
  {
    n: "3",
    t: "Ils gagnent, vous fidélisez",
    d: "Un cadeau à récupérer en boutique. Plus d'avis, plus d'abonnés, plus de visites.",
  },
];

const BENEFITS = [
  { e: "⭐", t: "Plus d'avis Google", d: "Transformez chaque client satisfait en avis." },
  { e: "📸", t: "Plus d'abonnés Insta", d: "Faites grandir votre communauté à chaque visite." },
  { e: "🔁", t: "Plus de visites", d: "Le cadeau donne une bonne raison de revenir." },
  { e: "🎨", t: "À vos couleurs", d: "Logo, photo de fond et lots personnalisables." },
  { e: "🛡️", t: "Anti-triche", d: "Tirage sécurisé côté serveur, 2 tours max par personne." },
  { e: "💸", t: "Coûts maîtrisés", d: "Plafond de cadeaux par jour, validation en caisse." },
];

export default function Home() {
  return (
    <main className="vitrine">
      <section className="v-hero">
        <div className="v-badge">🎡 Kado</div>
        <h1>
          Transformez vos clients en <span>avis & abonnés</span>
        </h1>
        <p className="v-lede">
          Le jeu de roue de la fortune qui booste votre réputation Google et
          votre Instagram — sans effort, à chaque visite.
        </p>
        <div className="v-cta">
          <a className="v-btn primary" href="/cafe-lumiere">
            🎡 Voir la démo
          </a>
          <a className="v-btn ghost" href="/tarifs">
            Voir les tarifs
          </a>
        </div>
      </section>

      <section className="v-section">
        <h2>Comment ça marche</h2>
        <div className="v-steps">
          {STEPS.map((s) => (
            <div className="v-step" key={s.n}>
              <div className="v-step-n">{s.n}</div>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="v-section">
        <h2>Pourquoi Kado</h2>
        <div className="v-benefits">
          {BENEFITS.map((b) => (
            <div className="v-benefit" key={b.t}>
              <div className="v-benefit-e">{b.e}</div>
              <div>
                <h3>{b.t}</h3>
                <p>{b.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="v-final">
        <h2>Prêt à faire tourner la roue ?</h2>
        <p>Testez la démo, puis lancez votre première roue en quelques minutes.</p>
        <div className="v-cta">
          <a className="v-btn primary" href="/cafe-lumiere">
            🎡 Essayer la démo
          </a>
        </div>
      </section>

      <footer className="v-footer">
        <span>© Kado</span>
        <a href="/tarifs">Tarifs</a>
        <a href="/legal/mentions">Mentions légales</a>
        <a href="/legal/confidentialite">Confidentialité</a>
        <a href="/legal/cgu">CGU</a>
        <a href="/login">Espace commerçant</a>
      </footer>
    </main>
  );
}
