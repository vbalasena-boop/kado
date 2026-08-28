import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";
import { runHealthChecks, type HealthCheck } from "@/lib/health";
import AdminClient, { AdminBusiness, AdminStats } from "./AdminClient";
import {
  computeAdminPlayStats,
  computeBusinessPlayCounts,
  adminPlayStatsFromRpc,
  businessPlayCountsFromRpc,
  type AdminPlayStats,
} from "@/lib/admin-stats";
import { summarizeMrr } from "@/lib/admin-mrr";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getAdminUser();
  if (!user) return null; // le layout gère l'accès refusé

  // Vérifications de santé lancées en parallèle des autres requêtes
  const healthPromise: Promise<HealthCheck[]> = runHealthChecks().catch(
    () => []
  );

  const admin = getAdminClient();
  const { data: businesses } = await admin
    .from("businesses")
    .select(
      "id, slug, name, status, subscription_status, subscription_ends_at, owner_user_id, created_at"
    )
    .order("created_at", { ascending: false });

  // Bornes temporelles (fuseau serveur), calculées AVANT les agrégats SQL.
  const startMonth = new Date();
  startMonth.setDate(1);
  startMonth.setHours(0, 0, 0, 0);
  const startDay = new Date();
  startDay.setHours(0, 0, 0, 0);
  const monthIso = startMonth.toISOString();
  const dayIso = startDay.toISOString();

  const leadsPromise = admin
    .from("leads")
    .select("*", { count: "exact", head: true });

  let playStats: AdminPlayStats | null = null;
  let counts: Map<string, number> | null = null;

  // Chemin RAPIDE : cache pré-calculé (0068) pour les agrégats non bornés +
  // comptes bornés (aujourd'hui / ce mois) en direct (servis par un index).
  const cacheRes = await admin
    .from("admin_stats_cache")
    .select("plays_total, insta, review, won, redeemed, refreshed_at")
    .eq("id", 1)
    .maybeSingle();
  if (!cacheRes.error && (cacheRes.data as any)?.refreshed_at) {
    const c = cacheRes.data as any;
    const [totalsRes, monthCnt, dayCnt] = await Promise.all([
      admin.from("business_play_totals").select("business_id, plays"),
      admin
        .from("plays")
        .select("*", { count: "exact", head: true })
        .gte("created_at", monthIso),
      admin
        .from("plays")
        .select("*", { count: "exact", head: true })
        .gte("created_at", dayIso),
    ]);
    if (!totalsRes.error) {
      playStats = {
        playsTotal: Number(c.plays_total) || 0,
        playsMonth: monthCnt.count ?? 0,
        playsToday: dayCnt.count ?? 0,
        insta: Number(c.insta) || 0,
        review: Number(c.review) || 0,
        won: Number(c.won) || 0,
        redeemed: Number(c.redeemed) || 0,
      };
      counts = new Map(
        ((totalsRes.data ?? []) as any[]).map((r) => [r.business_id, r.plays])
      );
    }
  }

  // Chemin de REPLI : agrégats délégués à SQL (RPC 0053), sinon scan JS unique
  // (cache 0068 pas encore appliqué ou pas encore rafraîchi). Chiffres égaux.
  if (!playStats || !counts) {
    const [statsRpc, countsRpc] = await Promise.all([
      admin.rpc("admin_play_stats", { month_start: monthIso, day_start: dayIso }),
      admin.rpc("admin_business_play_counts"),
    ]);
    playStats =
      playStats ?? (statsRpc.error ? null : adminPlayStatsFromRpc(statsRpc.data));
    counts =
      counts ?? (countsRpc.error ? null : businessPlayCountsFromRpc(countsRpc.data));
    if (!playStats || !counts) {
      const { data: playRows } = await admin
        .from("plays")
        .select("business_id, play_type, prize_label, redeemed_at, created_at");
      const rowsPlays = playRows ?? [];
      playStats = playStats ?? computeAdminPlayStats(rowsPlays, monthIso, dayIso);
      counts = counts ?? computeBusinessPlayCounts(rowsPlays);
    }
  }

  const leadsRes = await leadsPromise;
  const leadsCount = leadsRes.count;
  // Garantis non-null (cache, RPC OU repli les a renseignés).
  const playStatsResolved = playStats!;
  const playCounts = counts!;

  // e-mails des propriétaires
  const emailById = new Map<string, string>();
  try {
    const { data: usersList } = await admin.auth.admin.listUsers();
    for (const u of usersList?.users ?? [])
      if (u.email) emailById.set(u.id, u.email);
  } catch {
    /* ignore */
  }

  // Champs optionnels (téléphone, formule, installation) — tolérant si
  // les colonnes des migrations récentes manquent encore.
  type Extra = {
    id: string;
    phone: string | null;
    address: string | null;
    plan: string | null;
    setup_option: string | null;
    setup_paid_at: string | null;
    setup_done_at: string | null;
    admin_note: string | null;
    campaigns_addon: boolean | null;
    click_collect: boolean | null;
    order_tracking: boolean | null;
  };
  const extraById = new Map<string, Extra>();
  try {
    const { data: extras } = await admin
      .from("businesses")
      .select("id, phone, address, plan, setup_option, setup_paid_at, setup_done_at, admin_note, campaigns_addon, click_collect, order_tracking");
    for (const e of (extras ?? []) as Extra[]) extraById.set(e.id, e);
  } catch {
    /* colonnes absentes : valeurs par défaut */
  }

  // Identifiant lisible (0072) — lu à part, tolérant : si la colonne `ref`
  // n'existe pas encore, on n'altère pas les autres extras.
  const refById = new Map<string, string>();
  try {
    const { data: refs } = await admin.from("businesses").select("id, ref");
    for (const r of (refs ?? []) as { id: string; ref: string | null }[]) {
      if (r.ref) refById.set(r.id, r.ref);
    }
  } catch {
    /* colonne `ref` absente : aucun identifiant affiché */
  }

  // Établissements en DÉMO (0073) — exclus des statistiques. Lu à part, tolérant.
  const demoIds = new Set<string>();
  try {
    const { data: demos } = await admin
      .from("businesses")
      .select("id, demo")
      .eq("demo", true);
    for (const d of (demos ?? []) as { id: string }[]) demoIds.add(d.id);
  } catch {
    /* colonne `demo` absente : aucun établissement en démo */
  }

  const rows: AdminBusiness[] = (businesses ?? []).map((b) => {
    const x = extraById.get(b.id);
    return {
      id: b.id,
      slug: b.slug,
      name: b.name,
      status: b.status,
      subscription_status: b.subscription_status,
      subscription_ends_at: b.subscription_ends_at,
      plays: playCounts.get(b.id) ?? 0,
      owner_email: b.owner_user_id
        ? emailById.get(b.owner_user_id) ?? "(compte non trouvé)"
        : "(non lié)",
      created_at: b.created_at,
      phone: x?.phone ?? null,
      address: x?.address ?? null,
      plan: x?.plan ?? null,
      setup_option: x?.setup_option ?? null,
      setup_paid_at: x?.setup_paid_at ?? null,
      setup_done_at: x?.setup_done_at ?? null,
      admin_note: x?.admin_note ?? null,
      campaigns_addon: !!x?.campaigns_addon,
      click_collect: !!x?.click_collect,
      ref: refById.get(b.id) ?? null,
      demo: demoIds.has(b.id),
    };
  });

  // ---- Statistiques plateforme ----
  const now = Date.now();
  // Les établissements en DÉMO (données de test) sont exclus de TOUS les
  // agrégats : comptes, MRR, signaux de churn et parties jouées.
  const bizList = (businesses ?? []).filter((b) => !demoIds.has(b.id));

  // Parties : les stats de parties viennent d'un cache GLOBAL (0068) qui inclut
  // la démo. On lit uniquement les parties des établissements en démo (requête
  // bornée, très peu de lignes) et on retranche leur contribution, champ par
  // champ, pour garder le cache tout en excluant proprement la démo.
  let playsAdj = playStatsResolved;
  if (demoIds.size > 0) {
    try {
      const { data: demoRows } = await admin
        .from("plays")
        .select("business_id, play_type, prize_label, redeemed_at, created_at")
        .in("business_id", [...demoIds]);
      const d = computeAdminPlayStats(demoRows ?? [], monthIso, dayIso);
      const sub = (a: number, b: number) => Math.max(0, a - b);
      playsAdj = {
        playsTotal: sub(playStatsResolved.playsTotal, d.playsTotal),
        playsMonth: sub(playStatsResolved.playsMonth, d.playsMonth),
        playsToday: sub(playStatsResolved.playsToday, d.playsToday),
        insta: sub(playStatsResolved.insta, d.insta),
        review: sub(playStatsResolved.review, d.review),
        won: sub(playStatsResolved.won, d.won),
        redeemed: sub(playStatsResolved.redeemed, d.redeemed),
      };
    } catch {
      playsAdj = playStatsResolved;
    }
  }

  // MRR / ARR : à partir des formules + options (copie des prix Stripe).
  const mrr = summarizeMrr(
    bizList.map((b) => {
      const x = extraById.get(b.id);
      return {
        status: b.status,
        subscription_status: b.subscription_status,
        plan: x?.plan ?? null,
        campaigns_addon: x?.campaigns_addon ?? null,
        order_tracking: x?.order_tracking ?? null,
      };
    })
  );

  // Signaux de churn : essais finissant sous 3 j, payants jamais utilisés.
  const soon = now + 3 * 864e5;
  const trialsEndingSoon = bizList.filter(
    (b) =>
      b.subscription_status === "trial" &&
      b.subscription_ends_at &&
      new Date(b.subscription_ends_at).getTime() > now &&
      new Date(b.subscription_ends_at).getTime() <= soon
  ).length;
  const unusedPaying = bizList.filter(
    (b) =>
      b.status !== "suspended" &&
      b.subscription_status === "active" &&
      (playCounts.get(b.id) ?? 0) === 0
  ).length;

  const stats: AdminStats = {
    bizTotal: bizList.length,
    bizActive: bizList.filter(
      (b) =>
        b.status !== "suspended" &&
        (!b.subscription_ends_at ||
          new Date(b.subscription_ends_at).getTime() > now)
    ).length,
    bizTrial: bizList.filter((b) => b.subscription_status === "trial").length,
    bizSuspended: bizList.filter((b) => b.status === "suspended").length,
    playsTotal: playsAdj.playsTotal,
    playsMonth: playsAdj.playsMonth,
    playsToday: playsAdj.playsToday,
    insta: playsAdj.insta,
    review: playsAdj.review,
    won: playsAdj.won,
    redeemed: playsAdj.redeemed,
    leads: leadsCount ?? 0,
    mrrEur: mrr.mrrEur,
    arrEur: mrr.arrEur,
    payingCount: mrr.payingCount,
    byPlan: mrr.byPlan,
    trialsEndingSoon,
    unusedPaying,
  };

  const health = await healthPromise;

  return <AdminClient businesses={rows} stats={stats} health={health} />;
}
