import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import SupportButton from "@/components/SupportButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tarifs",
  description:
    "Kado : 4 formules pour booster votre commerce : Jeux 29 €/mois, Fidélité 19 €/mois, Complet 44 €/mois, Comptoir (bipeur digital) 19 €/mois. Essai gratuit 14 jours, sans engagement.",
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
      "Anniversaires automatiques & parrainage",
      "Option campagnes e-mail + notifs push (+15 €/mois)",
      "QR code client + validation en caisse",
      "Statistiques d'inscription",
      "Anti-triche & conformité RGPD",
    ],
  },
  {
    id: "complet",
    name: "Complet",
    price: "44",
    desc: "Tout Kado en un seul abonnement",
    popular: true,
    features: [
      "Tout ce qui est dans Jeux",
      "Tout ce qui est dans Fidélité",
      "Commande en ligne (click & collect) incluse",
      "Suivi au comptoir + bipeur digital inclus",
      "Le meilleur rapport qualité/prix",
    ],
  },
  {
    id: "roue",
    name: "Jeux",
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
  {
    id: "comptoir",
    name: "Comptoir",
    price: "19",
    desc: "Le bipeur digital — vos clients prévenus sur leur téléphone",
    features: [
      "Le client prend un numéro en scannant un QR",
      "Suivi de commande en direct",
      "Alerte quand c'est prêt (notification + e-mail)",
      "Compatible avec votre caisse actuelle",
      "Illimité — plus de bipeurs à acheter",
      "Aussi disponible en option (+12 €/mois) sur les autres formules",
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
    q: "Existe-t-il un parrainage ?",
    a: "Oui ! Recommandez Kado à un autre commerçant avec votre lien de parrainage (dans votre espace) : dès qu'il s'abonne et règle son premier paiement, votre prochain mois est offert. Sans limite.",
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
        <div className="v-badge">4 formules, sans engagement</div>
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
          <div className="v-setup-hl">
            <span className="v-setup-hl-badge">🎨 Exclusif Installation</span>
            <div>
              <b>Page de jeu sur-mesure incluse</b>
              <small>
                On crée votre page aux couleurs exactes de votre enseigne :
                fond, teintes, ambiance et même un décor animé à votre image
                (par ex. tomates, basilic &amp; pâtes qui flottent pour un
                restaurant italien). Sans l'option, vous choisissez parmi
                3 thèmes prêts à l'emploi — avec elle, c'est une page unique,
                impossible à confondre avec une autre.
              </small>
            </div>
          </div>
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
        <div className="v-multi">
          <span className="v-multi-badge">🏪 Chaînes &amp; franchises</span>
          <h3>Plusieurs boutiques ? Un seul compte, un tarif dégressif.</h3>
          <p className="v-multi-lede">
            Gérez tous vos établissements depuis le même espace : basculez de
            l'un à l'autre en un clic, chacun avec son jeu, sa fidélité, ses
            statistiques et son QR. Une seule connexion, une seule facture.
          </p>
          <div className="v-multi-grid">
            <div className="v-multi-opt">
              <b>🗂️ Un seul espace</b>
              <small>Toutes vos boutiques, une seule connexion, une seule facture.</small>
            </div>
            <div className="v-multi-opt is-hl">
              <span className="v-multi-tag">Sur devis</span>
              <b>💶 Tarif dégressif</b>
              <small>Plus vous ajoutez de boutiques, meilleur est le tarif. Nous consulter.</small>
            </div>
            <div className="v-multi-opt">
              <b>🤝 Accompagnement</b>
              <small>On paramètre chaque établissement avec vous, clé en main.</small>
            </div>
          </div>
          <ul className="v-multi-feats">
            <li>✓ Sélecteur d'établissement intégré à votre espace</li>
            <li>✓ Jeux, fidélité, stats &amp; QR indépendants par boutique</li>
            <li>✓ Facturation groupée, une seule connexion</li>
            <li>✓ Pensé pour chaînes, franchises et multi-enseignes</li>
          </ul>
          <a
            className="v-btn primary"
            href="mailto:bonjour@kado-app.fr?subject=Offre%20multi-boutiques%20Kado"
          >
            Nous consulter →
          </a>
          <p className="v-setup-note">
            Réponse sous 24 h — <b>bonjour@kado-app.fr</b>.
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
      <SupportButton prospect />
    </main>
  );
}
