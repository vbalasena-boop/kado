import type { SupabaseClient } from "@supabase/supabase-js";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type SendResult = { ok: boolean; skipped?: boolean; error?: string };

/**
 * Envoie un e-mail transactionnel via l'API Resend.
 * Ne lève jamais : si la clé manque ou l'envoi échoue, on renvoie un
 * résultat en erreur mais l'action métier appelante continue.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendArgs): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Kado <bonjour@kado-app.fr>";
  if (!key) {
    console.warn("[email] RESEND_API_KEY manquant — e-mail non envoyé:", subject);
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("[email] échec Resend", res.status, t);
      return { ok: false, error: `http_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email] exception", e);
    return { ok: false, error: "exception" };
  }
}

/** Récupère le nom de l'établissement + l'e-mail de son propriétaire. */
export async function getOwnerContact(
  db: SupabaseClient,
  businessId: string
): Promise<{ email: string | null; businessName: string | null }> {
  const { data: biz } = await db
    .from("businesses")
    .select("name, owner_user_id")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz) return { email: null, businessName: null };
  if (!biz.owner_user_id)
    return { email: null, businessName: biz.name ?? null };
  try {
    const { data } = await db.auth.admin.getUserById(biz.owner_user_id);
    return { email: data?.user?.email ?? null, businessName: biz.name ?? null };
  } catch {
    return { email: null, businessName: biz.name ?? null };
  }
}

/** Gabarit HTML festif et responsive, aux couleurs de Kado. */
export function emailLayout(opts: {
  preview?: string;
  heading: string;
  emoji?: string;
  bodyHtml: string;
  footnote?: string;
}): string {
  const preview = opts.preview ?? "";
  const heading = opts.heading;
  const emoji = opts.emoji ?? "🎁";
  const bodyHtml = opts.bodyHtml;
  const footnote = opts.footnote;
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#140a29;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${preview}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#140a29;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.35);">
        <tr><td style="background:linear-gradient(135deg,#241546,#1b1035);padding:26px 30px;">
          <span style="font-size:22px;font-weight:800;color:#ffc24d;letter-spacing:.5px;">🎁 Kado</span>
        </td></tr>
        <tr><td style="padding:34px 30px 8px;">
          <div style="font-size:38px;line-height:1;margin-bottom:12px;">${emoji}</div>
          <h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:#1b1035;font-weight:800;">${heading}</h1>
          <div style="font-size:15px;line-height:1.6;color:#40396a;">${bodyHtml}</div>
        </td></tr>
        <tr><td style="padding:22px 30px 30px;">
          <div style="border-top:1px solid #eee;padding-top:16px;font-size:12px;line-height:1.6;color:#9a94b4;">
            ${footnote ? footnote + "<br><br>" : ""}
            Cet e-mail vous a été envoyé par Kado.<br>
            <a href="https://kado-app.fr" style="color:#f0a52e;text-decoration:none;">kado-app.fr</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
