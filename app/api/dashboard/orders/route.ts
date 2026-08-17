import { NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ALLOWED: Record<string, string[]> = {
  // transitions autorisées depuis chaque statut (au retrait, une commande
  // encore « nouvelle » peut passer directement à « retirée »)
  new: ["ready", "done", "cancelled"],
  ready: ["done", "cancelled"],
};

/**
 * Fait avancer (ou annule) une commande du commerçant connecté.
 * Ciblage par id (boutons de la liste) ou par code (scan du QR de retrait).
 */
export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: { id?: string; code?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const next = String(body.status ?? "");
  const code = String(body.code ?? "").trim().toUpperCase().slice(0, 12);
  if ((!body.id && !code) || !["ready", "done", "cancelled"].includes(next)) {
    return Response.json({ error: "invalid_action" }, { status: 400 });
  }

  const db = getAdminClient();
  let query = db
    .from("orders")
    .select("id, status, code, customer_name, total_cents")
    .eq("business_id", business.id);
  query = body.id ? query.eq("id", body.id) : query.eq("code", code);
  const { data: order } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!order) return Response.json({ error: "not_found" }, { status: 404 });
  if (!(ALLOWED[order.status] ?? []).includes(next)) {
    return Response.json(
      {
        error:
          order.status === "done"
            ? "already_done"
            : order.status === "cancelled"
            ? "already_cancelled"
            : "invalid_transition",
        order: {
          code: order.code,
          customer_name: order.customer_name,
          total_cents: order.total_cents,
        },
      },
      { status: 400 }
    );
  }

  const { error } = await db
    .from("orders")
    .update({ status: next })
    .eq("id", order.id)
    .eq("business_id", business.id);
  if (error) return Response.json({ error: "update_failed" }, { status: 500 });

  return Response.json({
    ok: true,
    order: {
      code: order.code,
      customer_name: order.customer_name,
      total_cents: order.total_cents,
    },
  });
}
