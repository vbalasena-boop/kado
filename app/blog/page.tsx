import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ARTICLES } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog — Conseils pour votre commerce",
  description:
    "Avis Google, fidélisation, Instagram, réglementation : nos guides pratiques pour attirer plus de clients et les faire revenir. Par Kado.",
  alternates: { canonical: "/blog" },
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
    <main className="vitrine">
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
        <div className="v-badge">📚 Le blog Kado</div>
        <h1>Conseils pour faire grandir votre commerce</h1>
        <p className="v-lede">
          Avis Google, fidélisation, Instagram, réglementation : des guides
          concrets, écrits pour les commerçants de proximité.
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
        <h2>Prêt à transformer vos clients en avis et en abonnés ?</h2>
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
