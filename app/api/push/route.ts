import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { hasAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Clé publique VAPID (publique par nature). */
export async function GET() {
  return Response.json({ key: process.env.VAPID_PUBLIC_KEY ?? null });
}

/**
 * Abonne (ou désabonne) l'appareil d'un CLIENT aux offres d'un commerce.
 * Opt-in par nature : le navigateur ne fournit un abonnement qu'après
 * autorisation explicite du client.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!(await rateLimit(`push:${ip}`, 10, 60))) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: {
    slug?: string;
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    remove?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const endpoint = String(body.endpoint ?? "").slice(0, 1000);
  if (!body.slug || !endpoint.startsWith("https://")) {
    return Response.json({ error: "bad_subscription" }, { status: 400 });
  }

  const db = getAdminClient();
  const { data: biz } = await db
    .from("businesses")
    .select("id, status, subscription_ends_at")
    .eq("slug", body.slug)
    .maybeSingle();
  if (!biz) return Response.json({ error: "not_found" }, { status: 404 });

  if (body.remove) {
    try {
      await db
        .from("client_push_subscriptions")
        .delete()
        .eq("business_id", biz.id)
        .eq("endpoint", endpoint);
    } catch {
      /* table absente */
    }
    return Response.json({ ok: true });
  }

  if (!hasAccess(biz)) {
    return Response.json({ error: "unavailable" }, { status: 403 });
  }
  const p256dh = String(body.keys?.p256dh ?? "");
  const auth = String(body.keys?.auth ?? "");
  if (!p256dh || !auth) {
    return Response.json({ error: "bad_subscription" }, { status: 400 });
  }

  try {
    const { error } = await db.from("client_push_subscriptions").upsert(
      { business_id: biz.id, endpoint, p256dh, auth },
      { onConflict: "business_id,endpoint" }
    );
    if (error) {
      return Response.json({ error: "save_failed" }, { status: 500 });
    }
  } catch {
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
