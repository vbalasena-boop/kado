import { KadoMark } from "@/components/Logo";

/**
 * Guide de démarrage commerçant — document imprimable (A4) au format
 * « magazine » : bandeau courant, titre serif, étapes numérotées 01/02/03,
 * cartes « bons réflexes », QR personnalisé. Rendu clair pour l'impression.
 * S'inspire d'un gabarit de guide éditorial (eyebrows mono, accents serif).
 */
export type StartGuideProps = {
  name: string;
  url: string;
  qrDataUrl: string;
  logoUrl?: string | null;
  today?: string;
};

const STEPS = [
  {
    n: "01",
    t: "Posez votre affiche",
    d: "Imprimez votre affiche (onglet « QR code & affiche ») et placez-la bien en vue : sur les tables, le comptoir ou la vitrine. C'est elle qui déclenche tout.",
  },
  {
    n: "02",
    t: "Invitez vos clients à scanner",
    d: "Un mot suffit en caisse : « Scannez pour tenter de gagner un cadeau ». Ils ouvrent l'appareil photo, visent le QR — aucune application à installer.",
  },
  {
    n: "03",
    t: "Validez les cadeaux en caisse",
    d: "Le client gagnant présente son code (ou son QR). Vous le validez d'un scan depuis votre espace : chaque code n'est utilisable qu'une fois.",
  },
];

const TIPS = [
  {
    n: "A",
    t: "Mettez l'affiche en évidence",
    d: "Plus elle est visible, plus vos clients jouent. Au moins une par table, une au comptoir.",
  },
  {
    n: "B",
    t: "Dites-le à voix haute",
    d: "Une phrase en caisse double la participation. Faites-en un réflexe d'équipe.",
  },
  {
    n: "C",
    t: "Gardez la main sur les lots",
    d: "Vous fixez les probabilités et un plafond de cadeaux par jour. Vos coûts restent maîtrisés.",
  },
  {
    n: "D",
    t: "Suivez vos résultats",
    d: "Avis, abonnés, visites : votre tableau de bord montre l'impact, semaine après semaine.",
  },
];

export function StartGuide({ name, url, qrDataUrl, logoUrl, today }: StartGuideProps) {
  return (
    <article className="sg">
      <header className="sg-top">
        <span className="sg-top-l">KADO · GUIDE DE DÉMARRAGE</span>
        <span className="sg-top-r">{name}</span>
      </header>

      <div className="sg-intro">
        <span className="sg-eyebrow">Bienvenue chez Kado</span>
        <h1 className="sg-title">
          Lancez <span className="sg-serif">{name}</span> en 3 étapes
        </h1>
        <p className="sg-lede">
          Pas de technique, pas d'installation. En quelques minutes, vos clients
          jouent, vous récoltez plus d'avis Google, d'abonnés et de visites.
        </p>
      </div>

      <ol className="sg-steps">
        {STEPS.map((s) => (
          <li key={s.n}>
            <span className="sg-step-n">{s.n}</span>
            <div className="sg-step-body">
              <h2>{s.t}</h2>
              <p>{s.d}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="sg-link">
        <div className="sg-link-copy">
          <span className="sg-eyebrow">Votre page de jeu</span>
          <h2>Votre QR, prêt à partager</h2>
          <p>
            Vos clients arrivent directement sur votre page à vos couleurs.
            Partagez aussi le lien sur votre fiche Google, Instagram ou par SMS.
          </p>
          <div className="sg-url">{url}</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="QR code de votre page de jeu" className="sg-qr" />
      </section>

      <section className="sg-tips">
        <span className="sg-eyebrow">Les bons réflexes</span>
        <div className="sg-tips-grid">
          {TIPS.map((t) => (
            <div className="sg-tip" key={t.n}>
              <span className="sg-tip-n">{t.n}</span>
              <h3>{t.t}</h3>
              <p>{t.d}</p>
            </div>
          ))}
        </div>
      </section>

      <blockquote className="sg-quote">
        Vos clients repartent avec un cadeau. Vous, avec un avis, un abonné et
        une visite de plus.
      </blockquote>

      <footer className="sg-foot">
        <span className="sg-foot-l">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="sg-foot-logo" />
          ) : (
            <KadoMark size={18} />
          )}
          Propulsé par <b>Kado</b>
        </span>
        <span className="sg-foot-r">{today ?? ""}</span>
      </footer>
    </article>
  );
}
