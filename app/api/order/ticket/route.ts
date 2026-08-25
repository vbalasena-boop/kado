import { z } from "zod";
import { publicRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { hasAccess, hasComptoir } from "@/lib/auth";
import { sendPushToBusiness } from "@/lib/push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Schéma permissif : la validation métier (présence, slice) reste dans le handler.
const Body = z.object({
  slug: z.string().optional(),
});

function pickupCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * « Bipeur digital » : un client scanne le QR de suivi posé au comptoir.
 * Kado lui attribue un numéro (remis à zéro chaque jour) et crée un ticket
 * de suivi. Le client suit ensuite sa commande et active l'alerte.
 * POST /api/order/ticket  { slug }  ->  { code, number }
 */
export const POST = publicRoute({
  schema: Body,
  rateLimit: { key: ({ ip }) => `oticket:${ip}`, limit: 10, windowSeconds: 60 },
  handler: async ({ body }) => {
    const slug = String(body.slug ?? "").trim().slice(0, 80);
    if (!slug) return Response.json({ error: "bad_request" }, { status: 400 });

    const db = getAdminClient();
    let biz: any = null;
    try {
      const { data } = await db
        .from("businesses")
        .select(
          "id, status, subscription_status, subscription_ends_at, order_tracking, plan"
        )
        .eq("slug", slug)
        .maybeSingle();
      biz = data;
    } catch {
      const { data } = await db
        .from("businesses")
        .select("id, status, subscription_status, subscription_ends_at, plan")
        .eq("slug", slug)
        .maybeSingle();
      biz = data;
    }
    if (!biz) return Response.json({ error: "not_found" }, { status: 404 });
    if (!hasAccess(biz)) {
      return Response.json({ error: "unavailable" }, { status: 403 });
    }
    // Option activée, incluse dans le plan « Comptoir », ou essai gratuit.
    if (!hasComptoir(biz)) {
      return Response.json({ error: "disabled" }, { status: 403 });
    }

    // Numéro du jour (remise à zéro chaque jour) — lecture tolérante.
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    let number: number | null = null;
    try {
      const { data: last, error } = await db
        .from("orders")
        .select("buzzer_no")
        .eq("business_id", (biz as any).id)
        .gte("created_at", startOfDay.toISOString())
        .not("buzzer_no", "is", null)
        .order("buzzer_no", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error) number = (((last as any)?.buzzer_no as number) ?? 0) + 1;
    } catch {
      number = null; // colonne absente
    }

    const code = pickupCode();
    const base: Record<string, unknown> = {
      business_id: (biz as any).id,
      code,
      customer_name: number ? `N° ${number}` : "Suivi",
      customer_phone: "",
      pickup_at: "Sur place",
      note: null,
      items: [],
      total_cents: 0,
      status: "new",
    };
    const optional: Record<string, unknown> = { ...base, service_mode: "buzzer" };
    if (number != null) optional.buzzer_no = number;

    let { error } = await db.from("orders").insert(optional);
    if (error) {
      ({ error } = await db.from("orders").insert(base));
    }
    if (error) return Response.json({ error: "save_failed" }, { status: 500 });

    // Alerte au commerçant (comme une nouvelle commande)
    try {
      await sendPushToBusiness(db, (biz as any).id, {
        title: "🎫 Nouveau suivi client",
        body: number ? `Numéro ${number} en attente` : "Un client suit sa commande",
        url: "/dashboard/orders",
      });
    } catch {
      /* best effort */
    }

    return Response.json({ ok: true, code, number });
  },
});
