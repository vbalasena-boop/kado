import { z } from "zod";
import { publicRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const Body = z.object({
  slug: z.string().optional(),
  code: z.string().optional(),
});

/**
 * Le client confirme avoir récupéré sa commande (bouton sur la page de suivi).
 * Marque `picked_up_at` et passe la commande à « remise » (uniquement depuis
 * « prête », pour ne pas court-circuiter une commande non préparée). Ferme la
 * boucle : le commerçant la voit terminée, et aucun rappel ne partira.
 */
export const POST = publicRoute({
  schema: Body,
  rateLimit: { key: ({ ip }) => `opickup:${ip}`, limit: 20, windowSeconds: 60 },
  handler: async ({ body }) => {
    const slug = String(body.slug ?? "").trim().slice(0, 80);
    const code = String(body.code ?? "").trim().toUpperCase().slice(0, 12);
    if (!slug || !code) {
      return Response.json({ error: "bad_request" }, { status: 400 });
    }

    const db = getAdminClient();
    const { data: biz } = await db
      .from("businesses")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!biz) return Response.json({ error: "not_found" }, { status: 404 });

    const { data: order } = await db
      .from("orders")
      .select("id, status")
      .eq("business_id", (biz as any).id)
      .eq("code", code)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!order) return Response.json({ error: "not_found" }, { status: 404 });

    // Confirmation possible seulement depuis « prête » (idempotent si déjà remise).
    if ((order as any).status !== "ready" && (order as any).status !== "done") {
      return Response.json({ error: "not_ready" }, { status: 409 });
    }

    // Tolérant : colonne 0070 absente → on marque au moins « remise ».
    const nowIso = new Date().toISOString();
    let { error } = await db
      .from("orders")
      .update({ status: "done", picked_up_at: nowIso })
      .eq("id", (order as any).id)
      .eq("business_id", (biz as any).id);
    if (error) {
      ({ error } = await db
        .from("orders")
        .update({ status: "done" })
        .eq("id", (order as any).id)
        .eq("business_id", (biz as any).id));
      if (error) return Response.json({ error: "save_failed" }, { status: 500 });
    }
    return Response.json({ ok: true, status: "done" });
  },
});
