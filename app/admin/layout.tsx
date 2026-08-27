import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin-guard";
import AdminNav from "./AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (!isAdminEmail(user.email)) {
    return (
      <div className="dash">
        <header className="dash-top">
          <div className="dash-brand">🎡 Kado · Admin</div>
        </header>
        <main className="dash-main">
          <div className="dash-card">
            <h2>Accès refusé</h2>
            <p>
              Le compte <b>{user.email}</b> n'est pas administrateur. Ajoutez cet
              e-mail à la variable <code>ADMIN_EMAILS</code> pour y accéder.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="dash">
      <header className="dash-top">
        <div className="dash-brand">🎡 Kado · Admin</div>
        <div className="dash-user">
          <span>{user.email}</span>
          <form action="/auth/signout" method="post">
            <button className="dash-signout" type="submit">
              Déconnexion
            </button>
          </form>
        </div>
      </header>
      <AdminNav />
      <main className="dash-main">{children}</main>
    </div>
  );
}
