import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";
import AdminClient, { AdminBusiness, AdminStats } from "./AdminClient";

export const dynamic = "force-dynamic";

const isWin = (l: string | null) =>
  !!l && !l.toLowerCase().includes("rien");

export default async function AdminPage() {
  const user = await getAdminUser();
  if (!user) return null; // le layout gère l'accès refusé

  const admin = getAdminClient();
  const { data: businesses } = await admin
    .from("businesses")
    .select(
      "id, slug, name, status, subscription_status, subscription_ends_at, owner_user_id, created_at"
    )
    .order("created_at", { ascending: false });

  const { data: playRows } = await admin
    .from("plays")
    .select("business_id, play_type, prize_label, redeemed_at, created_at");

  const { count: leadsCount } = await admin
    .from("leads")
    .select("*", { count: "exact", head: true });

  const rowsPlays = playRows ?? [];
  const counts = new Map<string, number>();
  for (const r of rowsPlays)
    counts.set(r.business_id, (counts.get(r.business_id) ?? 0) + 1);

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
  };
  const extraById = new Map<string, Extra>();
  try {
    const { data: extras } = await admin
      .from("businesses")
      .select("id, phone, address, plan, setup_option, setup_paid_at, setup_done_at");
    for (const e of (extras ?? []) as Extra[]) extraById.set(e.id, e);
  } catch {
    /* colonnes absentes : valeurs par défaut */
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
      plays: counts.get(b.id) ?? 0,
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
    };
  });

  // ---- Statistiques plateforme ----
  const now = Date.now();
  const startMonth = new Date();
  startMonth.setDate(1);
  startMonth.setHours(0, 0, 0, 0);
  const startDay = new Date();
  startDay.setHours(0, 0, 0, 0);

  const bizList = businesses ?? [];
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
    playsTotal: rowsPlays.length,
    playsMonth: rowsPlays.filter(
      (p) => new Date(p.created_at) >= startMonth
    ).length,
    playsToday: rowsPlays.filter((p) => new Date(p.created_at) >= startDay)
      .length,
    insta: rowsPlays.filter((p) => p.play_type === "instagram").length,
    review: rowsPlays.filter((p) => p.play_type === "review").length,
    won: rowsPlays.filter((p) => isWin(p.prize_label)).length,
    redeemed: rowsPlays.filter((p) => p.redeemed_at).length,
    leads: leadsCount ?? 0,
  };

  return <AdminClient businesses={rows} stats={stats} />;
}
