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

  const base: ProspectRow[] = error ? [] : ((data ?? []) as ProspectRow[]);

  // État d'envoi de l'email par prospect (sent > approved > draft), pour un
  // suivi clair par canal dans la liste. Le DM est déduit du statut du prospect.
  const emailStateById: Record<string, "sent" | "approved" | "draft"> = {};
  if (!error && base.length > 0) {
    const ids = base.map((p) => p.id);
    const { data: emsgs } = await admin
      .from("prospect_messages")
      .select("prospect_id, status")
      .eq("channel", "email")
      .in("prospect_id", ids);
    const rank: Record<string, number> = { sent: 3, approved: 2, draft: 1 };
    for (const m of emsgs ?? []) {
      const st = m.status as string;
      if (!(st in rank)) continue;
      const pid = m.prospect_id as string;
      const cur = emailStateById[pid];
      if (!cur || rank[st] > rank[cur]) emailStateById[pid] = st as "sent" | "approved" | "draft";
    }
  }

  const prospects: ProspectRow[] = base.map((p) => ({
    ...p,
    emailState: emailStateById[p.id] ?? null,
  }));

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

    // Emails approuvés en attente d'envoi (file d'envoi).
    const { count: pendingEmails } = await admin
      .from("prospect_messages")
      .select("*", { count: "exact", head: true })
      .eq("channel", "email")
      .eq("status", "approved");

    stats = {
      total: rows.length,
      byStatus,
      withEmail,
      withInstagram,
      emailsToday,
      dmToday,
      emailCap: cap,
      pendingEmails: pendingEmails ?? 0,
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
