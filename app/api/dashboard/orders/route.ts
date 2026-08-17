import { NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ALLOWED: Record<string, string[]> = {
  // transitions autorisées depuis chaque statut
  new: ["ready", "cancelled"],
  ready: ["done", "cancelled"],
};

/** Fait avancer (ou annule) une commande du commerçant connecté. */
export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: { id?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const next = String(body.status ?? "");
  if (!body.id || !["ready", "done", "cancelled"].includes(next)) {
    return Response.json({ error: "invalid_action" }, { status: 400 });
  }

  const db = getAdminClient();
  const { data: order } = await db
    .from("orders")
    .select("id, status")
    .eq("id", body.id)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!order) return Response.json({ error: "not_found" }, { status: 404 });
  if (!(ALLOWED[order.status] ?? []).includes(next)) {
    return Response.json({ error: "invalid_transition" }, { status: 400 });
  }

  const { error } = await db
    .from("orders")
    .update({ status: next })
    .eq("id", order.id)
    .eq("business_id", business.id);
  if (error) return Response.json({ error: "update_failed" }, { status: 500 });

  return Response.json({ ok: true });
}
