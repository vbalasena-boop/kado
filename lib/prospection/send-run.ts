/**
 * Prospection Kado — exécution d'un lot d'envoi email (partagé cron + admin).
 *
 * Envoie les emails APPROUVÉS dans la limite du plafond, en respectant la liste
 * de désinscription et le statut du prospect. Idempotent (message → 'sent').
 */
import { getAdminClient } from "@/lib/supabase/admin";
import { sendProspectEmail, finalizeBody } from "@/lib/prospection/sender";
import { unsubUrl } from "@/lib/prospection/unsub";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kado-app.fr";

export interface SendSummary {
  sent: number;
  skipped: number;
  failed: number;
  simulated: boolean;
  cap: number;
}

export async function runProspectionSend(): Promise<SendSummary> {
  const cap = Number(process.env.MAX_PROSPECT_EMAILS_PER_DAY || 20);
  const db = getAdminClient();
  const out: SendSummary = { sent: 0, skipped: 0, failed: 0, simulated: false, cap };

  const { data, error } = await db
    .from("prospect_messages")
    .select("id, subject, body, prospect_id, prospects!inner(email, status)")
    .eq("channel", "email")
    .eq("status", "approved")
    .limit(cap * 3);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    id: string;
    subject: string | null;
    body: string;
    prospect_id: string;
    prospects: { email: string | null; status: string };
  }[];

  const { data: supp } = await db.from("suppression_list").select("email");
  const suppressed = new Set((supp ?? []).map((s) => (s.email ?? "").toLowerCase()));

  for (const m of rows) {
    if (out.sent >= cap) break;
    const email = m.prospects?.email?.toLowerCase();
    if (!email || m.prospects.status === "excluded" || suppressed.has(email)) {
      out.skipped++;
      continue;
    }

    const body = finalizeBody(m.body, email, SITE);
    const res = await sendProspectEmail({
      to: email,
      subject: m.subject ?? "Bonjour",
      text: body,
      unsubscribeUrl: unsubUrl(email, SITE),
    });
    if (!res.ok) {
      out.failed++;
      continue;
    }
    if (res.simulated) out.simulated = true;

    await db
      .from("prospect_messages")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", m.id);
    await db
      .from("prospects")
      .update({ status: "emailed", updated_at: new Date().toISOString() })
      .eq("id", m.prospect_id);
    await db
      .from("prospect_events")
      .insert({ prospect_id: m.prospect_id, type: "email_sent", meta: { simulated: res.simulated ?? false } });
    out.sent++;
  }

  return out;
}
