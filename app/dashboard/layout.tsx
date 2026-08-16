import { redirect } from "next/navigation";
import Link from "next/link";
import { getMyBusiness, hasModule } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin-guard";
import { Icon } from "@/components/icons";
import { KadoMark } from "@/components/Logo";
import { Onboarding } from "./Onboarding";

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
        <div className="dash-brand"><KadoMark size={22} /> Kado</div>
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
          {admin ? (
            <div className="dash-card onboarding">
              <h2>Espace administrateur 🔑</h2>
              <p className="onboarding-lead">
                Tu es connecté en tant qu'<b>administrateur Kado</b>. Ce compte ne
                gère aucun établissement commerçant — rends-toi dans l'espace
                admin pour gérer les comptes.
              </p>
              <Link
                href="/admin"
                className="btn"
                style={{ textDecoration: "none", display: "block", textAlign: "center" }}
              >
                Accéder à l'espace admin →
              </Link>
            </div>
          ) : (
            <Onboarding />
          )}
        </main>
      ) : (
        <>
          <nav className="dash-nav">
            <Link href="/dashboard">
              <Icon name="dashboard" /> Vue d'ensemble
            </Link>
            {hasModule(business, "roue") && (
              <Link href="/dashboard/wheel">
                <Icon name="wheel" /> Mon jeu
              </Link>
            )}
            {hasModule(business, "fidelite") && !hasModule(business, "roue") && (
              <Link href="/dashboard/wheel">
                <Icon name="wheel" /> Fidélité
              </Link>
            )}
            {hasModule(business, "roue") && (
              <Link href="/dashboard/qr">
                <Icon name="qr" /> QR code
              </Link>
            )}
            <Link href="/dashboard/validate">
              <Icon name="redeem" /> Valider en caisse
            </Link>
            {hasModule(business, "roue") && (
              <Link href="/dashboard/leads">
                <Icon name="mail" /> Clients
              </Link>
            )}
            <Link href="/dashboard/billing">
              <Icon name="card" /> Abonnement
            </Link>
            {hasModule(business, "roue") && (
              <>
                <Link href={`/${business.slug}?preview=1`} target="_blank">
                  <Icon name="test" /> Tester mon jeu
                </Link>
                <Link href={`/${business.slug}`} target="_blank">
                  <Icon name="external" /> Voir ma page
                </Link>
              </>
            )}
            {hasModule(business, "fidelite") && (
              <Link href={`/${business.slug}/fidelite`} target="_blank">
                <Icon name="loyalty" /> Carte fidélité
              </Link>
            )}
          </nav>
          <main className="dash-main">{children}</main>
        </>
      )}
    </div>
  );
}
