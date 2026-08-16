import type { Metadata } from "next";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tarifs",
  description:
    "Kado Pro : 29 €/mois, sans engagement, essai gratuit 14 jours. Tout inclus : roue personnalisable, avis Google, Instagram, statistiques et validation en caisse.",
  alternates: { canonical: "/tarifs" },
};

const FEATURES = [
  "Roue de la fortune illimitée",
  "Avis Google + abonnés Instagram",
  "Personnalisation (logo, couleurs, fond)",
  "Affiche & QR code à imprimer",
  "Validation des cadeaux en caisse (scan)",
  "Capture d'e-mails clients (base marketing)",
  "Statistiques et export CSV",
  "Anti-triche & conformité RGPD",
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
    t: "Le cadeau ramène en boutique",
    d: "Un lot à récupérer sur place, c'est une visite de plus — et souvent un achat qui couvre largement le coût du cadeau.",
  },
];

const FAQ = [
  {
    q: "L'essai est-il vraiment gratuit ?",
    a: "Oui. 14 jours, sans carte bancaire. Vous n'êtes débité que si vous décidez de continuer après l'essai.",
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
        <div className="v-badge">🎡 Un seul tarif, tout compris</div>
        <h1>
          Un tarif <span>simple</span>
        </h1>
        <p className="v-lede">
          Tout Kado, sans engagement. Essai gratuit de 14 jours, puis abonnement
          mensuel résiliable quand vous voulez.
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

      <section className="v-section" style={{ display: "flex", justifyContent: "center" }}>
        <div className="v-plan">
          <div className="v-plan-name">Kado Pro</div>
          <div className="v-plan-price">
            29&nbsp;€<span>/mois</span>
          </div>
          <div className="v-plan-sub">14 jours d'essai gratuit · sans carte bancaire</div>
          <ul className="v-plan-feats">
            {FEATURES.map((f) => (
              <li key={f}>✓ {f}</li>
            ))}
          </ul>
          <a className="v-btn primary" href="/login" style={{ display: "block" }}>
            Commencer l'essai gratuit →
          </a>
          <p className="v-plan-note">
            Sans engagement · résiliable à tout moment depuis votre espace.
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
