import Link from "next/link";
import { getMyBusiness, hasModule } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { Icon } from "@/components/icons";
import {
  computePlayStats,
  computeLoyaltyStats,
  playStatsFromRpc,
  loyaltyStatsFromRpc,
} from "@/lib/dashboard-stats";
import { avisMigrationNoticeNeeded } from "@/lib/wheel";
import {
  parseTrendRpc,
  fillDailySeries,
  monthToDateComparison,
} from "@/lib/trend";
import AvisMigrationBanner from "./AvisMigrationBanner";
import ReferralPanel from "@/components/ReferralPanel";
import TrendChart from "@/components/TrendChart";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const { business } = await getMyBusiness();
  if (!business) return null;

  const admin = getAdminClient();
  const since = new Date(Date.now() - 30 * 864e5).toISOString();

  const showRoue = hasModule(business, "roue");
  const showFid = hasModule(business, "fidelite");

  // Tendance : on remonte au 1er du mois PRÉCÉDENT pour pouvoir comparer les
  // deux mois à période égale ; la série affichée reste sur 30 jours.
  const todayIso = new Date().toISOString().slice(0, 10);
  const trendStart = new Date(todayIso.slice(0, 7) + "-01T00:00:00Z");
  trendStart.setUTCMonth(trendStart.getUTCMonth() - 1);

  // Chemin normal : agrégats calculés côté SQL (RPC 0051), en parallèle. Un
  // REPLI JS (fonctions pures, chiffres identiques) prend le relais si la
  // migration 0051 n'est pas encore appliquée (rpc en erreur).
  const [cfgRes, playRpc, leadsRes, loyRpc, trendRpc] = await Promise.all([
    admin
      .from("wheel_configs")
      .select("instagram_url, review_url, review_enabled, loyalty_enabled")
      .eq("business_id", business.id)
      .maybeSingle(),
    admin.rpc("dashboard_play_stats", { biz: business.id, since }),
    admin
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business.id),
    showFid
      ? admin.rpc("dashboard_loyalty_stats", { biz: business.id })
      : Promise.resolve({ data: null, error: null }),
    showRoue
      ? admin.rpc("dashboard_play_trend", {
          biz: business.id,
          since: trendStart.toISOString(),
        })
      : Promise.resolve({ data: null, error: null }),
  ]);

  const cfg = cfgRes.data;
  const leadsCount = leadsRes.count;

  let stats = playRpc.error ? null : playStatsFromRpc(playRpc.data);
  if (!stats) {
    const { data: plays } = await admin
      .from("plays")
      .select("play_type, prize_label, created_at, redeemed_at")
      .eq("business_id", business.id);
    stats = computePlayStats(plays ?? [], since);
  }
  const { total, insta, review, last30, won, redeemed, redemptionRate, distribution } =
    stats;

  // Stats fidélité (même schéma RPC-puis-repli).
  let fidStats: { cards: number; stamps: number; rewards: number } = {
    cards: 0,
    stamps: 0,
    rewards: 0,
  };
  if (showFid) {
    const fromRpc = loyRpc.error ? null : loyaltyStatsFromRpc(loyRpc.data);
    if (fromRpc) {
      fidStats = fromRpc;
    } else {
      const { data: fidRows } = await admin
        .from("loyalty_cards")
        .select("stamps, rewards_earned")
        .eq("business_id", business.id);
      fidStats = computeLoyaltyStats(fidRows ?? []);
    }
  }

  // Tendance des tours joués : série 30 jours + comparaison mensuelle. Rendu
  // uniquement si la RPC 0059 répond (sinon on masque proprement le bloc).
  const trendCounts =
    showRoue && !trendRpc.error ? parseTrendRpc(trendRpc.data) : null;
  const trendSeries = trendCounts ? fillDailySeries(trendCounts, todayIso, 30) : null;
  const trendCompare = trendCounts
    ? monthToDateComparison(trendCounts, todayIso)
    : null;

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

  // Accueil dédié « Comptoir » : quelques chiffres de commandes.
  const isComptoir = (business as any).plan === "comptoir";
  let comptoirStats = { today: 0, pending: 0, ready: 0 };
  if (isComptoir) {
    try {
      const startDay = new Date();
      startDay.setHours(0, 0, 0, 0);
      const [{ count: t }, { count: p }, { count: r }] = await Promise.all([
        admin
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("business_id", business.id)
          .gte("created_at", startDay.toISOString()),
        admin
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("business_id", business.id)
          .eq("status", "new"),
        admin
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("business_id", business.id)
          .eq("status", "ready"),
      ]);
      comptoirStats = { today: t ?? 0, pending: p ?? 0, ready: r ?? 0 };
    } catch {
      /* table absente : zéros */
    }
  }

  const PLAN_LABEL: Record<string, string> = {
    roue: "Jeux",
    fidelite: "Fidélité",
    complet: "Complet",
    comptoir: "Comptoir",
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

      {/* Bannière migration avis : uniquement aux commerçants qui ont
          RÉELLEMENT utilisé l'avis pour débloquer un tour (review > 0), qui ont
          la roue, et dont l'avis était actif. Le gate `review > 0` cible la
          cohorte pré-changement et s'auto-éteint (plus aucun tour `review`
          n'est créé depuis 9.2) → les futurs commerçants ne le voient jamais. */}
      {showRoue && cfg && review > 0 && avisMigrationNoticeNeeded(cfg) && (
        <AvisMigrationBanner businessId={business.id} />
      )}

      <ReferralPanel businessId={business.id} slug={business.slug} />

      {isComptoir && (
        <>
          <div className="dash-card hero-recap">
            <h2>🎫 Votre suivi au comptoir</h2>
            <div className="hero-recap-grid">
              <div className="hero-recap-item">
                <b>{comptoirStats.today}</b>
                <span>commandes aujourd'hui</span>
              </div>
              <div className="hero-recap-item">
                <b>{comptoirStats.pending}</b>
                <span>en préparation</span>
              </div>
              <div className="hero-recap-item">
                <b>{comptoirStats.ready}</b>
                <span>prêtes à récupérer</span>
              </div>
            </div>
          </div>
          <div className="dash-card">
            <h2>🚀 Gérer votre comptoir</h2>
            <p className="muted" style={{ marginBottom: 14 }}>
              Créez vos commandes, affichez le QR de suivi à poser au comptoir et
              marquez les commandes « prêtes » — vos clients sont prévenus sur
              leur téléphone.
            </p>
            <Link
              href="/dashboard/orders"
              className="btn"
              style={{ textDecoration: "none", display: "inline-block" }}
            >
              Ouvrir mes commandes →
            </Link>
          </div>
        </>
      )}

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
        <div className="dash-card tuto-home">
          <div className="tuto-home-txt">
            <h2>▶️ Démarrer en 3 minutes</h2>
            <p>
              Regardez cette courte vidéo : elle vous montre, étape par étape,
              comment mettre Kado en place dans votre commerce.
            </p>
            <Link href="/dashboard/aide" className="setup-cta">
              Voir toute l'aide →
            </Link>
          </div>
          <video
            className="tuto-video"
            controls
            preload="metadata"
            playsInline
            poster="/tutoriel-kado-poster.jpg"
          >
            <source src="/tutoriel-kado.mp4" type="video/mp4" />
            Votre navigateur ne peut pas lire cette vidéo.
          </video>
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

          {trendSeries && (
            <div className="dash-card">
              <h2>Activité des 30 derniers jours</h2>
              {trendCompare && (
                <div className="trend-compare">
                  <b>{trendCompare.current}</b>
                  <span className="muted">
                    tours ce mois-ci (vs {trendCompare.previous} le mois
                    dernier à la même date)
                  </span>
                  {trendCompare.deltaPct !== null && (
                    <span
                      className={`trend-delta ${
                        trendCompare.deltaPct > 0
                          ? "up"
                          : trendCompare.deltaPct < 0
                          ? "down"
                          : "flat"
                      }`}
                    >
                      {trendCompare.deltaPct > 0 ? "▲ +" : trendCompare.deltaPct < 0 ? "▼ " : ""}
                      {trendCompare.deltaPct}%
                    </span>
                  )}
                </div>
              )}
              <TrendChart series={trendSeries} label="tours" />
            </div>
          )}

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
