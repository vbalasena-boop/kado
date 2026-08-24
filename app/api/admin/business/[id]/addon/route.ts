import { z } from "zod";
import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const Body = z.object({
  enable: z.any().optional(),
});

/**
 * Active/désactive l'option Campagnes pour un établissement (admin).
 * Accès offert : ne touche PAS à la facturation Stripe du commerçant.
 */
export const POST = adminRoute({
  schema: Body,
  handler: async ({ body, params }) => {
    const { error } = await getAdminClient()
      .from("businesses")
      .update({ campaigns_addon: !!body.enable })
      .eq("id", params.id);
    if (error) return Response.json({ error: "update_failed" }, { status: 500 });

    return Response.json({ ok: true, enabled: !!body.enable });
  },
});
