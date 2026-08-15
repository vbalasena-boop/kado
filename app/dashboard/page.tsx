import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const { business } = await getMyBusiness();
  if (!business) return null; // le layout affiche déjà le message

  const admin = getAdminClient();
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data: plays } = await admin
    .from("plays")
    .select("play_type, prize_label, created_at, redeemed_at")
    .eq("business_id", business.id);

  const rows = plays ?? [];
  const total = rows.length;
  const insta = rows.filter((r) => r.play_type === "instagram").length;
  const review = rows.filter((r) => r.play_type === "review").length;
  const last30 = rows.filter((r) => r.created_at >= since).length;
  const won = rows.filter(
    (r) => r.prize_label && !r.prize_label.toLowerCase().includes("rien")
  ).length;
  const redeemed = rows.filter((r) => (r as any).redeemed_at).length;
  const redemptionRate = won > 0 ? Math.round((redeemed / won) * 100) : 0;

  const { count: leadsCount } = await admin
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("business_id", business.id);

  const dist = new Map<string, number>();
  for (const r of rows) {
    if (!r.prize_label) continue;
    dist.set(r.prize_label, (dist.get(r.prize_label) ?? 0) + 1);
  }
  const distribution = [...dist.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <>
      <h1 className="dash-h1">Vue d'ensemble</h1>
      <p className="dash-sub">
        Activité de <b>{business.name}</b> · statut :{" "}
        <span className={`pill ${business.status}`}>
          {business.status === "active" ? "Actif" : "Suspendu"}
        </span>
      </p>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-icon">
            <Icon name="trending" size={22} />
          </div>
          <div>
            <div className="stat-n">{total}</div>
            <div className="stat-l">Tours joués (total)</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icon">
            <Icon name="event" size={22} />
          </div>
          <div>
            <div className="stat-n">{last30}</div>
            <div className="stat-l">30 derniers jours</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icon">
            <Icon name="share" size={22} />
          </div>
          <div>
            <div className="stat-n">{insta}</div>
            <div className="stat-l">via Instagram</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icon">
            <Icon name="star" size={22} />
          </div>
          <div>
            <div className="stat-n">{review}</div>
            <div className="stat-l">via Avis Google</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icon">
            <Icon name="redeem" size={22} />
          </div>
          <div>
            <div className="stat-n">{won}</div>
            <div className="stat-l">Cadeaux gagnés</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icon">
            <Icon name="check" size={22} />
          </div>
          <div>
            <div className="stat-n">{redeemed}</div>
            <div className="stat-l">Récupérés en caisse · {redemptionRate}%</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icon">
            <Icon name="mail" size={22} />
          </div>
          <div>
            <div className="stat-n">{leadsCount ?? 0}</div>
            <div className="stat-l">E-mails capturés</div>
          </div>
        </div>
      </div>

      <div className="dash-card">
        <h2>Cadeaux distribués</h2>
        {distribution.length === 0 ? (
          <p className="muted">Aucun tour joué pour l'instant.</p>
        ) : (
          <ul className="dist">
            {distribution.map(([label, n]) => (
              <li key={label}>
                <span>{label}</span>
                <span className="dist-bar">
                  <span
                    className="dist-fill"
                    style={{
                      width: `${Math.round((n / total) * 100)}%`,
                    }}
                  />
                </span>
                <b>{n}</b>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
