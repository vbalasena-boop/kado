import {
  Gift,
  Play,
  CursorClick,
  Coffee,
  Ticket,
  Sparkle,
  CalendarBlank,
  Robot,
  ArrowsClockwise,
  CheckCircle,
} from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/Logo";
import Reveal from "@/components/Reveal";
import HeroEditorial from "@/components/HeroEditorial";
import HomeGames from "@/components/HomeGames";
import HomeLoyalty from "@/components/HomeLoyalty";
import SupportButton from "@/components/SupportButton";

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
    case "mail":
      return <svg {...c}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 8l9 6 9-6" /></svg>;
    case "gift":
      return <svg {...c}><rect x="3" y="9" width="18" height="4" /><path d="M5 13v7h14v-7" /><path d="M12 9v11" /><path d="M12 9c-4 0-5.5-2-5-3.5C7.6 3.7 10 4.5 12 9zm0 0c4 0 5.5-2 5-3.5C16.4 3.7 14 4.5 12 9z" /></svg>;
    case "check":
      return <svg {...c} width={18} height={18}><path d="M4 12l5 5L20 6" /></svg>;
    case "lock":
      return <svg {...c}><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /><path d="M12 14v2" /></svg>;
    default:
      return null;
  }
}

const STEPS = [
  { n: "1", t: "Vos clients scannent", d: "Un QR code sur la table, le ticket ou un sticker. Aucune application à installer." },
  { n: "2", t: "Ils réalisent une action & jouent", d: "Un tour de roue pour un suivi Instagram (ou l’inscription à votre fidélité). L’avis Google reste proposé, libre et sans obligation." },
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
  { i: "lock", t: "Vos avis Google en sécurité", d: "Le cadeau n’est jamais lié à l’avis : pas de « review gating », donc aucun risque de voir vos avis supprimés par Google." },
  { i: "mail", t: "Campagnes e-mail & notifs (option)", d: "Envoyez vos offres par e-mail et notification sur le téléphone de vos clients (+15 €/mois)." },
  { i: "gift", t: "Anniversaires & parrainage", d: "E-mail automatique le jour J, et +1 tampon quand un ami parrainé passe en caisse." },
  { i: "palette", t: "À vos couleurs", d: "Logo, photo de fond et lots entièrement personnalisables." },
  { i: "shield", t: "Anti-triche", d: "Tirage sécurisé côté serveur, 2 chances maximum par personne." },
  { i: "coins", t: "Coûts maîtrisés", d: "Vous choisissez les lots, leur probabilité et le plafond quotidien." },
];

const PLANS = [
  {
    id: "roue",
    name: "Jeux",
    price: "29",
    desc: "Boostez vos avis & abonnés",
    features: [
      "3 jeux : roue, grattage, machine à sous",
      "Avis Google + Instagram",
      "Option campagnes e-mail + notifs (+15 €)",
      "QR code, stats, validation",
    ],
  },
  {
    id: "complet",
    name: "Complet",
    price: "44",
    desc: "Jeux + fidélité, le meilleur tarif",
    popular: true,
    features: [
      "Tout ce qui est dans Jeux",
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
      "Anniversaires & parrainage",
      "Option campagnes e-mail + notifs (+15 €)",
      "Stats d'inscription",
    ],
  },
  {
    id: "comptoir",
    name: "Comptoir",
    price: "19",
    desc: "Le bipeur digital, sans boîtier",
    features: [
      "Bipeur digital (file d'attente)",
      "Client prévenu sur son téléphone",
      "Commande en ligne (click & collect) incluse",
      "Idéal fast-food, boulangerie, café",
    ],
  },
];

