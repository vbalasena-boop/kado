import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getMyBusiness,
  getMyBusinesses,
  hasModule,
  hasClickCollect,
} from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin-guard";
import { Icon } from "@/components/icons";
import { KadoMark } from "@/components/Logo";
import { BusinessSwitcher } from "@/components/BusinessSwitcher";
import SupportButton from "@/components/SupportButton";
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
  // Liste des établissements du commerçant (pour le sélecteur multi-établissements)
  const { businesses } = await getMyBusinesses();

  // Click & collect : essai + plans Comptoir/Complet inclus, sinon option
  // `click_collect` (lue de façon tolérante). Même règle que le garde serveur
  // (hasClickCollect / requireClickCollect) → UI et API restent alignées.
  let clickCollect = false;
  if (business) {
    let addon = false;
    try {
      const { data } = await getAdminClient()
        .from("businesses")
        .select("click_collect")
        .eq("id", business.id)
        .maybeSingle();
      addon = !!(data as any)?.click_collect;
    } catch {
      addon = false;
    }
    clickCollect = hasClickCollect({ ...business, click_collect: addon });
  }

  return (
    <div className="dash">
      <header className="dash-top">
        <div className="dash-brand"><KadoMark size={22} /> Kado</div>
        <div className="dash-user">
          {business && (
            <BusinessSwitcher
              businesses={businesses.map((b) => ({ id: b.id, name: b.name }))}
              activeId={business.id}
            />
          )}
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
          {/* Menu mobile : sous 640px, la nav (jusqu'à 11 liens) s'empilait sur
              5-6 rangées. Hamburger pur CSS (case à cocher) — pas de JS ; comme
              chaque lien recharge la page (Server Component), le menu se referme
              tout seul à la navigation. */}
          <input
            type="checkbox"
            id="dash-nav-toggle"
            className="dash-nav-toggle"
          />
          <label htmlFor="dash-nav-toggle" className="dash-nav-burger">
            ☰ Menu
          </label>
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
            <Link href="/dashboard/campaigns">
              <Icon name="share" /> Campagnes
            </Link>
            {clickCollect && (
              <Link href="/dashboard/orders">
                <Icon name="cart" /> Commandes
              </Link>
            )}
            <Link href="/dashboard/billing">
              <Icon name="card" /> Abonnement
            </Link>
            <Link href="/dashboard/aide">
              <Icon name="help" /> Aide
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
          <SupportButton business={business?.name} />
        </>
      )}
    </div>
  );
}
