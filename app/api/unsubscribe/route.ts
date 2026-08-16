import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { unsubToken } from "@/lib/unsub";

export const dynamic = "force-dynamic";

/** Désinscription des offres d'un commerce (lien présent dans chaque campagne). */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const b = url.searchParams.get("b") || "";
  const e64 = url.searchParams.get("e") || "";
  const t = url.searchParams.get("t") || "";

  let email = "";
  try {
    email = Buffer.from(e64, "base64url").toString("utf8").toLowerCase();
  } catch {
    /* invalide */
  }

  const ok = b && email && t && unsubToken(b, email) === t;
  if (ok) {
    const db = getAdminClient();
    const now = new Date().toISOString();
    try {
      await db
        .from("leads")
        .update({ unsubscribed_at: now })
        .eq("business_id", b)
        .eq("email", email);
    } catch {
      /* ignore */
    }
    try {
      await db
        .from("loyalty_cards")
        .update({ unsubscribed_at: now, marketing_ok: false })
        .eq("business_id", b)
        .eq("email", email);
    } catch {
      /* ignore */
    }
  }

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Désinscription</title></head>
<body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#17092e;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
<div style="background:#fff;border-radius:20px;padding:36px;max-width:420px;text-align:center;margin:16px;">
<div style="font-size:44px;margin-bottom:10px;">${ok ? "✅" : "🤔"}</div>
<h1 style="font-size:20px;color:#1b1035;margin:0 0 10px;">${
    ok ? "Vous êtes désinscrit(e)" : "Lien invalide"
  }</h1>
<p style="color:#40396a;font-size:15px;line-height:1.6;margin:0;">${
    ok
      ? "Vous ne recevrez plus d'offres de ce commerce. Votre carte de fidélité reste utilisable normalement."
      : "Ce lien de désinscription est incomplet ou expiré."
  }</p>
</div></body></html>`;

  return new Response(html, {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