const FAQ = [
  {
    q: "C'est légal d'offrir un cadeau contre un avis ?",
    a: "Oui, car le cadeau récompense la participation au jeu (une action comme suivre votre Instagram), jamais le contenu ou la note de l'avis. Le client est libre de laisser l'avis qu'il souhaite, ou aucun, et gagne sa chance quoi qu'il arrive. Kado respecte les règles de Google et le droit français de la consommation.",
  },
  {
    q: "Kado met-il mes avis Google en danger ?",
    a: "Non. Contrairement aux systèmes « un avis = une récompense », que Google peut sanctionner jusqu'à la suppression des avis, avec Kado le cadeau n'est jamais lié à l'avis. L'avis Google est un simple lien facultatif : votre fiche reste protégée.",
  },
  {
    q: "Mes clients doivent-ils installer une application ?",
    a: "Non, jamais. Ils scannent votre QR code avec l'appareil photo de leur téléphone, et la roue s'ouvre directement dans le navigateur. Aucune installation, aucun compte à créer.",
  },
  {
    q: "Combien ça coûte ?",
    a: "Quatre formules sans engagement : Jeux à 29 €/mois, Fidélité à 19 €/mois, Complet (les deux) à 44 €/mois, et Comptoir (le bipeur digital) à 19 €/mois. Vous démarrez avec 14 jours d'essai gratuit, sans carte bancaire, avec toutes les fonctionnalités.",
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
    a: "Oui. Vous choisissez les lots, leur probabilité et le plafond de cadeaux par jour. Pour lancer le jeu, aucun code n'est à préparer ni à remettre aux clients.",
  },
  {
    q: "Comment mes clients récupèrent-ils leur cadeau ?",
    a: "À la fin du jeu, votre client obtient un code (et un QR code). Il le présente en caisse lors de sa visite : vous le validez d'un scan ou en saisissant le code. Chaque code n'est utilisable qu'une seule fois.",
  },
  {
    q: "Puis-je changer de formule ou résilier ?",
    a: "Oui, à tout moment et sans engagement. Vous changez de formule ou résiliez en quelques clics depuis votre espace commerçant.",
  },
  {
    q: "Ai-je besoin d'un compte Google ou Instagram particulier ?",
    a: "Non. Il suffit d'avoir une fiche Google et un compte Instagram publics : vous collez simplement leurs liens dans votre espace. Aucun accès spécial ni configuration technique à prévoir.",
  },
];

