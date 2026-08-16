import type { SupabaseClient } from "@supabase/supabase-js";
import { emailLayout } from "@/lib/email";
import { unsubToken } from "@/lib/unsub";

export const SITE = "https://kado-app.fr";
/** Garde-fou technique : toute la base part (étalée), dans cette limite. */
export const MAX_RECIPIENTS = 5000;
/** Essai gratuit : 10 destinataires max par campagne (1 campagne/jour). */
export const TRIAL_MAX_RECIPIENTS = 10;
/** Option payée : envoi étalé, ce nombre d'e-mails par jour maximum. */
export const DAILY_CHUNK = 100;

export function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Audience opt-in dédupliquée d'un commerce (leads + fidélité). */
export async function buildCampaignAudience(
  db: SupabaseClient,
  businessId: string
): Promise<string[]> {
  const emails = new Set<string>();
  const { data: leads } = await db
    .from("leads")
    .select("email, unsubscribed_at")
    .eq("business_id", businessId)
    .not("email", "is", null);
  for (const l of leads ?? []) {
    if (l.email && !l.unsubscribed_at) emails.add(l.email.toLowerCase());
  }
  try {
    const { data: cards } = await db
      .from("loyalty_cards")
      .select("email, marketing_ok, unsubscribed_at")
      .eq("business_id", businessId)
      .eq("marketing_ok", true);
    for (const c of cards ?? []) {
      if (c.email && !c.unsubscribed_at) emails.add(c.email.toLowerCase());
    }
  } catch {
    /* colonnes absentes */
  }
  return [...emails].slice(0, MAX_RECIPIENTS);
}

/** Construit les e-mails d'une campagne (désinscription signée incluse). */
export function buildCampaignPayloads(
  business: { id: string; name: string; slug: string },
  replyTo: string | undefined,
  subject: string,
  message: string,
  recipients: string[]
) {
  const bodyHtml = escapeHtml(message).replace(/\n/g, "<br>");
  return recipients.map((to) => {
    const t = unsubToken(business.id, to);
    const unsub = `${SITE}/api/unsubscribe?b=${business.id}&e=${encodeURIComponent(
      Buffer.from(to).toString("base64url")
    )}&t=${t}`;
    return {
      to,
      subject,
      fromName: `${business.name} via Kado`,
      replyTo,
      marketing: true,
      html: emailLayout({
        preview: subject,
        heading: subject,
        emoji: "💌",
        bodyHtml: `${bodyHtml}<br><br><a href="${SITE}/${business.slug}" style="display:inline-block;background:linear-gradient(135deg,#ff6b4a,#ff4e87);color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px;">Voir ${escapeHtml(business.name)}</a>`,
        footnote: `Vous recevez cet e-mail car vous avez accepté les offres de ${escapeHtml(
          business.name
        )}. <a href="${unsub}" style="color:#9a94b4;">Se désinscrire</a>`,
      }),
    };
  });
}
