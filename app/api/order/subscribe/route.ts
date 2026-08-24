import { z } from "zod";
import { publicRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Schéma permissif : la validation métier (bornes, https, présence) reste
// intégralement dans le handler.
const Body = z.object({
  slug: z.string().optional(),
  code: z.string().optional(),
  push: z
    .object({
      endpoint: z.string().optional(),
      keys: z
        .object({
          p256dh: z.string().optional(),
          auth: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

/**
 * Le client attache une alerte push à une commande existante (repérée par son
 * code) — utile pour une commande prise EN CAISSE : il scanne le QR de suivi
 * puis active les notifications. Opt-in par nature (autorisation navigateur).
 */
export const POST = publicRoute({
  schema: Body,
  rateLimit: { key: ({ ip }) => `osub:${ip}`, limit: 20, windowSeconds: 60 },
  handler: async ({ body }) => {
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
  },
});
