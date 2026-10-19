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
import DashboardNav from "./DashboardNav";

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
          <DashboardNav
            showRoue={hasModule(business, "roue")}
            showFidelite={hasModule(business, "fidelite")}
            clickCollect={clickCollect}
            slug={business.slug}
          />
          <main className="dash-main">{children}</main>
          <SupportButton business={business?.name} />
        </>
      )}
    </div>
  );
}
