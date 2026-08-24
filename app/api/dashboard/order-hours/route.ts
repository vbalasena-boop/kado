import { z } from "zod";
import { merchantRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { sanitizeHours } from "@/lib/hours";

export const dynamic = "force-dynamic";

const Body = z.object({ hours: z.unknown().optional() });

/** Enregistre les horaires de commande du commerçant connecté. */
export const POST = merchantRoute({
  schema: Body,
  handler: async ({ body, business }) => {
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
  },
});
