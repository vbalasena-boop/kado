/**
 * Prospection Kado — exécution d'un lot d'envoi email (partagé cron + admin).
 *
 * Envoie les emails APPROUVÉS dans la limite du plafond, en respectant la liste
 * de désinscription et le statut du prospect. Idempotent (message → 'sent').
 */
import { getAdminClient } from "@/lib/supabase/admin";
import { sendProspectEmail, finalizeBody } from "@/lib/prospection/sender";
import { unsubUrl } from "@/lib/prospection/unsub";
import { renderFollowupEmail } from "@/lib/prospection/templates";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kado-app.fr";

export interface SendSummary {
  sent: number;
  skipped: number;
  failed: number;
  followups: number;
  simulated: boolean;
  cap: number;
}

export async function runProspectionSend(): Promise<SendSummary> {
  const cap = Number(process.env.MAX_PROSPECT_EMAILS_PER_DAY || 20);
  const db = getAdminClient();
  const out: SendSummary = { sent: 0, skipped: 0, failed: 0, followups: 0, simulated: false, cap };

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

  // --- Relances (2ᵉ email) : contactés depuis N jours, sans réponse ---
  const delayDays = Number(process.env.PROSPECT_FOLLOWUP_DELAY_DAYS || 4);
  const cutoff = new Date(Date.now() - delayDays * 86_400_000).toISOString();

  const { data: firstsData } = await db
    .from("prospect_messages")
    .select(
      "prospect_id, sent_at, prospects!inner(name, city, category, google_reviews_count, email, status)"
    )
    .eq("channel", "email")
    .eq("step", 1)
    .eq("status", "sent")
    .lt("sent_at", cutoff)
    .limit(cap * 3);

  const firsts = (firstsData ?? []) as unknown as {
    prospect_id: string;
    prospects: {
      name: string;
      city: string | null;
      category: string | null;
      google_reviews_count: number | null;
      email: string | null;
      status: string;
    };
  }[];

  // Prospects ayant déjà reçu une relance (step 2) → à ne pas re-relancer.
  const firstIds = firsts.map((f) => f.prospect_id);
  const alreadyRelanced = new Set<string>();
  if (firstIds.length > 0) {
    const { data: seconds } = await db
      .from("prospect_messages")
      .select("prospect_id")
      .eq("channel", "email")
      .eq("step", 2)
      .in("prospect_id", firstIds);
    for (const s of seconds ?? []) alreadyRelanced.add(s.prospect_id as string);
  }

  for (const f of firsts) {
    if (out.sent >= cap) break;
    const p = f.prospects;
    const email = p.email?.toLowerCase();
    // Uniquement ceux TOUJOURS au statut "emailed" (pas de réponse), non exclus/désinscrits.
    if (!email || p.status !== "emailed" || suppressed.has(email) || alreadyRelanced.has(f.prospect_id)) {
      continue;
    }

    const fu = renderFollowupEmail({
      name: p.name,
      city: p.city,
      category: p.category,
      google_reviews_count: p.google_reviews_count,
    });
    const body = finalizeBody(fu.body, email, SITE);
    const res = await sendProspectEmail({
      to: email,
      subject: fu.subject,
      text: body,
      unsubscribeUrl: unsubUrl(email, SITE),
    });
    if (!res.ok) {
      out.failed++;
      continue;
    }
    if (res.simulated) out.simulated = true;

    await db.from("prospect_messages").insert({
      prospect_id: f.prospect_id,
      channel: "email",
      step: 2,
      subject: fu.subject,
      body: fu.body,
      status: "sent",
      sent_at: new Date().toISOString(),
    });
    await db
      .from("prospect_events")
      .insert({ prospect_id: f.prospect_id, type: "email_followup_sent", meta: { simulated: res.simulated ?? false } });
    alreadyRelanced.add(f.prospect_id);
    out.sent++;
    out.followups++;
  }

  return out;
}
