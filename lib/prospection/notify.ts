/**
 * Prospection Kado — notification interne à l'opérateur.
 *
 * Quand un prospect RÉPOND ou RÉSERVE un RDV, on prévient l'opérateur par email
 * (via l'email transactionnel Resend — il s'agit d'un message interne vers sa
 * propre boîte, PAS de cold email). But : réagir vite = plus de conversions.
 *
 * Destinataire : PROSPECT_NOTIFY_TO, sinon la 1ʳᵉ adresse de ADMIN_EMAILS.
 * Silencieux si aucun destinataire n'est configuré.
 */
import { sendEmail, emailLayout } from "@/lib/email";
import { reportError } from "@/lib/report";

export interface ProspectActivity {
  replied: string[];
  booked: string[];
}

function recipient(): string | null {
  const to =
    process.env.PROSPECT_NOTIFY_TO ||
    (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim() ||
    "";
  return to || null;
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] ?? c));
}

/** Prévient l'opérateur qu'il y a de nouvelles réponses / RDV. Ne lève jamais. */
export async function notifyProspectActivity(a: ProspectActivity): Promise<void> {
  const to = recipient();
  if (!to) return;
  if (a.replied.length === 0 && a.booked.length === 0) return;

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://kado-app.fr";
  const link = `${site}/admin/prospection`;

  const blocks: string[] = [];
  if (a.booked.length > 0) {
    blocks.push(
      `<p style="margin:0 0 12px"><b>📅 ${a.booked.length} RDV réservé(s)</b> : ${a.booked
        .map(esc)
        .join(", ")}</p>`
    );
  }
  if (a.replied.length > 0) {
    blocks.push(
      `<p style="margin:0 0 12px"><b>💬 ${a.replied.length} réponse(s)</b> : ${a.replied
        .map(esc)
        .join(", ")}</p>`
    );
  }
  const bodyHtml =
    blocks.join("") +
    `<p style="margin:14px 0 0"><a href="${link}" style="color:#f0a52e;font-weight:600;text-decoration:none;">Voir dans l'admin →</a></p>`;

  const subject =
    a.booked.length > 0
      ? `🎯 ${a.booked.length} RDV${a.replied.length ? ` + ${a.replied.length} réponse(s)` : ""} — prospection`
      : `💬 ${a.replied.length} réponse(s) — prospection`;

  try {
    await sendEmail({
      to,
      subject,
      html: emailLayout({ heading: "Nouvelle activité prospection", emoji: "🔔", bodyHtml, preview: subject }),
      text: `${a.booked.length} RDV, ${a.replied.length} réponse(s). ${link}`,
    });
  } catch (err) {
    reportError(err, { where: "prospection.notifyProspectActivity" });
  }
}
