import type { Metadata } from "next";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

// ⚠️ Page en `noindex` tant qu'elle contient des exemples. Une fois remplie
// de VRAIS témoignages, retirez le bloc `robots` ci-dessous et le bandeau
// « à personnaliser », puis ajoutez le lien dans la navigation.
export const metadata: Metadata = {
  title: "Témoignages",
  description:
    "Ils utilisent Kado pour récolter plus d'avis Google, d'abonnés Instagram et fidéliser leurs clients.",
  robots: { index: false, follow: false },
};

// ⚠️ REMPLACEZ ces exemples par de VRAIS avis de vos clients (QUSTOS…).
// Ne laissez jamais de faux témoignages : demandez une phrase à vos clients
// satisfaits et collez-la ici avec leur prénom, leur commerce et leur ville.
type Testimonial = {
  quote: string;
  name: string;
  business: string;
  city: string;
  stars: number;
};

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Collez ici l'avis d'un client : ce que Kado lui a apporté (plus d'avis Google, de passages, d'abonnés…).",
    name: "Prénom N.",
    business: "Type de commerce",
    city: "Ville",
    stars: 5,
  },
  {
    quote:
      "Un deuxième témoignage rend la page plus crédible. Une phrase concrète avec un chiffre marque les esprits.",
    name: "Prénom N.",
    business: "Type de commerce",
    city: "Ville",
    stars: 5,
  },
  {
    quote:
      "Trois avis suffisent pour rassurer un prospect. Ajoutez-en au fil de vos clients satisfaits.",
    name: "Prénom N.",
    business: "Type de commerce",
    city: "Ville",
    stars: 5,
  },
];

export default function Temoignages() {
  return (
    <main className="vitrine">
      <header className="v-topbar">
        <a href="/" aria-label="Accueil Kado">
          <Logo size={42} />
        </a>
        <nav className="v-topnav">
          <a href="/">Accueil</a>
          <a href="/tarifs">Tarifs</a>
          <a href="/login" className="v-topnav-cta">
            Espace commerçant
          </a>
        </nav>
      </header>

      <section className="v-hero" style={{ paddingBottom: 10 }}>
        <div className="v-badge">Ils utilisent Kado</div>
        <h1>
          Ce qu'en disent les <span>commerçants</span>
        </h1>
        <p className="v-lede">
          Des commerces de tous les métiers récoltent plus d'avis, d'abonnés et
          de clients fidèles grâce à Kado.
        </p>
      </section>

      {/* ⚠️ Bandeau à retirer une fois les vrais témoignages ajoutés. */}
      <section className="v-section" style={{ paddingTop: 0 }}>
        <div className="temoins-notice">
          🖊️ Page à personnaliser : remplacez les exemples ci-dessous par les
          vrais avis de vos clients, puis retirez ce bandeau.
        </div>
      </section>

      <section className="v-section">
        <div className="temoins-grid">
          {TESTIMONIALS.map((t, i) => (
            <figure className="temoin" key={i}>
              <div className="temoin-stars" aria-label={`${t.stars} étoiles sur 5`}>
                {"★".repeat(t.stars)}
                {"☆".repeat(5 - t.stars)}
              </div>
              <blockquote className="temoin-quote">« {t.quote} »</blockquote>
              <figcaption className="temoin-author">
                <span className="temoin-avatar" aria-hidden="true">
                  {t.name.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <span>
                  <b>{t.name}</b>
                  <small>
                    {t.business}
                    {t.city ? ` · ${t.city}` : ""}
                  </small>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="v-final">
        <h2>Envie de rejoindre ces commerces&nbsp;?</h2>
        <div className="v-cta">
          <a className="v-btn primary" href="/login?signup=1">
            Créer mon compte gratuit →
          </a>
          <a className="v-btn ghost" href="/cafe-lumiere">
            🎡 Essayer la démo
          </a>
        </div>
      </section>

      <footer className="v-footer">
        <a href="/">Accueil</a>
        <a href="/tarifs">Tarifs</a>
        <a href="/legal/cgu">CGU</a>
        <a href="/legal/confidentialite">Confidentialité</a>
        <a href="/login">Espace commerçant</a>
      </footer>
    </main>
  );
}
