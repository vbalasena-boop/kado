/**
 * Prospection Kado — rapport hebdomadaire (le lundi).
 *
 * Envoie à l'opérateur un récap de la semaine écoulée (7 jours) : emails
 * envoyés, réponses, RDV, bounces + cumul intéressés/clients. Branché sur le
 * cron existant (aucun cron Vercel supplémentaire) : on l'appelle chaque jour
 * mais il ne s'exécute que le lundi.
 *
 * Utilise l'email transactionnel Resend (message interne). Destinataire :
 * PROSPECT_NOTIFY_TO, sinon 1ʳᵉ adresse de ADMIN_EMAILS. Silencieux sinon.
 */
import { getAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailLayout } from "@/lib/email";
import { reportError } from "@/lib/report";

function recipient(): string | null {
  const to =
    process.env.PROSPECT_NOTIFY_TO ||
    (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim() ||
    "";
  return to || null;
}

/**
 * Envoie le rapport hebdo si `now` est un lundi. `now` injectable (tests).
 * Renvoie true si un rapport a été envoyé.
 */
export async function maybeSendWeeklyReport(now: Date = new Date()): Promise<boolean> {
  if (now.getUTCDay() !== 1) return false; // 1 = lundi
  const to = recipient();
  if (!to) return false;

  try {
    const db = getAdminClient();
    const since = new Date(now.getTime() - 7 * 86_400_000).toISOString();

    const countEvents = async (types: string[]) =>
      (
        await db
          .from("prospect_events")
          .select("*", { count: "exact", head: true })
          .in("type", types)
          .gte("created_at", since)
      ).count ?? 0;
    const countStatus = async (status: string) =>
      (
        await db
          .from("prospects")
          .select("*", { count: "exact", head: true })
          .eq("status", status)
      ).count ?? 0;

    const [sent, replies, booked, bounced, interested, clients] = await Promise.all([
      countEvents(["email_sent", "email_followup_sent"]),
      countEvents(["email_replied"]),
      countEvents(["meeting_booked"]),
      countEvents(["email_bounced"]),
      countStatus("interested"),
      countStatus("client"),
    ]);

    const site = process.env.NEXT_PUBLIC_SITE_URL || "https://kado-app.fr";
    const row = (label: string, value: number, color = "#1b1035") =>
      `<tr><td style="padding:6px 0;color:#40396a;">${label}</td>` +
      `<td style="padding:6px 0;text-align:right;font-weight:700;color:${color};">${value}</td></tr>`;

    const bodyHtml =
      `<p style="margin:0 0 10px">Voici ton récap des <b>7 derniers jours</b> :</p>` +
      `<table role="presentation" width="100%" style="font-size:15px;border-collapse:collapse;">` +
      row("✉️ Emails envoyés", sent) +
      row("💬 Réponses", replies, "#1e7d34") +
      row("📅 RDV réservés", booked, "#1e7d34") +
      row("⛔ Bounces", bounced, bounced > 0 ? "#c0392b" : "#1b1035") +
      `<tr><td colspan="2" style="border-top:1px solid #eee;padding-top:8px"></td></tr>` +
      row("⭐ Intéressés (cumul)", interested, "#1e7d34") +
      row("🏆 Clients (cumul)", clients, "#1e7d34") +
      `</table>` +
      `<p style="margin:16px 0 0"><a href="${site}/admin/prospection" style="color:#f0a52e;font-weight:600;text-decoration:none;">Ouvrir le tableau de bord →</a></p>`;

    await sendEmail({
      to,
      subject: `📊 Prospection — récap de la semaine (${sent} envoyés, ${replies} réponses, ${booked} RDV)`,
      html: emailLayout({ heading: "Ton récap prospection de la semaine", emoji: "📊", bodyHtml }),
      text: `7 derniers jours : ${sent} envoyés, ${replies} réponses, ${booked} RDV, ${bounced} bounces. Intéressés: ${interested}, Clients: ${clients}. ${site}/admin/prospection`,
    });
    return true;
  } catch (err) {
    reportError(err, { where: "prospection.maybeSendWeeklyReport" });
    return false;
  }
}
