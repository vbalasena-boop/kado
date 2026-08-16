import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Enregistre un e-mail (opt-in) laissé par un joueur pour un établissement. */
export async function POST(req: NextRequest) {
  // Anti-abus : 10 soumissions/min max par IP
  const ip = clientIp(req);
  if (!(await rateLimit(`lead:${ip}`, 10, 60))) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: { slug?: string; email?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const email = (body.email || "").trim();
  const phone = (body.phone || "").trim();
  if (!body.slug || (!email && !phone)) {
    return Response.json({ error: "missing" }, { status: 400 });
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: "bad_email" }, { status: 400 });
  }

  const db = getAdminClient();
  const { data: biz } = await db
    .from("businesses")
    .select("id")
    .eq("slug", body.slug)
    .maybeSingle();
  if (!biz) return Response.json({ error: "not_found" }, { status: 404 });

  const { error } = await db
    .from("leads")
    .insert({ business_id: biz.id, email: email || null, phone: phone || null });
  if (error) return Response.json({ error: "save_failed" }, { status: 500 });

  return Response.json({ ok: true });
}
