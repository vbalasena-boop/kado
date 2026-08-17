import { NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { sanitizeHours } from "@/lib/hours";

export const dynamic = "force-dynamic";

/** Enregistre les horaires de commande du commerçant connecté. */
export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: { hours?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const hours = sanitizeHours(body.hours);
  const { error } = await getAdminClient()
    .from("businesses")
    .update({ order_hours: hours })
    .eq("id", business.id);
  if (error) {
    return Response.json(
      { error: "save_failed", detail: error.message },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}
