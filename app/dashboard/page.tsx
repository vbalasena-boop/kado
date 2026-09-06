import Link from "next/link";
import { getMyBusiness, hasModule } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { Icon } from "@/components/icons";
import {
  computePlayStats,
  computeLoyaltyStats,
  playStatsFromRpc,
  loyaltyStatsFromRpc,
  loyaltyRewardRate,
} from "@/lib/dashboard-stats";
import { avisMigrationNoticeNeeded } from "@/lib/wheel";
import { onboardingSteps, onboardingProgress } from "@/lib/onboarding";
import { funnelInsight } from "@/lib/funnel-insight";
import { summarizeSegments, segmentsFromRpc } from "@/lib/segments";
import {
  parseTrendRpc,
  fillDailySeries,
  fillMonthlySeries,
  aggregateByMonth,
  monthToDateComparison,
} from "@/lib/trend";
import AvisMigrationBanner from "./AvisMigrationBanner";
import ReferralPanel from "@/components/ReferralPanel";
import TrendChart from "@/components/TrendChart";

export const dynamic = "force-dynamic";

export default async function DashboardHome({
  searchParams,
}: {
  searchParams?: { parcours?: string };
}) {
  const { business } = await getMyBusiness();
  if (!business) return null;

  // Entonnoir : 30 derniers jours par défaut (plus actionnable), « tout
  // l'historique » via ?parcours=tout.
  const funnelAll = searchParams?.parcours === "tout";

  const admin = getAdminClient();

  // Identifiant lisible de l'établissement (0072) — lu tolérant : à indiquer au
  // support pour être retrouvé vite. Absent tant que la migration n'est pas là.
  let bizRef: string | null = null;
  try {
    const { data } = await admin
      .from("businesses")
      .select("ref")
      .eq("id", business.id)
      .maybeSingle();
    bizRef = (data as { ref?: string | null } | null)?.ref ?? null;
  } catch {
    bizRef = null;
  }
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  // Seuil « à réveiller » : dernier tampon plus ancien que 60 jours.
  const SEGMENT_DORMANT_DAYS = 60;
  const segCutoffIso = new Date(
    Date.now() - SEGMENT_DORMANT_DAYS * 864e5
  ).toISOString();

  const showRoue = hasModule(business, "roue");
  const showFid = hasModule(business, "fidelite");

  // Tendance : on remonte au 1er du mois PRÉCÉDENT pour pouvoir comparer les
  // deux mois à période égale ; la série affichée reste sur 30 jours.
  const todayIso = new Date().toISOString().slice(0, 10);
  const trendStart = new Date(todayIso.slice(0, 7) + "-01T00:00:00Z");
  trendStart.setUTCMonth(trendStart.getUTCMonth() - 1);

  // Tendance fidélité : 12 mois glissants (graphique mensuel) — on part du 1er
  // du mois, 11 mois en arrière, pour un axe régulier.
  const signupsStart = new Date(todayIso.slice(0, 7) + "-01T00:00:00Z");
  signupsStart.setUTCMonth(signupsStart.getUTCMonth() - 11);

  // Chemin normal : agrégats calculés côté SQL (RPC 0051), en parallèle. Un
  // REPLI JS (fonctions pures, chiffres identiques) prend le relais si la
  // migration 0051 n'est pas encore appliquée (rpc en erreur).
  const [
    cfgRes,
    playRpc,
    leadsRes,
    loyRpc,
    trendRpc,
    signupsRpc,
    pendingRes,
    segRpc,
    reviewClicksRes,
    scansRes,
    scans30Res,
    reviewClicks30Res,
    insta30Res,
  ] = await Promise.all([
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
    showFid
      ? admin.rpc("dashboard_loyalty_signups_trend", {
          biz: business.id,
          since: signupsStart.toISOString(),
        })
      : Promise.resolve({ data: null, error: null }),
    // Récompenses en attente (comptage indexé) → taux de remise fiable, sans
    // dépendre de la forme de la RPC d'agrégats.
    showFid
      ? admin
          .from("loyalty_cards")
          .select("*", { count: "exact", head: true })
          .eq("business_id", business.id)
          .eq("reward_ready", true)
      : Promise.resolve({ count: null, error: null }),
    // Segmentation des clients fidélité (agrégat SQL, repli JS si RPC absente).
    showFid
      ? admin.rpc("dashboard_loyalty_segments", {
          biz: business.id,
          cutoff: segCutoffIso,
        })
      : Promise.resolve({ data: null, error: null }),
    // Clics sur le lien « Laisser un avis Google » (comptage indexé, table 0082).
    // Lecture tolérante : si la table n'est pas déployée, on retombe sur 0 sans
    // faire échouer la page (voir `reviewClicks` plus bas).
    showRoue
      ? admin
          .from("review_clicks")
          .select("*", { count: "exact", head: true })
          .eq("business_id", business.id)
      : Promise.resolve({ count: null, error: null }),
    // Scans de la page de jeu (ouverture du QR, table 0078). 1re marche de
    // l'entonnoir. Lecture tolérante : table absente / erreur → 0.
    showRoue
      ? admin
          .from("scans")
          .select("*", { count: "exact", head: true })
          .eq("business_id", business.id)
      : Promise.resolve({ count: null, error: null }),
    // Versions 30 jours pour l'entonnoir (période par défaut). Comptages bornés
    // à `since`, dans le MÊME lot pour éviter un aller-retour DB en plus. Inutile
    // quand on affiche « tout l'historique ». Instagram 30 j = tours récents.
    showRoue && !funnelAll
      ? admin
          .from("scans")
          .select("*", { count: "exact", head: true })
          .eq("business_id", business.id)
          .gte("created_at", since)
      : Promise.resolve({ count: null, error: null }),
    showRoue && !funnelAll
      ? admin
          .from("review_clicks")
          .select("*", { count: "exact", head: true })
          .eq("business_id", business.id)
          .gte("created_at", since)
      : Promise.resolve({ count: null, error: null }),
    showRoue && !funnelAll
      ? admin
          .from("plays")
          .select("*", { count: "exact", head: true })
          .eq("business_id", business.id)
          .eq("play_type", "instagram")
          .gte("created_at", since)
      : Promise.resolve({ count: null, error: null }),
  ]);

  const cfg = cfgRes.data;
  const leadsCount = leadsRes.count;
  // Clics sur le lien avis Google (table 0082). Remplace l'ancien compteur figé
  // basé sur `play_type = 'review'` (les tours avis n'existent plus depuis
  // l'epic 9). Tolérant : table absente / erreur → 0.
  const reviewClicks = reviewClicksRes.error ? 0 : reviewClicksRes.count ?? 0;
  // Scans du QR (table 0078). Tolérant : table absente / erreur → 0. Comme les
  // scans ne sont comptés que depuis leur déploiement, ils peuvent être <
  // aux tours joués (historiques) pendant quelques semaines : l'entonnoir en
  // tient compte (barres bornées, taux scan→jeu masqué tant qu'il dépasse 100%).
  const scans = scansRes.error ? 0 : scansRes.count ?? 0;

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

  // Entonnoir sur 30 jours (défaut) : comptages bornés à `since`, déjà récupérés
  // dans le lot ci-dessus (tolérants : table absente / erreur → 0). Les tours
  // joués 30 j réutilisent `last30` (aucune requête dédiée).
  const scans30 = scans30Res.error ? 0 : scans30Res.count ?? 0;
  const reviewClicks30 = reviewClicks30Res.error ? 0 : reviewClicks30Res.count ?? 0;
  const insta30 = insta30Res.error ? 0 : insta30Res.count ?? 0;
  // Valeurs affichées dans l'entonnoir selon la période choisie.
  const fScans = funnelAll ? scans : scans30;
  const fPlays = funnelAll ? total : last30;
  const fInsta = funnelAll ? insta : insta30;
  const fReviewClicks = funnelAll ? reviewClicks : reviewClicks30;

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

  // Taux de remise des récompenses : remises = débloquées − en attente.
  const pendingRewards = pendingRes.error ? 0 : pendingRes.count ?? 0;
  const reward = loyaltyRewardRate(fidStats.rewards, pendingRewards);

  // Segmentation clients (RPC 0063, repli JS si absente).
  let segments = showFid && !segRpc.error ? segmentsFromRpc(segRpc.data) : null;
  if (showFid && !segments) {
    const { data: segRows } = await admin
      .from("loyalty_cards")
      .select("stamps, rewards_earned, last_stamp_at")
      .eq("business_id", business.id);
    segments = summarizeSegments(segRows ?? [], Date.parse(segCutoffIso));
  }

  // Tendance des tours joués : série 30 jours + comparaison mensuelle. Rendu
  // uniquement si la RPC 0059 répond (sinon on masque proprement le bloc).
  const trendCounts =
    showRoue && !trendRpc.error ? parseTrendRpc(trendRpc.data) : null;
  const trendSeries = trendCounts ? fillDailySeries(trendCounts, todayIso, 30) : null;
  const trendCompare = trendCounts
    ? monthToDateComparison(trendCounts, todayIso)
    : null;

  // Tendance fidélité : inscriptions par mois (12 mois) + comparaison mensuelle
  // à période égale. Masqué proprement si la RPC 0060 n'est pas appliquée.
  const signupsCounts =
    showFid && !signupsRpc.error ? parseTrendRpc(signupsRpc.data) : null;
  const signupsSeries = signupsCounts
    ? fillMonthlySeries(aggregateByMonth(signupsCounts), todayIso.slice(0, 7), 12)
    : null;
  const signupsCompare = signupsCounts
    ? monthToDateComparison(signupsCounts, todayIso)
    : null;
  const frMonth = (key: string) =>
    new Date(key + "-01T00:00:00Z").toLocaleDateString("fr-FR", {
      month: "short",
      year: "2-digit",
    });

  // --- Premiers pas (checklist de 1re configuration, roadmap G3) ---
  // Chaque étape a un VRAI signal de complétion. « Affiche déployée » est
  // déduite d'un comportement : si des clients scannent ou jouent déjà, l'affiche
  // est forcément posée. L'étape fidélité n'apparaît que si la formule l'inclut.
  const hasLinks = !!(cfg?.instagram_url || cfg?.review_url);
  const hasPlays = total > 0;
  const steps = onboardingSteps({
    hasLogo: !!business.logo_url,
    hasLinks,
    loyaltyAvailable: showFid,
    loyaltyActive: !!(cfg as any)?.loyalty_enabled,
    afficheDeployed: hasPlays || scans > 0,
    hasPlays,
    slug: business.slug,
  });
  const { done: doneCount, allDone } = onboardingProgress(steps);
  const showChecklist = !allDone;

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
        {bizRef && (
          <>
            <span className="admin-ref">{bizRef}</span>{" "}
          </>
        )}
        Activité de <b>{business.name}</b> · statut :{" "}
        <span className={`pill ${business.status}`}>
          {business.status === "active" ? "Actif" : "Suspendu"}
        </span>
        {" · formule : "}
        <span className="pill active">
          {PLAN_LABEL[business.plan] || business.plan}
        </span>
      </p>
      {bizRef && (
        <p className="muted" style={{ marginTop: -6, fontSize: 12.5 }}>
          🔖 Votre identifiant : <b>{bizRef}</b> — indiquez-le à l'assistance
          pour être retrouvé plus vite.
        </p>
      )}

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
              <b>{reviewClicks}</b>
              <span>clics vers vos avis Google</span>
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
              <li key={s.key} className={s.done ? "done" : ""}>
                <span className="setup-check">{s.done ? "✓" : ""}</span>
                <div className="setup-txt">
                  <b>{s.title}</b>
                  <small>{s.desc}</small>
                </div>
                <Link
                  href={s.href}
                  className="setup-cta"
                  {...(s.external ? { target: "_blank" } : {})}
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
                <div className="stat-n">{reviewClicks}</div>
                <div className="stat-l">Clics avis Google</div>
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

          <div className="dash-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <b>Exporter vos données</b>
              <div className="muted" style={{ fontSize: 13 }}>
                Le détail de chaque tour (date, action, lot, résultat, code,
                récupération) au format CSV — à ouvrir dans Excel.
              </div>
            </div>
            <a
              className="btn-secondary"
              href="/api/dashboard/stats/export"
              style={{ whiteSpace: "nowrap", textDecoration: "none" }}
            >
              <Icon name="download" size={16} /> Exporter en CSV
            </a>
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

          {/* Entonnoir « parcours client » : scan du QR → tour joué → dont via
              Instagram → clics avis Google. Barres proportionnelles au plus grand
              palier (scans ou tours) et bornées à 100 %. Les scans n'étant comptés
              que depuis leur déploiement, le taux « scan → jeu » n'est affiché que
              lorsqu'il est cohérent (tours ≤ scans) ; les % Instagram/Avis restent
              rapportés aux tours joués. */}
          {(total > 0 || scans > 0) && (() => {
            // Valeurs de la période choisie (30 j par défaut, ou tout l'historique).
            const base = Math.max(fScans, fPlays, 1);
            const steps = [
              { key: "scan", emoji: "📱", label: "Scans du QR", n: fScans, cls: "s0" },
              { key: "plays", emoji: "🎡", label: "Tours joués", n: fPlays, cls: "s1" },
              { key: "insta", emoji: "📸", label: "dont via Instagram", n: fInsta, cls: "s2" },
              { key: "review", emoji: "⭐", label: "Clics vers vos avis Google", n: fReviewClicks, cls: "s3" },
            ];
            // Reco actionnable : où le parcours « fuit » et quel levier conforme,
            // calculée sur la période affichée pour rester pertinente.
            const insight = funnelInsight({
              scans: fScans,
              plays: fPlays,
              insta: fInsta,
              reviewClicks: fReviewClicks,
              reviewLinkReady: !!cfg?.review_url && cfg?.review_enabled !== false,
              instagramReady: !!cfg?.instagram_url,
            });
            return (
              <div className="dash-card">
                <div className="funnel-head">
                  <h2>🔎 Le parcours de vos clients</h2>
                  <div className="funnel-period" role="group" aria-label="Période">
                    <a
                      href="/dashboard"
                      className={!funnelAll ? "is-active" : ""}
                      aria-current={!funnelAll ? "true" : undefined}
                    >
                      30 jours
                    </a>
                    <a
                      href="/dashboard?parcours=tout"
                      className={funnelAll ? "is-active" : ""}
                      aria-current={funnelAll ? "true" : undefined}
                    >
                      Tout l'historique
                    </a>
                  </div>
                </div>
                <p className="muted" style={{ marginBottom: 14 }}>
                  Du scan du QR au clic vers vos avis Google — pour voir où vos
                  clients s'arrêtent{funnelAll ? "" : " (30 derniers jours)"}.
                </p>
                <ul className="funnel">
                  {steps.map((step) => {
                    // Taux affiché : « scan → jeu » pour les tours (masqué tant
                    // qu'il dépasse 100 %), part des tours pour Instagram/Avis.
                    let pct: number | null = null;
                    if (step.key === "plays" && fScans > 0 && step.n <= fScans) {
                      pct = Math.round((step.n / fScans) * 100);
                    } else if (
                      (step.key === "insta" || step.key === "review") &&
                      fPlays > 0
                    ) {
                      pct = Math.round((step.n / fPlays) * 100);
                    }
                    const width = Math.min(Math.round((step.n / base) * 100), 100);
                    return (
                      <li key={step.key}>
                        <span className="funnel-label">
                          <span aria-hidden="true">{step.emoji}</span> {step.label}
                        </span>
                        <span className="funnel-bar">
                          <span
                            className={`funnel-fill ${step.cls}`}
                            style={{ width: `${width}%` }}
                          />
                        </span>
                        <b className="funnel-n">
                          {step.n}
                          {pct !== null && (
                            <small className="funnel-pct"> · {pct}%</small>
                          )}
                        </b>
                      </li>
                    );
                  })}
                </ul>
                <p className={`funnel-insight ${insight.tone}`}>{insight.message}</p>
                <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>
                  {fScans === 0 && !funnelAll
                    ? "Aucun scan sur 30 jours — le suivi démarre dès la prochaine visite de la page de jeu."
                    : "« Scan → jeu » se fiabilise avec le temps (les scans ne sont comptés que depuis leur mise en place). Le lien avis est facultatif et non récompensé."}
                </p>
              </div>
            );
          })()}

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
          {segments && segments.total > 0 && (
            <div className="dash-card">
              <h2>Mes clients fidélité</h2>
              <div className="seg-grid">
                <div className="seg seg-loyal">
                  <div className="seg-n">{segments.loyal}</div>
                  <div className="seg-l">Fidèles</div>
                  <div className="seg-d">ont déjà gagné une récompense</div>
                </div>
                <div className="seg seg-active">
                  <div className="seg-n">{segments.active}</div>
                  <div className="seg-l">En cours</div>
                  <div className="seg-d">carte entamée, pas encore de récompense</div>
                </div>
                <div className="seg seg-new">
                  <div className="seg-n">{segments.new}</div>
                  <div className="seg-l">Nouveaux</div>
                  <div className="seg-d">inscrits, pas encore de tampon</div>
                </div>
                <div className="seg seg-dormant">
                  <div className="seg-n">{segments.dormant}</div>
                  <div className="seg-l">À réveiller</div>
                  <div className="seg-d">plus de 60 jours sans visite</div>
                </div>
              </div>
              {segments.dormant > 0 && (
                <p className="muted seg-hint">
                  💡 {segments.dormant} client{segments.dormant > 1 ? "s" : ""}{" "}
                  {segments.dormant > 1 ? "sont" : "est"} à réveiller. Activez la{" "}
                  <Link href="/dashboard/wheel">relance « client inactif »</Link>{" "}
                  pour les rappeler automatiquement.
                </p>
              )}
            </div>
          )}
          {fidStats.rewards > 0 && (
            <div className="dash-card">
              <h2>Récompenses remises</h2>
              <div className="rate-head">
                <span className="rate-pct">{reward.rate}%</span>
                <span className="muted">
                  {reward.redeemed} récompense{reward.redeemed > 1 ? "s" : ""}{" "}
                  remise{reward.redeemed > 1 ? "s" : ""} en caisse sur{" "}
                  {fidStats.rewards} débloquée{fidStats.rewards > 1 ? "s" : ""}
                  {pendingRewards > 0 && (
                    <> · {pendingRewards} en attente</>
                  )}
                </span>
              </div>
              <div className="rate-bar" aria-hidden="true">
                <span
                  className="rate-fill"
                  style={{ width: `${reward.rate}%` }}
                />
              </div>
              <p className="muted rate-note">
                Part des récompenses gagnées que vos clients sont réellement
                venus chercher — un bon indicateur du retour en boutique.
              </p>
            </div>
          )}
          {signupsSeries && (
            <div className="dash-card">
              <h2>Nouveaux clients fidélité par mois</h2>
              {signupsCompare && (
                <div className="trend-compare">
                  <b>{signupsCompare.current}</b>
                  <span className="muted">
                    inscriptions ce mois-ci (vs {signupsCompare.previous} le
                    mois dernier à la même date)
                  </span>
                  {signupsCompare.deltaPct !== null && (
                    <span
                      className={`trend-delta ${
                        signupsCompare.deltaPct > 0
                          ? "up"
                          : signupsCompare.deltaPct < 0
                          ? "down"
                          : "flat"
                      }`}
                    >
                      {signupsCompare.deltaPct > 0 ? "▲ +" : signupsCompare.deltaPct < 0 ? "▼ " : ""}
                      {signupsCompare.deltaPct}%
                    </span>
                  )}
                </div>
              )}
              <TrendChart
                series={signupsSeries}
                label="nouveaux clients"
                formatDate={frMonth}
              />
            </div>
          )}
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
