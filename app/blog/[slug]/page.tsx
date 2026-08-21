import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ARTICLES, getArticle, type Block } from "@/lib/blog";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const a = getArticle(params.slug);
  if (!a) return { title: "Article introuvable" };
  return {
    title: a.metaTitle,
    description: a.description,
    keywords: a.keywords,
    alternates: { canonical: `/blog/${a.slug}` },
    openGraph: {
      title: a.metaTitle,
      description: a.description,
      type: "article",
      url: `https://kado-app.fr/blog/${a.slug}`,
      publishedTime: a.date,
    },
  };
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function renderBlock(b: Block, i: number) {
  if ("h" in b) return <h2 key={i}>{b.h}</h2>;
  if ("p" in b) return <p key={i}>{b.p}</p>;
  if ("quote" in b) return <blockquote key={i}>{b.quote}</blockquote>;
  if ("ul" in b)
    return (
      <ul key={i}>
        {b.ul.map((li, j) => (
          <li key={j}>{li}</li>
        ))}
      </ul>
    );
  return null;
}

export default function ArticlePage({
  params,
}: {
  params: { slug: string };
}) {
  const a = getArticle(params.slug);
  if (!a) notFound();

  const others = ARTICLES.filter((x) => x.slug !== a.slug).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.description,
    datePublished: a.date,
    dateModified: a.date,
    author: { "@type": "Organization", name: "Kado", url: "https://kado-app.fr" },
    publisher: {
      "@type": "Organization",
      name: "Kado",
      logo: {
        "@type": "ImageObject",
        url: "https://kado-app.fr/icon-512.png",
      },
    },
    mainEntityOfPage: `https://kado-app.fr/blog/${a.slug}`,
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: "https://kado-app.fr" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://kado-app.fr/blog" },
      {
        "@type": "ListItem",
        position: 3,
        name: a.title,
        item: `https://kado-app.fr/blog/${a.slug}`,
      },
    ],
  };

  return (
    <main className="vitrine">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <header className="v-topbar">
        <Link href="/"><Logo size={42} /></Link>
        <nav className="v-topnav">
          <a href="/blog">Blog</a>
          <a href="/tarifs">Tarifs</a>
          <a href="/login">Connexion</a>
          <a href="/login?signup=1" className="v-topnav-cta">Créer mon compte</a>
        </nav>
      </header>

      <article className="blog-article">
        <Link href="/blog" className="blog-back">← Tous les articles</Link>
        <span className="blog-card-cat">{a.category}</span>
        <h1>{a.title}</h1>
        <p className="blog-article-meta">
          {fmt(a.date)} · {a.readMinutes} min de lecture
        </p>
        <div className="blog-body">{a.blocks.map(renderBlock)}</div>

        <div className="blog-inline-cta">
          <div className="blog-inline-emoji">🎁</div>
          <div>
            <b>Envie de passer à l'action ?</b>
            <p>
              Kado transforme vos clients en avis Google, en abonnés et en
              habitués — avec un simple jeu à scanner en caisse. Essai gratuit
              14 jours, sans carte bancaire.
            </p>
            <a className="v-btn primary" href="/login?signup=1">Créer mon compte gratuit →</a>
          </div>
        </div>
      </article>

      <section className="blog-more">
        <h2>À lire aussi</h2>
        <div className="blog-grid">
          {others.map((o) => (
            <Link key={o.slug} href={`/blog/${o.slug}`} className="blog-card">
              <div className="blog-card-emoji">{o.emoji}</div>
              <span className="blog-card-cat">{o.category}</span>
              <h3>{o.title}</h3>
              <span className="blog-card-meta">{o.readMinutes} min</span>
            </Link>
          ))}
        </div>
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
