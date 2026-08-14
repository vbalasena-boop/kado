import { NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const EXPIRY_DAYS = 30;

/**
 * Vérifie / valide un code cadeau présenté en caisse.
 * action = 'check' (juste vérifier) | 'redeem' (marquer comme utilisé).
 * Statuts : not_found | no_win | already | expired | valid | redeemed.
 */
export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: { code?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const code = (body.code || "").trim().toUpperCase();
  if (!code) return Response.json({ status: "not_found" });

  const db = getAdminClient();
  const { data: play } = await db
    .from("plays")
    .select("id, prize_label, prize_code, created_at, redeemed_at")
    .eq("business_id", business.id)
    .eq("prize_code", code)
    .maybeSingle();

  if (!play) return Response.json({ status: "not_found" });

  const label = play.prize_label || "";
  if (label.toLowerCase().includes("rien")) {
    return Response.json({ status: "no_win", prize: label });
  }
  if (play.redeemed_at) {
    return Response.json({
      status: "already",
      prize: label,
      redeemed_at: play.redeemed_at,
    });
  }
  const expired =
    new Date(play.created_at).getTime() + EXPIRY_DAYS * 864e5 < Date.now();
  if (expired) {
    return Response.json({ status: "expired", prize: label });
  }

  if (body.action === "redeem") {
    const { error } = await db
      .from("plays")
      .update({ redeemed_at: new Date().toISOString() })
      .eq("id", play.id)
      .is("redeemed_at", null); // évite la double validation concurrente
    if (error) return Response.json({ error: "update_failed" }, { status: 500 });
    return Response.json({ status: "redeemed", prize: label });
  }

  return Response.json({ status: "valid", prize: label });
}
