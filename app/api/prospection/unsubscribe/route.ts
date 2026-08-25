import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubToken } from "@/lib/prospection/unsub";
import { reportError } from "@/lib/report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function page(message: string): Response {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Désinscription</title>
<style>body{font-family:system-ui,sans-serif;max-width:520px;margin:60px auto;padding:0 20px;color:#222;text-align:center}</style>
</head><body><h1>Kado</h1><p>${message}</p></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

/**
 * Désinscription cold email (RGPD) — publique, lien signé.
 * Ajoute l'adresse à la liste de suppression : elle ne sera plus jamais
 * contactée.
 */
export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get("e") || "").trim().toLowerCase();
  const token = req.nextUrl.searchParams.get("t") || "";

  if (!email || !verifyUnsubToken(email, token)) {
    return page("Lien de désinscription invalide ou expiré.");
  }

  try {
    const db = getAdminClient();
    await db
      .from("suppression_list")
      .upsert({ email, reason: "unsubscribed" }, { onConflict: "email" });
    // Marque les prospects correspondants comme exclus (best-effort).
    await db
      .from("prospects")
      .update({ status: "excluded", exclude_reason: "désinscrit", updated_at: new Date().toISOString() })
      .eq("email", email);
  } catch (err) {
    reportError(err, { where: "prospection.unsubscribe", email });
    return page("Une erreur est survenue. Merci de réessayer plus tard.");
  }

  return page("Vous êtes bien désinscrit(e). Vous ne recevrez plus d'emails de notre part.");
}
