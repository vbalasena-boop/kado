import { NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { sendPushToBusiness } from "@/lib/push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function pickupCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * Création d'une commande DEPUIS LA CAISSE par le commerçant.
 * Le client peut ensuite scanner le QR de suivi pour être alerté quand
 * c'est prêt (page /{slug}/suivi/{code}).
 */
export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: {
    items?: { id?: string; qty?: number }[];
    name?: string;
    mode?: string;
    table?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const items = (body.items ?? []).filter(
    (i) => i?.id && Number.isInteger(i.qty) && (i.qty as number) > 0
  );
  if (items.length === 0 || items.length > 40) {
    return Response.json({ error: "empty" }, { status: 400 });
  }
  const name = String(body.name ?? "").trim().slice(0, 80) || "Commande caisse";
  const serviceMode = body.mode === "sur_place" ? "sur_place" : "emporter";
  const tableLabel =
    serviceMode === "sur_place"
      ? String(body.table ?? "").trim().slice(0, 40)
      : "";

  const db = getAdminClient();
  // Tarifs authoritaires depuis la base (on ne fait pas confiance au client)
  const ids = items.map((i) => i.id as string);
  const { data: prods } = await db
    .from("products")
    .select("id, name, price_cents, active")
    .eq("business_id", business.id)
    .in("id", ids);
  const byId = new Map((prods ?? []).map((p) => [p.id, p]));

  const lines: { name: string; qty: number; price_cents: number }[] = [];
  let total = 0;
  for (const it of items) {
    const p = byId.get(it.id as string);
    if (!p || !p.active) continue;
    const qty = it.qty as number;
    lines.push({ name: p.name, qty, price_cents: p.price_cents });
    total += p.price_cents * qty;
  }
  if (lines.length === 0) {
    return Response.json({ error: "product_unavailable" }, { status: 400 });
  }

  const code = pickupCode();
  const baseInsert: Record<string, unknown> = {
    business_id: business.id,
    code,
    customer_name: name,
    customer_phone: "",
    pickup_at: serviceMode === "sur_place" ? "Sur place" : "Dès que possible",
    note: null,
    items: lines,
    total_cents: total,
    status: "new",
  };
  const optional: Record<string, unknown> = {
    ...baseInsert,
    service_mode: serviceMode,
  };
  if (tableLabel) optional.table_label = tableLabel;
  let { error } = await db.from("orders").insert(optional);
  if (error) {
    ({ error } = await db.from("orders").insert(baseInsert));
  }
  if (error) return Response.json({ error: "save_failed" }, { status: 500 });

  // Alerte push sur les autres appareils du commerçant (comme une commande web)
  try {
    await sendPushToBusiness(db, business.id, {
      title: "🧾 Commande caisse enregistrée",
      body: `${name} · ${(total / 100).toFixed(2)} €`,
      url: "/dashboard/orders",
    });
  } catch {
    /* best effort */
  }

  return Response.json({ ok: true, code, total_cents: total });
}
