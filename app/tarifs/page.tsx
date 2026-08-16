import type { Metadata } from "next";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tarifs",
  description:
    "Kado : 3 formules pour booster votre commerce. Roue 29 EUR/mois, Fidélité 19 EUR/mois, Complet 44 EUR/mois. Essai gratuit 14 jours, sans engagement.",
  alternates: { canonical: "/tarifs" },
};

const PLANS = [
  {
    id: "fidelite",
    name: "Fidélité",
    price: "19",
    desc: "Idéal pour fidéliser vos clients réguliers",
    features: [
      "Carte à tampons digitale",
      "Récompense personnalisable",
      "QR code client + validation en caisse",
      "Statistiques d'inscription",
      "Anti-triche & conformité RGPD",
    ],
  },
  {
    id: "complet",
    name: "Complet",
    price: "44",
    desc: "Roue + fidélité — le meilleur rapport qualité/prix",
    popular: true,
    features: [
      "Tout ce qui est dans Roue",
      "Tout ce qui est dans Fidélité",
      "Le tarif combiné le plus avantageux",
      "4 EUR d'économie par mois",
    ],
  },
  {
    id: "roue",
    name: "Roue",
    price: "29",
    desc: "Boostez vos avis et vos abonnés",
    features: [
      "3 jeux : roue, grattage, machine à sous",
      "Avis Google + abonnés Instagram",
      "Personnalisation (logo, couleurs, fond)",
      "Affiche & QR code à imprimer",
      "Validation en caisse (scan)",
      "Capture d'e-mails (base marketing)",
      "Statistiques et export CSV",
      "Anti-triche & conformité RGPD",
    ],
  },
];

const REASSURE = [
  { i: "🎁", t: "14 jours offerts", d: "Sans carte bancaire" },
  { i: "🔓", t: "Sans engagement", d: "Résiliable en 1 clic" },
  { i: "🇫🇷", t: "Données protégées", d: "Conforme RGPD" },
  { i: "⚡", t: "Prêt en 2 min", d: "Aucune installation" },
];

const VALUE = [
  {
    t: "Les avis font venir les clients",
    d: "9 personnes sur 10 lisent les avis avant de choisir un commerce. Chaque avis 5★ supplémentaire vous rend plus visible sur Google Maps.",
  },
  {
    t: "Une communauté qui revient",
    d: "Un abonné Instagram, c'est un client que vous pouvez toucher gratuitement à chaque promo, nouveauté ou événement.",
  },
  {
    t: "La fidélité qui rapporte",
    d: "Un programme de fidélité digital augmente la fréquence des visites de 20 à 30 %. Vos clients reviennent plus souvent, et dépensent plus.",
  },
];

const FAQ = [
  {
    q: "L'essai est-il vraiment gratuit ?",
    a: "Oui. 14 jours, sans carte bancaire. Vous n'êtes débité que si vous décidez de continuer après l'essai. Pendant l'essai, toutes les fonctionnalités sont accessibles.",
  },
  {
    q: "Puis-je changer de formule ?",
    a: "Oui, à tout moment depuis votre espace. Le changement prend effet immédiatement avec un prorata sur votre prochaine facture.",
  },
  {
    q: "Y a-t-il un engagement ?",
    a: "Aucun. L'abonnement est mensuel et se résilie à tout moment depuis votre espace, en un clic. La résiliation prend effet à la fin de la période déjà payée.",
  },
  {
    q: "Comment se passe le paiement ?",
    a: "Le paiement est 100 % sécurisé via Stripe (carte bancaire). Vous recevez une facture automatique chaque mois.",
  },
  {
    q: "Puis-je supprimer mon compte ?",
    a: "Oui, à tout moment depuis votre espace. Vos données sont alors supprimées et votre abonnement résilié automatiquement.",
  },
];

export default function Tarifs() {
  return (
    <main className="vitrine">
      <header className="v-topbar">
        <a href="/" aria-label="Accueil Kado">
          <Logo size={42} />
        </a>
        <nav className="v-topnav">
          <a href="/">Accueil</a>
          <a href="/login" className="v-topnav-cta">Espace commerçant</a>
        </nav>
      </header>

      <section className="v-hero" style={{ paddingBottom: 10 }}>
        <div className="v-badge">3 formules, sans engagement</div>
        <h1>
          Choisissez votre <span>formule</span>
        </h1>
        <p className="v-lede">
          Essai gratuit de 14 jours avec toutes les fonctionnalités, puis
          abonnement mensuel résiliable quand vous voulez.
        </p>
        <div className="tarif-reassure">
          {REASSURE.map((r) => (
            <div className="tarif-re" key={r.t}>
              <span className="tarif-re-i">{r.i}</span>
              <b>{r.t}</b>
              <small>{r.d}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="v-section">
        <div className="v-plans-row">
          {PLANS.map((p) => (
            <div
              className={`v-plan${p.popular ? " popular" : ""}`}
              key={p.id}
            >
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
              <a className="v-btn primary" href="/login" style={{ display: "block" }}>
                Commencer l'essai gratuit →
              </a>
            </div>
          ))}
        </div>
        <p className="v-plan-note" style={{ textAlign: "center", marginTop: 16 }}>
          14 jours d'essai gratuit · sans carte bancaire · toutes fonctionnalités incluses
        </p>
      </section>

      <section className="v-section">
        <div className="v-setup">
          <h3>🛠️ Pas le temps de configurer ? On s'occupe de tout.</h3>
          <p>
            Avec l'option <b>Installation clé en main</b>, on paramètre votre
            espace de A à Z : roue à vos couleurs, cadeaux adaptés à votre
            métier, liens Google &amp; Instagram, carte de fidélité et affiche
            QR prête à poser. À régler une seule fois, au moment de votre
            abonnement.
          </p>
          <div className="v-setup-opts">
            <div className="v-setup-opt">
              <b>À distance — 79 €</b>
              <small>
                Configuration complète de votre espace + affiche PDF à imprimer.
                Prêt sous 24 h ouvrées.
              </small>
            </div>
            <div className="v-setup-opt">
              <b>Sur place — 129 €</b>
              <small>
                Tout ça + on vient poser l'affiche et former votre équipe
                (15 min). Vous n'avez rien à faire.
              </small>
            </div>
          </div>
          <p className="v-setup-note">
            Option proposée au moment de l'abonnement, dans votre espace.
          </p>
        </div>
      </section>

      <section className="v-section">
        <h2>Ce que ça vous rapporte</h2>
        <div className="v-benefits">
          {VALUE.map((v) => (
            <div className="v-benefit" key={v.t}>
              <div>
                <h3>{v.t}</h3>
                <p>{v.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="v-section">
        <h2>Questions sur l'abonnement</h2>
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
        <h2>Prêt à essayer ?</h2>
        <p>14 jours gratuits, sans carte bancaire. Vous verrez la différence.</p>
        <div className="v-cta">
          <a className="v-btn primary" href="/login">Commencer l'essai gratuit →</a>
        </div>
      </section>

      <footer className="v-footer">
        <a href="/">Accueil</a>
        <a href="/legal/cgu">CGU</a>
        <a href="/legal/cgv">CGV</a>
        <a href="/legal/confidentialite">Confidentialité</a>
        <a href="/login">Espace commerçant</a>
      </footer>
    </main>
  );
}
