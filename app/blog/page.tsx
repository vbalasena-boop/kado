import { publicMetadata } from "@/lib/public-metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/Logo";
import { ARTICLES } from "@/lib/blog";

export const metadata = {
  ...publicMetadata('Blog Kado : conseils pour commerces de proximité', 'Un petit jeu et une carte de fidélité pour donner à vos clients une vraie raison de revenir. Guides pratiques pour commerces de proximité.', '/blog'),
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function BlogIndex() {
  return (
    <main id="main-content" tabIndex={-1} className="vitrine">
      <header className="v-topbar">
        <Link href="/"><Logo size={42} /></Link>
        <nav className="v-topnav">
          <a href="/blog">Blog</a>
          <a href="/tarifs">Tarifs</a>
          <a href="/login">Connexion</a>
          <a href="/login?signup=1" className="v-topnav-cta">Créer mon compte</a>
        </nav>
      </header>

      <section className="blog-head">
        <div className="v-badge"><BookOpen className="ico" size={16} weight="bold" /> Le blog Kado</div>
        <h1>Conseils pour faire grandir votre commerce</h1>
        <p className="v-lede">
          Un petit jeu, une carte de fidélité et des idées concrètes pour donner
          à vos clients une vraie raison de revenir.
        </p>
      </section>

      <section className="blog-grid">
        {ARTICLES.map((a) => (
          <Link key={a.slug} href={`/blog/${a.slug}`} className="blog-card">
            <div className="blog-card-emoji">{a.emoji}</div>
            <span className="blog-card-cat">{a.category}</span>
            <h2>{a.title}</h2>
            <p>{a.excerpt}</p>
            <span className="blog-card-meta">
              {fmt(a.date)} · {a.readMinutes} min de lecture
            </span>
          </Link>
        ))}
      </section>

      <section className="blog-cta">
        <h2>Prêt à donner à vos clients une raison de revenir ?</h2>
        <p>Essai gratuit 14 jours, sans carte bancaire.</p>
        <a className="v-btn primary" href="/login?signup=1">Créer mon compte gratuit →</a>
      </section>

      <footer className="v-footer">
        <span>© Kado</span>
        <a href="/blog">Blog</a>
        <a href="/tarifs">Tarifs</a>
        <a href="/legal/mentions">Mentions légales</a>
        <a href="/legal/confidentialite">Confidentialité</a>
        <a href="/login">Connexion</a>
      </footer>
    </main>
  );
}
