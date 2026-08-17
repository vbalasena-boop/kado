import { NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Catalogue Click & collect du commerçant connecté.
 * action = 'create' { name, price } (prix en euros, ex. "4,50")
 *        | 'toggle' { id }  (masque/affiche le produit)
 *        | 'delete' { id }
 */
export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: {
    action?: string;
    id?: string;
    name?: string;
    price?: string | number;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const db = getAdminClient();

  if (body.action === "create") {
    const name = String(body.name ?? "").trim().slice(0, 120);
    const price = Number(String(body.price ?? "").replace(",", "."));
    if (!name || !Number.isFinite(price) || price < 0 || price > 10000) {
      return Response.json({ error: "invalid_product" }, { status: 400 });
    }
    // limite raisonnable de taille de catalogue
    const { count } = await db
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business.id);
    if ((count ?? 0) >= 100) {
      return Response.json({ error: "too_many_products" }, { status: 400 });
    }
    const { error } = await db.from("products").insert({
      business_id: business.id,
      name,
      price_cents: Math.round(price * 100),
    });
    if (error) {
      return Response.json(
        { error: "save_failed", detail: error.message },
        { status: 500 }
      );
    }
    return Response.json({ ok: true });
  }

  if (body.action === "toggle" && body.id) {
    const { data: p } = await db
      .from("products")
      .select("id, active")
      .eq("id", body.id)
      .eq("business_id", business.id)
      .maybeSingle();
    if (!p) return Response.json({ error: "not_found" }, { status: 404 });
    await db
      .from("products")
      .update({ active: !p.active })
      .eq("id", p.id)
      .eq("business_id", business.id);
    return Response.json({ ok: true });
  }

  if (body.action === "delete" && body.id) {
    await db
      .from("products")
      .delete()
      .eq("id", body.id)
      .eq("business_id", business.id);
    return Response.json({ ok: true });
  }

  return Response.json({ error: "invalid_action" }, { status: 400 });
}