// Données structurées (schema.org) : améliorent l'affichage dans Google
// (résultats enrichis FAQ, fiche logiciel, organisation).
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://kado-app.fr/#organization",
      name: "Kado",
      url: "https://kado-app.fr",
      logo: "https://kado-app.fr/icon-512.png",
      description:
        "Kado est la solution tout-en-un de fidélisation pour les commerces de proximité : jeux, avis Google, carte de fidélité digitale, campagnes et commande en ligne.",
      areaServed: "FR",
      email: "vbalasena@instant-events.fr",
      address: {
        "@type": "PostalAddress",
        streetAddress: "5 rue Émile Cousin",
        postalCode: "78000",
        addressLocality: "Versailles",
        addressCountry: "FR",
      },
    },
    {
      "@type": "WebSite",
      "@id": "https://kado-app.fr/#website",
      url: "https://kado-app.fr",
      name: "Kado",
      inLanguage: "fr-FR",
      publisher: { "@id": "https://kado-app.fr/#organization" },
    },
    {
      "@type": "SoftwareApplication",
      name: "Kado",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "fr-FR",
      description:
        "Le jeu à scanner en caisse qui transforme vos clients en avis Google 5★ et en abonnés Instagram, avec carte de fidélité digitale, campagnes e-mail et commande en ligne. Sans application.",
      url: "https://kado-app.fr",
      publisher: { "@id": "https://kado-app.fr/#organization" },
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "EUR",
        lowPrice: "19",
        highPrice: "44",
        offerCount: "4",
        description:
          "Abonnement mensuel sans engagement · essai gratuit 14 jours, sans carte bancaire",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
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
          <CheckCircle className="ico" size={18} weight="fill" /> Votre compte a bien été supprimé. Merci d'avoir utilisé Kado.
        </div>
      )}
      <header className="v-topbar">
        <Logo size={42} />
        <span className="nav-note">Le jeu qui fait parler de vous.</span>
        <nav className="v-topnav">
          <a href="/blog">Blog</a>
          <a href="/tarifs">Tarifs</a>
          <a href="/login">Connexion</a>
          <a href="/login?signup=1" className="v-topnav-cta">Créer mon compte</a>
        </nav>
      </header>

      <HeroEditorial />

      <section className="v-section story-section" aria-labelledby="story-title">
        <div className="story-heading">
          <span className="section-index">01 / Le principe</span>
          <h2 id="story-title">Tout part d’un <em>petit moment.</em></h2>
          <p>Pas d’application, pas de mode d’emploi. Vos clients connaissent déjà la suite.</p>
        </div>
        <div className="v-steps">
          {STEPS.map((s) => (
            <article className="v-step" key={s.n}>
              <span className="v-step-n">0{s.n}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </article>
          ))}
        </div>
        <div className="story-ribbon" aria-label="Simple pour vos clients">
          <span>Un scan</span><b>→</b><span>Un jeu</span><b>→</b><span>Un sourire</span>
        </div>
      </section>

      <section className="v-section v-preview">
        <div className="pv-copy">
          <span className="section-index">02 / À chacun son jeu</span>
          <h2>Leur curiosité fait le reste <CursorClick className="ico" size={26} weight="bold" /></h2>
          <p className="pv-lede">
            Roue de la fortune, carte à gratter ou machine à sous : vous
            choisissez le jeu qui colle à votre commerce. Testez les trois
            ici même : vos clients découvrent le vôtre, à vos couleurs, avec
            vos cadeaux.
          </p>
          <ul className="pv-points">
            <li><Ico name="check" /> 3 jeux, changez quand vous voulez</li>
            <li><Ico name="check" /> Ouverture instantanée dans le navigateur</li>
            <li><Ico name="check" /> Code cadeau à valider en caisse</li>
          </ul>
          <a className="v-btn primary" href="/cafe-lumiere">Voir la démo complète →</a>
        </div>
        <div className="pv-phone" aria-label="Aperçu interactif des jeux">
          <div className="pv-notch" />
          <div className="pv-screen">
            <div className="pv-brand"><Coffee className="ico" size={18} weight="fill" /> Café Lumière</div>
            <HomeGames />
            <div className="pv-foot">Suivez-nous · Laissez un avis</div>
          </div>
        </div>
      </section>

      <section className="v-section v-preview alt">
        <div className="lc-frame">
          <HomeLoyalty />
        </div>
        <div className="pv-copy">
          <div className="v-badge" style={{ marginBottom: 14 }}><Ticket className="ico" size={16} weight="bold" /> Fidélité digitale</div>
          <span className="section-index">03 / Les habitués</span>
          <h2>Les bonnes adresses se gardent <CursorClick className="ico" size={26} weight="bold" /></h2>
          <p className="pv-lede">
            Cliquez pour ajouter un tampon et débloquer la récompense. Vos
            clients cumulent à chaque passage : une carte digitale retrouvée par
            e-mail, rien à télécharger, rien à perdre.
          </p>
          <ul className="pv-points">
            <li><Ico name="check" /> Identifiée par e-mail, jamais perdue</li>
            <li><Ico name="check" /> Récompense &amp; tampons personnalisables</li>
            <li><Ico name="check" /> Validation d'un tampon en un scan en caisse</li>
            <li><Ico name="check" /> Anniversaires automatiques &amp; parrainage entre clients</li>
          </ul>
          <a className="v-btn primary" href="/login?signup=1">Créer mon compte gratuit →</a>
        </div>
      </section>

      <section className="v-section">
        <span className="section-index">04 / Le commerce de proximité</span>
        <h2>Chaque adresse a son petit rituel.</h2>
        <p className="v-audience-lead">
          Roue de la fortune ou carte de fidélité : Kado s'adapte à votre
          activité, vos couleurs et vos récompenses. Peu importe votre métier,
          l'objectif est le même : <b>plus d'avis, plus d'abonnés, plus de
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
        <div className="v-concours">
          <span className="v-concours-badge"><Sparkle className="ico" size={15} weight="fill" /> Nouveau</span>
          <span className="section-index">05 / De temps en temps</span>
          <h2 style={{ marginBottom: 10 }}>
            Lancez un <span className="v-hl">concours</span> qui fait revenir
            vos clients
          </h2>
          <p className="v-concours-lede">
            En plus des cadeaux instantanés, organisez un <b>tirage au sort</b>{" "}
            automatique, chaque semaine ou chaque mois, à la date de votre
            choix. Un gagnant est désigné au hasard parmi vos clients&nbsp;: ils
            reviennent pour savoir s'ils ont gagné.
          </p>
          <div className="v-concours-grid">
            <div className="v-concours-item">
              <span><CalendarBlank size={28} weight="bold" color="var(--gold)" /></span>
              <b>Fréquence au choix</b>
              <small>Hebdomadaire, mensuel… vous programmez la date.</small>
            </div>
            <div className="v-concours-item">
              <span><Robot size={28} weight="bold" color="var(--gold)" /></span>
              <b>100 % automatique</b>
              <small>Le gagnant est tiré et prévenu par e-mail, sans effort.</small>
            </div>
            <div className="v-concours-item">
              <span><ArrowsClockwise size={28} weight="bold" color="var(--gold)" /></span>
              <b>Ils reviennent</b>
              <small>Un vrai levier de fidélité, sans obligation d'achat.</small>
            </div>
          </div>
        </div>
      </section>

      <section className="v-section">
        <span className="section-index">06 / Ce qui compte</span>
        <h2>Simple à lancer. Agréable à retrouver.</h2>
        <Reveal className="v-benefits">
          {BENEFITS.map((b) => (
            <div className="v-benefit" key={b.t}>
              <div className="v-ico"><Ico name={b.i} /></div>
              <div>
                <h3>{b.t}</h3>
                <p>{b.d}</p>
              </div>
            </div>
          ))}
        </Reveal>
      </section>

      <section className="v-section">
        <span className="section-index">07 / Un cadre clair</span>
        <h2>Les avis restent libres.</h2>
        <Reveal className="v-compare">
          <div className="v-compare-col risk">
            <div className="v-compare-head">
              <span className="v-compare-badge risk" aria-hidden="true">✕</span>
              <h3>Les systèmes « un avis&nbsp;= une récompense »</h3>
            </div>
            <ul>
              <li>Le cadeau est lié à l’avis&nbsp;: c’est du «&nbsp;review gating&nbsp;», interdit par Google.</li>
              <li>Vos avis peuvent être supprimés rétroactivement.</li>
              <li>Votre fiche Google est exposée à une sanction.</li>
              <li>Souvent, seuls les clients contents sont incités (biaisé).</li>
            </ul>
          </div>
          <div className="v-compare-col ok">
            <div className="v-compare-head">
              <span className="v-compare-badge ok" aria-hidden="true">✓</span>
              <h3>Avec Kado</h3>
            </div>
            <ul>
              <li>Le cadeau récompense le <b>jeu</b>, jamais l’avis.</li>
              <li>Aucun review gating&nbsp;: votre fiche reste <b>protégée</b>.</li>
              <li>L’avis Google reste un lien <b>libre et facultatif</b>.</li>
              <li>Proposé à <b>tous</b> les clients, sans tri par satisfaction.</li>
            </ul>
          </div>
        </Reveal>
      </section>

      <section className="v-section">
        <span className="section-index">08 / Les formules</span>
        <h2>Choisissez votre point de départ.</h2>
        <p className="v-audience-note" style={{ marginTop: -6, marginBottom: 22 }}>
          Choisissez votre formule, sans engagement, résiliable à tout moment.
        </p>
        <Reveal className="v-plans-row">
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
        </Reveal>
        <p className="v-audience-note" style={{ marginTop: 18 }}>
          <Gift className="ico" size={16} weight="bold" color="var(--gold)" /> 14 jours d'essai gratuit, sans carte bancaire, toutes fonctionnalités incluses.
        </p>
      </section>

      <section className="v-section">
        <span className="section-index">09 / Les questions qu’on nous pose</span>
        <h2>Avant de vous lancer.</h2>
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
        <span className="section-index">On ouvre la boutique ?</span>
        <h2>Le premier tour est pour vous.</h2>
        <p>Essayez Kado dans votre commerce pendant 14 jours. Vous verrez vite si vos clients accrochent.</p>
        <div className="v-cta">
          <a className="v-btn primary" href="/login?signup=1">Créer mon compte gratuit →</a>
          <a className="v-btn ghost" href="/cafe-lumiere"><Play className="ico" size={18} weight="fill" /> Essayer la démo</a>
        </div>
      </section>

      <footer className="v-footer">
        <span className="footer-brand"><Logo size={28} /> © Kado</span>
        <a href="/blog">Blog</a>
        <a href="/tarifs">Tarifs</a>
        <a href="/legal/mentions">Mentions légales</a>
        <a href="/legal/confidentialite">Confidentialité</a>
        <a href="/legal/cgu">CGU</a>
        <a href="/legal/cgv">CGV</a>
        <a href="/vendeur">Devenir promoteur</a>
        <a href="/login">Connexion</a>
        <a href="/login?signup=1">Créer mon compte</a>
      </footer>
      <SupportButton prospect />
    </main>
  );
}
