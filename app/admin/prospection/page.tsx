import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";
import ProspectionClient, { type ProspectRow, type Stats } from "./ProspectionClient";
import type { ProspectStatus } from "@/lib/prospection/types";

export const dynamic = "force-dynamic";

/**
 * Écran de prospection (admin) — stories B3 & E2 (tableau de bord).
 * Liste les prospects triés par score + indicateurs de suivi.
 */
export default async function ProspectionPage() {
  const user = await getAdminUser();
  if (!user) return null; // le layout admin gère l'accès refusé

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("prospects")
    .select(
      "id, name, category, city, google_rating, google_reviews_count, website, instagram_handle, email, score, status, created_at"
    )
    .order("score", { ascending: false, nullsFirst: false })
    .limit(500);

  const prospects: ProspectRow[] = error ? [] : ((data ?? []) as ProspectRow[]);

  // --- Indicateurs (E2) ---
  let stats: Stats | null = null;
  if (!error) {
    const { data: all } = await admin
      .from("prospects")
      .select("status, email, instagram_handle")
      .limit(5000);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayIso = startOfDay.toISOString();
    const countToday = async (type: string) =>
      (
        await admin
          .from("prospect_events")
          .select("*", { count: "exact", head: true })
          .eq("type", type)
          .gte("created_at", todayIso)
      ).count ?? 0;

    const rows = all ?? [];
    const byStatus: Record<string, number> = {};
    let withEmail = 0;
    let withInstagram = 0;
    for (const r of rows) {
      const s = r.status as ProspectStatus;
      byStatus[s] = (byStatus[s] ?? 0) + 1;
      if (r.email) withEmail++;
      if (r.instagram_handle) withInstagram++;
    }
    const [emailsToday, dmToday] = await Promise.all([
      countToday("email_sent"),
      countToday("dm_sent"),
    ]);
    const cap = Number(process.env.MAX_PROSPECT_EMAILS_PER_DAY || 20);

    stats = {
      total: rows.length,
      byStatus,
      withEmail,
      withInstagram,
      emailsToday,
      dmToday,
      emailCap: cap,
    };
  }

  return (
    <ProspectionClient
      prospects={prospects}
      migrationMissing={Boolean(error)}
      stats={stats}
    />
  );
}
