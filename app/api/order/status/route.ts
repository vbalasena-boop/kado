import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Statut public d'une commande (suivi client en direct).
 * GET /api/order/status?slug=…&code=…  →  { status }
 * Ne renvoie que le statut : aucune donnée personnelle.
 */
export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  if (!(await rateLimit(`ostatus:${ip}`, 60, 60))) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const slug = String(searchParams.get("slug") ?? "").trim().slice(0, 80);
  const code = String(searchParams.get("code") ?? "")
    .trim()
    .toUpperCase()
    .slice(0, 12);
  if (!slug || !code) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const db = getAdminClient();
  try {
    const { data: biz } = await db
      .from("businesses")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!biz) return Response.json({ error: "not_found" }, { status: 404 });

    const { data: order } = await db
      .from("orders")
      .select("status")
      .eq("business_id", biz.id)
      .eq("code", code)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!order) return Response.json({ error: "not_found" }, { status: 404 });

    return Response.json({ status: (order as any).status ?? "new" });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 500 });
  }
}
