import Link from "next/link";
import { getMyBusiness, hasModule } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { Icon } from "@/components/icons";
import { labelIsLosing } from "@/lib/draw";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const { business } = await getMyBusiness();
  if (!business) return null;

  const admin = getAdminClient();
  const since = new Date(Date.now() - 30 * 864e5).toISOString();

  const showRoue = hasModule(business, "roue");
  const showFid = hasModule(business, "fidelite");

  const [{ data: plays }, { data: cfg }] = await Promise.all([
    admin
      .from("plays")
      .select("play_type, prize_label, created_at, redeemed_at")
      .eq("business_id", business.id),
    admin
      .from("wheel_configs")
      .select("instagram_url, review_url, loyalty_enabled")
      .eq("business_id", business.id)
      .maybeSingle(),
  ]);

  const rows = plays ?? [];
  const total = rows.length;
  const insta = rows.filter((r) => r.play_type === "instagram").length;
  const review = rows.filter((r) => r.play_type === "review").length;
  const last30 = rows.filter((r) => r.created_at >= since).length;
  const won = rows.filter((r) => !labelIsLosing(r.prize_label)).length;
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

  // Stats fidélité
  let fidStats = { cards: 0, stamps: 0, rewards: 0 };
  if (showFid) {
    const { data: fidRows } = await admin
      .from("loyalty_cards")
      .select("stamps, rewards_earned")
      .eq("business_id", business.id);
    if (fidRows) {
      fidStats.cards = fidRows.length;
      fidStats.stamps = fidRows.reduce((s, r) => s + (r.stamps || 0), 0);
      fidStats.rewards = fidRows.reduce(
        (s, r) => s + (r.rewards_earned || 0),
        0
      );
    }
  }

  // --- Premiers pas (checklist d'installation) ---
  const hasLinks = !!(cfg?.instagram_url || cfg?.review_url);
  const hasPlays = total > 0;
  const steps = [
    {
      done: true,
      title: "Votre espace est créé",
      desc: "Votre roue et vos cadeaux sont déjà pré-remplis.",
      href: "/dashboard/wheel",
      cta: "Personnaliser ma roue",
    },
    {
      done: hasLinks,
      title: "Ajoutez vos liens Instagram & Google",
      desc: "Indispensable pour rediriger vos clients vers votre profil et vos avis.",
      href: "/dashboard/wheel",
      cta: hasLinks ? "Modifier mes liens" : "Ajouter mes liens",
    },
    {
      done: false,
      title: "Imprimez votre affiche avec le QR code",
      desc: "À poser sur vos tables, votre comptoir ou votre vitrine.",
      href: "/dashboard/qr",
      cta: "Voir mon affiche",
    },
    {
      done: hasPlays,
      title: "Recevez votre premier tour de roue",
      desc: hasPlays
        ? "Bravo, vos clients jouent déjà !"
        : "Testez votre roue puis lancez-vous en boutique.",
      href: `/${business.slug}?preview=1`,
      cta: "Tester ma roue",
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const showChecklist = !(hasLinks && hasPlays);

  const PLAN_LABEL: Record<string, string> = {
    roue: "Jeux",
    fidelite: "Fidélité",
    complet: "Complet",
  };

  return (
    <>
      <h1 className="dash-h1">Vue d'ensemble</h1>
      <p className="dash-sub">
        Activité de <b>{business.name}</b> · statut :{" "}
        <span className={`pill ${business.status}`}>
          {business.status === "active" ? "Actif" : "Suspendu"}
        </span>
        {" · formule : "}
        <span className="pill active">
          {PLAN_LABEL[business.plan] || business.plan}
        </span>
      </p>

      {showRoue && total > 0 && (
        <div className="dash-card hero-recap">
          <h2>🚀 Ce que Kado vous a apporté</h2>
          <div className="hero-recap-grid">
            <div className="hero-recap-item">
              <b>{review}</b>
              <span>clients envoyés vers vos avis Google</span>
            </div>
            <div className="hero-recap-item">
              <b>{insta}</b>
              <span>clients envoyés vers votre Instagram</span>
            </div>
            <div className="hero-recap-item">
              <b>{leadsCount ?? 0}</b>
              <span>e-mails clients collectés</span>
            </div>
          </div>
        </div>
      )}

      {showChecklist && showRoue && (
        <div className="dash-card setup">
          <div className="setup-head">
            <h2>Premiers pas</h2>
            <span className="setup-progress">{doneCount}/{steps.length} fait</span>
          </div>
          <div className="setup-bar">
            <span style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
          <ol className="setup-steps">
            {steps.map((s) => (
              <li key={s.title} className={s.done ? "done" : ""}>
                <span className="setup-check">{s.done ? "✓" : ""}</span>
                <div className="setup-txt">
                  <b>{s.title}</b>
                  <small>{s.desc}</small>
                </div>
                <Link
                  href={s.href}
                  className="setup-cta"
                  {...(s.href.includes("preview") ? { target: "_blank" } : {})}
                >
                  {s.cta} →
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}

      {showRoue && (
        <>
          <h2 className="dash-section-title">Roue de la fortune</h2>
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
      )}

      {showFid && (
        <>
          <h2 className="dash-section-title">Carte de fidélité</h2>
          <div className="stat-grid">
            <div className="stat">
              <div className="stat-icon">
                <Icon name="mail" size={22} />
              </div>
              <div>
                <div className="stat-n">{fidStats.cards}</div>
                <div className="stat-l">Clients inscrits</div>
              </div>
            </div>
            <div className="stat">
              <div className="stat-icon">
                <Icon name="check" size={22} />
              </div>
              <div>
                <div className="stat-n">{fidStats.stamps}</div>
                <div className="stat-l">Tampons donnés</div>
              </div>
            </div>
            <div className="stat">
              <div className="stat-icon">
                <Icon name="redeem" size={22} />
              </div>
              <div>
                <div className="stat-n">{fidStats.rewards}</div>
                <div className="stat-l">Récompenses remises</div>
              </div>
            </div>
          </div>
          {!cfg?.loyalty_enabled && (
            <div className="dash-card">
              <p className="muted">
                La carte de fidélité n'est pas encore activée.{" "}
                <Link href="/dashboard/wheel">Activez-la dans « Mon jeu »</Link>.
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}
