import Link from "next/link";

export const metadata = {
  title: "Kado — Informations légales",
};

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="legal">
      <header className="legal-top">
        <Link href="/" className="legal-brand">
          🎡 Kado
        </Link>
        <nav className="legal-nav">
          <Link href="/legal/mentions">Mentions légales</Link>
          <Link href="/legal/confidentialite">Confidentialité</Link>
          <Link href="/legal/cgu">CGU</Link>
          <Link href="/legal/reglement">Règlement du jeu</Link>
        </nav>
      </header>
      <main className="legal-main">{children}</main>
    </div>
  );
}
