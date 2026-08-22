import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Le client attache une alerte push à une commande existante (repérée par son
 * code) — utile pour une commande prise EN CAISSE : il scanne le QR de suivi
 * puis active les notifications. Opt-in par nature (autorisation navigateur).
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!(await rateLimit(`osub:${ip}`, 20, 60))) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: {
    slug?: string;
    code?: string;
    push?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const slug = String(body.slug ?? "").trim().slice(0, 80);
  const code = String(body.code ?? "").trim().toUpperCase().slice(0, 12);
  const endpoint = String(body.push?.endpoint ?? "");
  if (!slug || !code || !endpoint.startsWith("https://")) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const p256dh = String(body.push?.keys?.p256dh ?? "");
  const auth = String(body.push?.keys?.auth ?? "");
  if (!p256dh || !auth) {
    return Response.json({ error: "bad_subscription" }, { status: 400 });
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
      .select("id")
      .eq("business_id", biz.id)
      .eq("code", code)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!order) return Response.json({ error: "not_found" }, { status: 404 });

    const { error } = await db
      .from("orders")
      .update({
        notify_push: { endpoint: endpoint.slice(0, 1000), p256dh, auth },
      })
      .eq("id", (order as any).id);
    if (error) return Response.json({ error: "save_failed" }, { status: 500 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 500 });
  }
}
