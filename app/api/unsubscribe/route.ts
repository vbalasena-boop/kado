import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubToken } from "@/lib/unsub";
import { reportError } from "@/lib/report";
import { escapeHtml } from "@/lib/campaigns";

export const dynamic = "force-dynamic";

function decodeEmail(e64: string): string {
  let email = "";
  try {
    email = Buffer.from(e64, "base64url").toString("utf8").toLowerCase();
  } catch {
    /* invalide */
  }
  return email;
}

function response(title: string, message: string, status: number, form = "") {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Désinscription</title></head>
<body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#17092e;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
<div style="background:#fff;border-radius:20px;padding:36px;max-width:420px;text-align:center;margin:16px;">
<div style="font-size:44px;margin-bottom:10px;">${status < 400 ? "✉️" : "🤔"}</div>
<h1 style="font-size:20px;color:#1b1035;margin:0 0 10px;">${title}</h1>
<p style="color:#40396a;font-size:15px;line-height:1.6;margin:0 0 18px;">${message}</p>${form}
</div></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** Lien GET d'e-mail : confirme le jeton mais ne change aucun consentement. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const b = url.searchParams.get("b") || "";
  const e64 = url.searchParams.get("e") || "";
  const t = url.searchParams.get("t") || "";
  const email = decodeEmail(e64);
  const ok = verifyUnsubToken(b, email, t);
  if (!ok) return response("Lien invalide", "Ce lien est incomplet ou expiré.", 400);
  const form = `<form method="POST" action="/api/unsubscribe">
<input type="hidden" name="b" value="${escapeHtml(b)}"><input type="hidden" name="e" value="${escapeHtml(e64)}"><input type="hidden" name="t" value="${escapeHtml(t)}">
<button type="submit" style="border:none;cursor:pointer;background:linear-gradient(135deg,#ff6b4a,#ff4e87);color:#fff;font-weight:700;font-size:16px;padding:14px 26px;border-radius:12px;">Confirmer ma désinscription</button></form>`;
  return response("Confirmer la désinscription", "Vous ne recevrez plus les offres de ce commerce. Votre carte de fidélité restera utilisable normalement.", 200, form);
}

/** POST : acte délibéré, seul point d'écriture du consentement. */
export async function POST(req: NextRequest) {
  let b = "", e64 = "", t = "";
  try {
    const form = await req.formData();
    b = String(form.get("b") || "");
    e64 = String(form.get("e") || "");
    t = String(form.get("t") || "");
  } catch {
    return response("Lien invalide", "Ce lien est incomplet ou expiré.", 400);
  }
  const email = decodeEmail(e64);
  if (!verifyUnsubToken(b, email, t)) {
    return response("Lien invalide", "Ce lien est incomplet ou expiré.", 400);
  }

  const db = getAdminClient();
  const now = new Date().toISOString();
  try {
    await db.from("leads").update({ unsubscribed_at: now }).eq("business_id", b).eq("email", email);
  } catch {
    /* best effort */
  }
  try {
    // Seule une transition réelle est auditée ; les rejeux restent idempotents.
    const { data: cards } = await db
      .from("loyalty_cards")
      .update({ unsubscribed_at: now, marketing_ok: false })
      .eq("business_id", b)
      .eq("email", email)
      .is("unsubscribed_at", null)
      .select("id");
    const cardId = Array.isArray(cards) ? cards[0]?.id ?? null : null;
    if (Array.isArray(cards) && cards.length > 0) {
      try {
        await db.from("consent_events").insert({
          type: "unsubscribed", source: "unsubscribe_route", business_id: b, email, card_id: cardId,
        });
      } catch (err) {
        reportError(err, { where: "unsubscribe.audit" });
      }
    }
  } catch {
    /* best effort */
  }
  return response("Vous êtes désinscrit(e)", "Vous ne recevrez plus d'offres de ce commerce. Votre carte de fidélité reste utilisable normalement.", 200);
}
