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
      .select("status, buzzer_no, service_mode")
      .eq("business_id", biz.id)
      .eq("code", code)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!order) return Response.json({ error: "not_found" }, { status: 404 });

    const o = order as any;
    const status = o.status ?? "new";

    // Bipeur : position dans la file — nombre de commandes du jour encore « à
    // préparer » avec un numéro INFÉRIEUR (donc devant celle-ci). Tolérant.
    let ahead: number | null = null;
    const isBuzzer = o.service_mode === "buzzer" || o.buzzer_no != null;
    if (status === "new" && isBuzzer && typeof o.buzzer_no === "number") {
      try {
        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);
        const { count } = await db
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("business_id", biz.id)
          .eq("status", "new")
          .gte("created_at", startOfDay.toISOString())
          .not("buzzer_no", "is", null)
          .lt("buzzer_no", o.buzzer_no);
        ahead = count ?? 0;
      } catch {
        ahead = null; // colonne absente : on n'affiche pas la position
      }
    }

    return Response.json({ status, ...(ahead != null ? { ahead } : {}) });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 500 });
  }
}
