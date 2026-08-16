import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Complète la carte de fidélité d'un client : anniversaire (jour/mois)
 * et/ou consentement marketing.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!(await rateLimit(`loyalty-extra:${ip}`, 15, 60))) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: {
    slug?: string;
    email?: string;
    birthday_day?: number;
    birthday_month?: number;
    marketing_ok?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const slug = (body.slug || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  if (!slug || !EMAIL_RE.test(email)) {
    return Response.json({ error: "bad_email" }, { status: 400 });
  }

  const db = getAdminClient();
  const { data: biz } = await db
    .from("businesses")
    .select("id, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!biz || biz.status !== "active") {
    return Response.json({ error: "unavailable" }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  const d = Number(body.birthday_day);
  const m = Number(body.birthday_month);
  if (Number.isInteger(d) && Number.isInteger(m) && d >= 1 && d <= 31 && m >= 1 && m <= 12) {
    patch.birthday_day = d;
    patch.birthday_month = m;
  }
  if (typeof body.marketing_ok === "boolean") {
    patch.marketing_ok = body.marketing_ok;
    if (body.marketing_ok) patch.unsubscribed_at = null;
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "nothing_to_update" }, { status: 400 });
  }

  const { error } = await db
    .from("loyalty_cards")
    .update(patch)
    .eq("business_id", biz.id)
    .eq("email", email);
  if (error) return Response.json({ error: "update_failed" }, { status: 500 });

  return Response.json({ ok: true });
}
