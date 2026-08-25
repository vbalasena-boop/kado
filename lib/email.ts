import type { SupabaseClient } from "@supabase/supabase-js";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  fromName?: string;
  /** E-mail marketing (campagnes, anniversaires) : utilise l'adresse
   *  EMAIL_FROM_MARKETING si elle est définie (sous-domaine dédié),
   *  sinon retombe sur EMAIL_FROM. Sépare les réputations d'envoi. */
  marketing?: boolean;
  /** Pièces jointes (Resend). `contentId` → image inline référençable via
   *  `<img src="cid:...">` (les data:URI sont bloqués par Gmail). */
  attachments?: {
    filename: string;
    /** Contenu encodé en base64. */
    content: string;
    contentId?: string;
    contentType?: string;
  }[];
};

type SendResult = { ok: boolean; skipped?: boolean; error?: string };

function fromAddress(fromName?: string, marketing = false) {
  const base =
    (marketing && process.env.EMAIL_FROM_MARKETING) ||
    process.env.EMAIL_FROM ||
    "Kado <bonjour@kado-app.fr>";
  if (!fromName) return base;
  // remplace le nom d'affichage en conservant l'adresse
  const m = base.match(/<([^>]+)>/);
  const addr = m ? m[1] : base;
  return `${fromName.replace(/[<>"]/g, "")} <${addr}>`;
}

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
  replyTo,
  fromName,
  marketing,
  attachments,
}: SendArgs): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
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
      body: JSON.stringify({
        from: fromAddress(fromName, marketing),
        to,
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(attachments && attachments.length
          ? {
              attachments: attachments.map((a) => ({
                filename: a.filename,
                content: a.content,
                ...(a.contentId ? { content_id: a.contentId } : {}),
                ...(a.contentType ? { content_type: a.contentType } : {}),
              })),
            }
          : {}),
      }),
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

/**
 * Envoi groupé (campagnes) via l'API batch de Resend, par paquets de 100.
 * Renvoie le nombre d'e-mails acceptés.
 */
export async function sendBatch(emails: SendArgs[]): Promise<number> {
  const key = process.env.RESEND_API_KEY;
  if (!key || emails.length === 0) return 0;
  let sent = 0;
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100).map((e) => ({
      from: fromAddress(e.fromName, e.marketing),
      to: e.to,
      subject: e.subject,
      html: e.html,
      ...(e.replyTo ? { reply_to: e.replyTo } : {}),
    }));
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });
      if (res.ok) sent += chunk.length;
      else console.error("[email] batch échec", res.status);
    } catch (e) {
      console.error("[email] batch exception", e);
    }
  }
  return sent;
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
