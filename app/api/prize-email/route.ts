import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { getAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { prizeIsLosing } from "@/lib/draw";
import { sendEmail, emailLayout } from "@/lib/email";

export const dynamic = "force-dynamic";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Envoie par e-mail le code cadeau gagné, pour que le client ne le perde pas
 * (récupération même après changement d'appareil). Transactionnel : exige un
 * code valide, GAGNANT, appartenant au commerce. Rate-limité pour éviter le spam.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!(await rateLimit(`prizemail:${ip}`, 5, 60))) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: { slug?: string; code?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const slug = (body.slug || "").trim();
  const code = (body.code || "").trim().toUpperCase();
  const email = (body.email || "").trim();
  if (!slug || !code) return Response.json({ error: "missing" }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: "bad_email" }, { status: 400 });
  }

  const db = getAdminClient();
  const { data: biz } = await db
    .from("businesses")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();
  if (!biz) return Response.json({ error: "not_found" }, { status: 404 });

  // Le code doit correspondre à un tour GAGNANT de ce commerce.
  let playRes = await db
    .from("plays")
    .select("prize_label, prize_code, is_losing")
    .eq("business_id", biz.id)
    .eq("prize_code", code)
    .maybeSingle();
  if (playRes.error && (playRes.error as { code?: string }).code === "42703") {
    playRes = await db
      .from("plays")
      .select("prize_label, prize_code")
      .eq("business_id", biz.id)
      .eq("prize_code", code)
      .maybeSingle();
  }
  const play = playRes.data;
  if (!play) return Response.json({ error: "not_found" }, { status: 404 });

  const label = play.prize_label || "";
  if (prizeIsLosing({ is_losing: (play as { is_losing?: boolean | null }).is_losing, label })) {
    return Response.json({ error: "no_win" }, { status: 400 });
  }

  const shopName = biz.name || "le commerce";

  // QR du code (PNG) généré côté serveur, joint en image INLINE via `cid:` —
  // les data:URI sont bloqués par Gmail, donc on passe par une pièce jointe.
  // Best-effort : si la génération échoue, on envoie l'e-mail sans le QR.
  let qrAttachment:
    | { filename: string; content: string; contentId: string; contentType: string }
    | null = null;
  try {
    const qrBuf = await QRCode.toBuffer(code, {
      width: 240,
      margin: 1,
      color: { dark: "#1b1035", light: "#ffffff" },
    });
    qrAttachment = {
      filename: "code-qr.png",
      content: qrBuf.toString("base64"),
      contentId: "codeqr",
      contentType: "image/png",
    };
  } catch {
    /* génération QR indisponible : e-mail envoyé sans le QR */
  }

  const qrHtml = qrAttachment
    ? `<p style="text-align:center;margin:6px 0 2px;"><img src="cid:codeqr" alt="QR du code ${escapeHtml(code)}" width="180" height="180" style="width:180px;height:180px;border-radius:12px;border:1px solid #eee;" /></p>
      <p style="text-align:center;font-size:12px;color:#9a94b4;margin:0 0 6px;">Présentez ce QR ou le code ci-dessus en caisse.</p>`
    : "";

  const html = emailLayout({
    preview: `Votre code cadeau ${code}`,
    heading: `Votre cadeau : ${label}`,
    bodyHtml: `<p>Voici votre code à présenter chez <b>${escapeHtml(shopName)}</b> :</p>
      <p style="font-size:28px;font-weight:800;letter-spacing:3px;color:#1b1035;background:#f4f0ff;border-radius:12px;padding:14px 10px;text-align:center;">${escapeHtml(code)}</p>
      ${qrHtml}
      <p>Présentez-le à l'équipe lors de votre prochaine visite. À bientôt&nbsp;!</p>`,
  });
  const text = `Votre cadeau : ${label}\nCode : ${code}\nÀ présenter chez ${shopName}.`;

  const result = await sendEmail({
    to: email,
    subject: `🎁 Votre code cadeau : ${code}`,
    html,
    text,
    fromName: shopName,
    ...(qrAttachment ? { attachments: [qrAttachment] } : {}),
  });
  if (!result.ok) return Response.json({ error: "send_failed" }, { status: 502 });
  return Response.json({ ok: true });
}
