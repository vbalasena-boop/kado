import { Logo } from "@/components/Logo";
import HomeWheel from "@/components/HomeWheel";
import HomeLoyalty from "@/components/HomeLoyalty";

export const dynamic = "force-dynamic";

/* --- Logos de marque (SVG, rendu côté serveur) --- */
function InstagramGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5.4" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="17.3" cy="6.7" r="1.3" fill="#fff" />
    </svg>
  );
}
function GoogleGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  );
}

/* --- Icônes atouts (stroke, couleur héritée) --- */
function Ico({ name }: { name: string }) {
  const c = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "star":
      return <svg {...c}><path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6L12 17l-5.4 2.6 1-6L3.3 9.4l6-.9L12 3z" /></svg>;
    case "insta":
      return <svg {...c}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" /></svg>;
    case "repeat":
      return <svg {...c}><path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" /></svg>;
    case "palette":
      return <svg {...c}><path d="M12 3a9 9 0 100 18 2.4 2.4 0 002.4-2.4c0-.66-.28-1.2-.66-1.6-.36-.38-.6-.9-.6-1.45A2.3 2.3 0 0115.5 13H17a4 4 0 004-4c0-3.9-4-6-9-6z" /><circle cx="7.5" cy="11" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="10" r="1" fill="currentColor" stroke="none" /></svg>;
    case "shield":
      return <svg {...c}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg>;
    case "coins":
      return <svg {...c}><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7" /><path d="M15 12c2.5-.2 6-1.2 6-3" /><path d="M9 15v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" /></svg>;
    case "check":
      return <svg {...c} width={18} height={18}><path d="M4 12l5 5L20 6" /></svg>;
    default:
      return null;
  }
}

const STEPS = [
  { n: "1", t: "Vos clients scannent", d: "Un QR code sur la table, le ticket ou un sticker. Aucune application à installer." },
  { n: "2", t: "Ils suivent & laissent un avis", d: "Un tour de roue pour un suivi Instagram, un tour pour un avis Google." },
  { n: "3", t: "Ils gagnent, vous fidélisez", d: "Un cadeau à récupérer en boutique. Plus d'avis, plus d'abonnés, plus de visites." },
];

const AUDIENCE = [
  "Restaurants", "Bars & cafés", "Salons de coiffure", "Instituts de beauté",
  "Boutiques", "Food-trucks", "Boulangeries", "Salles de sport", "Fleuristes", "Garages",
];

const BENEFITS = [
  { i: "star", t: "Plus d'avis Google", d: "Transformez chaque client satisfait en avis 5 étoiles." },
  { i: "insta", t: "Plus d'abonnés Insta", d: "Faites grandir votre communauté à chaque visite." },
  { i: "repeat", t: "Plus de visites", d: "Le cadeau donne une bonne raison de revenir vous voir." },
  { i: "palette", t: "À vos couleurs", d: "Logo, photo de fond et lots entièrement personnalisables." },
  { i: "shield", t: "Anti-triche", d: "Tirage sécurisé côté serveur, 2 tours maximum par personne." },
  { i: "coins", t: "Coûts maîtrisés", d: "Plafond de cadeaux par jour et validation du code en caisse." },
];

const PLANS = [
  {
    id: "roue",
    name: "Roue",
    price: "29",
    desc: "Boostez vos avis & abonnés",
    features: [
      "Roue de la fortune illimitée",
      "Avis Google + Instagram",
      "Personnalisation complète",
      "QR code, stats, validation",
    ],
  },
  {
    id: "complet",
    name: "Complet",
    price: "44",
    desc: "Roue + fidélité, le meilleur tarif",
    popular: true,
    features: [
      "Tout ce qui est dans Roue",
      "+ Carte de fidélité digitale",
      "Toutes les fonctionnalités",
      "4 € d'économie / mois",
    ],
  },
  {
    id: "fidelite",
    name: "Fidélité",
    price: "19",
    desc: "Fidélisez vos habitués",
    features: [
      "Carte à tampons digitale",
      "Récompense personnalisable",
      "QR code client + validation",
      "Stats d'inscription",
    ],
  },
];

