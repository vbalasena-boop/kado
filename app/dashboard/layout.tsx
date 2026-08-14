import { redirect } from "next/navigation";
import Link from "next/link";
import { getMyBusiness } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin-guard";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, business } = await getMyBusiness();
  if (!user) redirect("/login");
  const admin = isAdminEmail(user.email);

  return (
    <div className="dash">
      <header className="dash-top">
        <div className="dash-brand">🎡 Kado</div>
        <div className="dash-user">
          {admin && (
            <Link href="/admin" className="dash-signout">
              <Icon name="key" size={16} /> Espace admin
            </Link>
          )}
          <span>{user.email}</span>
          <form action="/auth/signout" method="post">
            <button className="dash-signout" type="submit">
              <Icon name="logout" size={16} /> Déconnexion
            </button>
          </form>
        </div>
      </header>

      {business && business.status === "suspended" && (
        <div className="dash-banner">
          ⚠️ Votre compte est actuellement <b>suspendu</b>. Votre page de jeu
          est désactivée. Contactez votre administrateur.
        </div>
      )}

      {!business ? (
        <main className="dash-main">
          <div className="dash-card">
            <h2>Aucun établissement lié à ce compte</h2>
            <p>
              Votre compte est bien connecté, mais aucun établissement ne lui est
              rattaché. L'administrateur doit créer votre établissement et le
              lier à cette adresse e-mail (Epic 3).
            </p>
            <p className="muted">
              Pour tester dès maintenant, liez la démo à votre compte via SQL —
              voir le README.
            </p>
          </div>
        </main>
      ) : (
        <>
          <nav className="dash-nav">
            <Link href="/dashboard">
              <Icon name="dashboard" /> Vue d'ensemble
            </Link>
            <Link href="/dashboard/wheel">
              <Icon name="wheel" /> Ma roue
            </Link>
            <Link href="/dashboard/qr">
              <Icon name="qr" /> QR code
            </Link>
            <Link href={`/${business.slug}?preview=1`} target="_blank">
              <Icon name="test" /> Tester ma roue
            </Link>
            <Link href={`/${business.slug}`} target="_blank">
              <Icon name="external" /> Voir ma page
            </Link>
          </nav>
          <main className="dash-main">{children}</main>
        </>
      )}
    </div>
  );
}
