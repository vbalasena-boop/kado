import { z } from "zod";
import { publicRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { sanitizeFeedback } from "@/lib/feedback";
import { sendPushToBusiness } from "@/lib/push";

export const dynamic = "force-dynamic";

const Body = z.object({
  slug: z.string().optional(),
  message: z.string().optional(),
  email: z.string().optional(),
});

/**
 * Recueille un feedback PRIVÉ laissé par un client (avant tout avis public).
 * Ouvert à tous ; nécessite que le commerçant ait activé `feedback_enabled`.
 * Alerte le commerçant (push best-effort) pour qu'il rattrape le client.
 */
export const POST = publicRoute({
  schema: Body,
  rateLimit: { key: ({ ip }) => `feedback:${ip}`, limit: 6, windowSeconds: 60 },
  handler: async ({ body }) => {
    const slug = String(body.slug ?? "").trim();
    const clean = sanitizeFeedback({ message: body.message, email: body.email });
    if (!slug || !clean.ok) {
      return Response.json({ error: "missing" }, { status: 400 });
    }

    const db = getAdminClient();
    const { data: biz } = await db
      .from("businesses")
      .select("id, name")
      .eq("slug", slug)
      .maybeSingle();
    if (!biz) return Response.json({ error: "not_found" }, { status: 404 });

    // Fonctionnalité activée ? (colonne 0071 absente → lecture tolérante = off)
    let enabled = false;
    try {
      const { data: cfg } = await db
        .from("wheel_configs")
        .select("feedback_enabled")
        .eq("business_id", (biz as any).id)
        .maybeSingle();
      enabled = !!(cfg as any)?.feedback_enabled;
    } catch {
      enabled = false;
    }
    if (!enabled) return Response.json({ error: "disabled" }, { status: 404 });

    const { error } = await db.from("feedback").insert({
      business_id: (biz as any).id,
      message: clean.message,
      email: clean.email,
    });
    if (error) return Response.json({ error: "save_failed" }, { status: 500 });

    // Alerte commerçant (best-effort, jamais bloquante).
    try {
      await sendPushToBusiness(db, (biz as any).id, {
        title: "💬 Nouveau retour client",
        body: clean.message.slice(0, 140),
        url: "/dashboard/feedback",
      });
    } catch {
      /* le push ne doit pas faire échouer l'enregistrement */
    }

    return Response.json({ ok: true });
  },
});
