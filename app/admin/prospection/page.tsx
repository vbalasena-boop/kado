import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";
import ProspectionClient, { type ProspectRow, type Stats } from "./ProspectionClient";
import type { ProspectStatus } from "@/lib/prospection/types";
import {
  SUBJECT_VARIANTS,
  emailSubjectVariant,
  EMAIL_ANGLE_LABELS,
  emailAngleVariant,
} from "@/lib/prospection/templates";

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
      .select("status, email, instagram_handle, city, category")
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

    // Regroupements pour l'analyse de conversion (par ville / par secteur).
    const CONTACTED = new Set(["emailed", "dm_sent", "replied", "interested", "client"]);
    const REPLIED = new Set(["replied", "interested", "client"]);
    type Agg = { total: number; contacted: number; replied: number; clients: number };
    const cityAgg: Record<string, Agg> = {};
    const segAgg: Record<string, Agg> = {};
    const bump = (map: Record<string, Agg>, key: string, s: string) => {
      const a = (map[key] ??= { total: 0, contacted: 0, replied: 0, clients: 0 });
      a.total++;
      if (CONTACTED.has(s)) a.contacted++;
      if (REPLIED.has(s)) a.replied++;
      if (s === "client") a.clients++;
    };

    for (const r of rows) {
      const s = r.status as ProspectStatus;
      byStatus[s] = (byStatus[s] ?? 0) + 1;
      if (r.email) withEmail++;
      if (r.instagram_handle) withInstagram++;
      bump(cityAgg, ((r.city as string) || "—").trim() || "—", s);
      bump(segAgg, (r.category as string) || "autre", s);
    }

    const toRows = (map: Record<string, Agg>) =>
      Object.entries(map)
        .map(([key, a]) => ({ key, ...a }))
        .filter((r) => r.contacted > 0) // on ne montre que ce qui a été contacté
        .sort((a, b) => b.contacted - a.contacted)
        .slice(0, 12);
    const byCity = toRows(cityAgg);
    const bySegment = toRows(segAgg);
    const countAll = async (type: string | string[]) => {
      const q = admin.from("prospect_events").select("*", { count: "exact", head: true });
      const res = Array.isArray(type) ? await q.in("type", type) : await q.eq("type", type);
      return res.count ?? 0;
    };
    const [emailsToday, dmToday, sentTotal, bouncedTotal] = await Promise.all([
      countToday("email_sent"),
      countToday("dm_sent"),
      countAll(["email_sent", "email_followup_sent"]),
      countAll("email_bounced"),
    ]);
    const cap = Number(process.env.MAX_PROSPECT_EMAILS_PER_DAY || 20);

    // Emails approuvés en attente d'envoi (file d'envoi).
    const { count: pendingEmails } = await admin
      .from("prospect_messages")
      .select("*", { count: "exact", head: true })
      .eq("channel", "email")
      .eq("status", "approved");

    // Performance PAR objet : parmi les prospects réellement emailés (message
    // email step 1 « sent »), combien ont répondu — regroupé par variante d'objet
    // (recalculée depuis l'id, choix déterministe → pas de stockage nécessaire).
    const subjectPerf = SUBJECT_VARIANTS.map((label) => ({
      label,
      sent: 0,
      replied: 0,
    }));
    // Performance PAR angle A/B (email rédigé par IA) — même principe : angle
    // recalculé depuis l'id du prospect (déterministe → pas de stockage).
    const anglePerf = EMAIL_ANGLE_LABELS.map((label) => ({
      label,
      sent: 0,
      replied: 0,
    }));
    const { data: sentEmails } = await admin
      .from("prospect_messages")
      .select("prospect_id")
      .eq("channel", "email")
      .eq("step", 1)
      .eq("status", "sent")
      .limit(5000);
    const emailedIds = [...new Set((sentEmails ?? []).map((m) => m.prospect_id as string))];
    if (emailedIds.length > 0) {
      const { data: emailedProspects } = await admin
        .from("prospects")
        .select("id, status")
        .in("id", emailedIds)
        .limit(5000);
      const REPLIED = new Set(["replied", "interested", "client"]);
      for (const p of emailedProspects ?? []) {
        const replied = REPLIED.has(p.status as string);
        const idx = emailSubjectVariant(p.id as string);
        subjectPerf[idx].sent++;
        if (replied) subjectPerf[idx].replied++;
        const aidx = emailAngleVariant(p.id as string);
        anglePerf[aidx].sent++;
        if (replied) anglePerf[aidx].replied++;
      }
    }

    stats = {
      total: rows.length,
      byStatus,
      withEmail,
      withInstagram,
      emailsToday,
      dmToday,
      emailCap: cap,
      pendingEmails: pendingEmails ?? 0,
      sentTotal,
      bouncedTotal,
      subjectPerf,
      anglePerf,
      byCity,
      bySegment,
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
