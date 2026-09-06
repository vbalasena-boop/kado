import { z } from "zod";
import { publicRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { sendPushToBusiness } from "@/lib/push";

export const dynamic = "force-dynamic";

const Body = z.object({
  slug: z.string().optional(),
  code: z.string().optional(),
});

/**
 * Le client signale qu'il est ARRIVÉ pour récupérer sa commande (bouton sur la
 * page de suivi). On prévient le commerçant par push (best-effort) — le comptoir
 * peut apporter la commande / la préparer à la remise. Aucune écriture en base,
 * aucune donnée personnelle ; rate-limité (par code + par IP) contre le spam.
 */
export const POST = publicRoute({
  schema: Body,
  rateLimit: { key: ({ ip }) => `oarrived:${ip}`, limit: 10, windowSeconds: 60 },
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

    // Commande existante + statut/numéro pour un message utile au comptoir.
    const { data: order } = await db
      .from("orders")
      .select("status, buzzer_no")
      .eq("business_id", (biz as any).id)
      .eq("code", code)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!order) return Response.json({ error: "not_found" }, { status: 404 });

    // Second garde-fou anti-spam : au plus une alerte / 2 min pour un code donné.
    const { rateLimit } = await import("@/lib/rate-limit");
    if (!(await rateLimit(`oarrived:code:${code}`, 1, 120))) {
      // Déjà signalé récemment : on renvoie « ok » sans re-pusher (idempotent doux).
      return Response.json({ ok: true, throttled: true });
    }

    const buzzer = (order as any).buzzer_no;
    try {
      await sendPushToBusiness(db, (biz as any).id, {
        title: "🙋 Client arrivé",
        body: `Commande ${code}${buzzer != null ? ` · n°${buzzer}` : ""} — le client est là.`,
        url: "/dashboard/orders",
      });
    } catch {
      /* le push ne doit jamais faire échouer le signalement */
    }
    return Response.json({ ok: true });
  },
});
