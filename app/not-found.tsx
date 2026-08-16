import Link from "next/link";

export default function NotFound() {
  return (
    <main className="landing">
      <div className="landing-card">
        <div className="landing-logo">🔍</div>
        <h1>Page introuvable</h1>
        <p>
          Cette page n'existe pas ou a été déplacée. Vérifiez le lien, ou
          revenez à l'accueil.
        </p>
        <Link href="/" className="v-btn primary" style={{ marginTop: 18 }}>
          Retour à l'accueil
        </Link>
      </div>
    </main>
  );
}