const FAQ = [
  {
    q: "C'est légal d'offrir un cadeau contre un avis ?",
    a: "Le cadeau récompense la participation au jeu, jamais le contenu ou la note de l'avis. Le client est libre de laisser l'avis qu'il souhaite — ou aucun — et gagne quand même sa chance de tourner la roue. Kado respecte les règles de Google et le droit français de la consommation.",
  },
  {
    q: "Mes clients doivent-ils installer une application ?",
    a: "Non, jamais. Ils scannent votre QR code avec l'appareil photo de leur téléphone, et la roue s'ouvre directement dans le navigateur. Aucune installation, aucun compte à créer.",
  },
  {
    q: "Combien ça coûte ?",
    a: "Trois formules sans engagement : Roue à 29 €/mois, Fidélité à 19 €/mois, ou Complet (les deux) à 44 €/mois. Vous démarrez avec 14 jours d'essai gratuit, sans carte bancaire, avec toutes les fonctionnalités.",
  },
  {
    q: "Pour quels commerces ?",
    a: "Tous les commerces qui reçoivent du public : restaurants, bars, coiffeurs, instituts, boutiques, boulangeries, salles de sport, fleuristes… Si vous avez des clients, Kado est fait pour vous.",
  },
  {
    q: "Comment ça s'installe ?",
    a: "En 2 minutes. Vous créez votre espace, choisissez vos cadeaux (pré-remplis selon votre métier), imprimez votre affiche avec le QR code et la posez sur vos tables ou votre comptoir. C'est prêt.",
  },
  {
    q: "Est-ce que je maîtrise les cadeaux distribués ?",
    a: "Oui. Vous fixez la probabilité de chaque lot, un plafond de cadeaux par jour, et chaque gain doit être validé par un code en caisse. Vous gardez le contrôle total sur vos coûts.",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Kado",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Le jeu de roue de la fortune qui transforme vos clients en avis Google 5★ et en abonnés Instagram, sans application.",
  url: "https://kado-app.fr",
  offers: {
    "@type": "Offer",
    price: "29",
    priceCurrency: "EUR",
    description: "Abonnement mensuel sans engagement · essai gratuit 14 jours",
  },
  publisher: { "@type": "Organization", name: "Kado" },
};

export default function Home({
  searchParams,
}: {
  searchParams?: { deleted?: string };
}) {
  return (
    <main className="vitrine">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      {searchParams?.deleted === "1" && (
        <div className="v-flash" role="status">
          ✅ Votre compte a bien été supprimé. Merci d'avoir utilisé Kado.
        </div>
      )}
      <header className="v-topbar">
        <Logo size={42} />
        <nav className="v-topnav">
          <a href="/tarifs">Tarifs</a>
          <a href="/login">Connexion</a>
          <a href="/login?signup=1" className="v-topnav-cta">Créer mon compte</a>
        </nav>
      </header>

      <section className="v-hero">
        <div className="v-badge">🎁 Avis · Abonnés · Fidélité</div>
        <div className="v-wheel" aria-hidden="true">
          <span className="v-wheel-disc" />
          <span className="v-wheel-pin" />
        </div>
        <h1>
          Transformez vos clients en <span>avis &amp; abonnés</span>
        </h1>
        <p className="v-lede">
          Le jeu de roue de la fortune qui booste votre réputation Google et
          votre Instagram — sans effort, à chaque visite.
        </p>
        <p className="v-hero-sectors">
          Restaurant · Coiffeur · Boutique · Boulangerie · Salle de sport…{" "}
          <b>Kado s'adapte à votre métier.</b>
        </p>
        <div className="v-brands">
          <span className="v-brand"><GoogleGlyph /> Plus d'avis 5★</span>
          <span className="v-brand insta"><InstagramGlyph /> Plus d'abonnés</span>
        </div>
        <div className="v-cta">
          <a className="v-btn primary" href="/login?signup=1">Créer mon compte gratuit →</a>
          <a className="v-btn ghost" href="/cafe-lumiere">🎡 Essayer la démo</a>
        </div>
        <div className="v-trust">
          <span><b>✓</b> Sans application</span>
          <span><b>✓</b> Installé en 2 minutes</span>
          <span><b>✓</b> 14 jours d'essai gratuit</span>
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

      <section className="v-section v-preview">
        <div className="pv-copy">
          <h2>Faites tourner la roue 👇</h2>
          <p className="pv-lede">
            Essayez vous-même — cliquez pour lancer la roue. Vos clients
            découvrent la vôtre, à vos couleurs, avec vos cadeaux. Simple,
            joyeux, sur leur téléphone.
          </p>
          <ul className="pv-points">
            <li><Ico name="check" /> Ouverture instantanée dans le navigateur</li>
            <li><Ico name="check" /> Votre logo et vos lots personnalisés</li>
            <li><Ico name="check" /> Code cadeau à valider en caisse</li>
          </ul>
          <a className="v-btn primary" href="/cafe-lumiere">Voir la démo complète →</a>
        </div>
        <div className="pv-phone" aria-label="Aperçu interactif de la roue">
          <div className="pv-notch" />
          <div className="pv-screen">
            <div className="pv-brand">☕ Café Lumière</div>
            <HomeWheel />
            <div className="pv-foot">Suivez-nous · Laissez un avis</div>
          </div>
        </div>
      </section>

      <section className="v-section v-preview alt">
        <div className="lc-frame">
          <HomeLoyalty />
        </div>
        <div className="pv-copy">
          <div className="v-badge" style={{ marginBottom: 14 }}>🎟️ Fidélité digitale</div>
          <h2>Tamponnez la carte 👇</h2>
          <p className="pv-lede">
            Cliquez pour ajouter un tampon et débloquer la récompense. Vos
            clients cumulent à chaque passage — une carte digitale retrouvée par
            e-mail, rien à télécharger, rien à perdre.
          </p>
          <ul className="pv-points">
            <li><Ico name="check" /> Identifiée par e-mail, jamais perdue</li>
            <li><Ico name="check" /> Récompense &amp; tampons personnalisables</li>
            <li><Ico name="check" /> Validation d'un tampon en un scan en caisse</li>
          </ul>
          <a className="v-btn primary" href="/login?signup=1">Créer mon compte gratuit →</a>
        </div>
      </section>

      <section className="v-section">
        <h2>Pensé pour tous les commerces</h2>
        <p className="v-audience-lead">
          Roue de la fortune ou carte de fidélité : Kado s'adapte à votre
          activité, vos couleurs et vos récompenses. Peu importe votre métier,
          l'objectif est le même — <b>plus d'avis, plus d'abonnés, plus de
          clients qui reviennent</b>.
        </p>
        <div className="v-audience">
          {AUDIENCE.map((a) => (
            <span className="v-chip" key={a}>{a}</span>
          ))}
        </div>
        <p className="v-audience-note">
          Si vous avez des clients, <b>Kado est fait pour vous</b>.
        </p>
      </section>

      <section className="v-section">
        <h2>Pourquoi Kado</h2>
        <div className="v-benefits">
          {BENEFITS.map((b) => (
            <div className="v-benefit" key={b.t}>
              <div className="v-ico"><Ico name={b.i} /></div>
              <div>
                <h3>{b.t}</h3>
                <p>{b.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="v-section">
        <h2>Des tarifs simples</h2>
        <p className="v-audience-note" style={{ marginTop: -6, marginBottom: 22 }}>
          Choisissez votre formule — sans engagement, résiliable à tout moment.
        </p>
        <div className="v-plans-row">
          {PLANS.map((p) => (
            <div className={`v-plan${p.popular ? " popular" : ""}`} key={p.id}>
              {p.popular && <div className="v-plan-pop">Le plus populaire</div>}
              <div className="v-plan-name">{p.name}</div>
              <div className="v-plan-price">
                {p.price}&nbsp;€<span>/mois</span>
              </div>
              <div className="v-plan-sub">{p.desc}</div>
              <ul className="v-plan-feats">
                {p.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              <a
                className="v-btn primary"
                href="/login?signup=1"
                style={{ display: "block" }}
              >
                Commencer gratuitement →
              </a>
            </div>
          ))}
        </div>
        <p className="v-audience-note" style={{ marginTop: 18 }}>
          🎁 14 jours d'essai gratuit — sans carte bancaire — toutes fonctionnalités incluses.
        </p>
      </section>

      <section className="v-section">
        <h2>Questions fréquentes</h2>
        <div className="v-faq">
          {FAQ.map((f) => (
            <details className="v-faq-item" key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="v-final">
        <h2>Prêt à faire tourner la roue ?</h2>
        <p>Créez votre compte gratuit et lancez votre première roue en quelques minutes.</p>
        <div className="v-cta">
          <a className="v-btn primary" href="/login?signup=1">Créer mon compte gratuit →</a>
          <a className="v-btn ghost" href="/cafe-lumiere">🎡 Essayer la démo</a>
        </div>
      </section>

      <footer className="v-footer">
        <span>© Kado</span>
        <a href="/tarifs">Tarifs</a>
        <a href="/legal/mentions">Mentions légales</a>
        <a href="/legal/confidentialite">Confidentialité</a>
        <a href="/legal/cgu">CGU</a>
        <a href="/legal/cgv">CGV</a>
        <a href="/login">Connexion</a>
        <a href="/login?signup=1">Créer mon compte</a>
      </footer>
    </main>
  );
}
