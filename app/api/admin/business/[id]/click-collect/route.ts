import { z } from "zod";
import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const Body = z.object({
  enable: z.any().optional(),
});

/**
 * Active/désactive le module Click & collect pour un établissement.
 * Réservé à l'admin : le commerçant ne peut pas l'activer lui-même (bêta).
 */
export const POST = adminRoute({
  schema: Body,
  handler: async ({ body, params }) => {
    const { error } = await getAdminClient()
      .from("businesses")
      .update({ click_collect: !!body.enable })
      .eq("id", params.id);
    if (error) {
      return Response.json(
        { error: "update_failed", detail: error.message },
        { status: 500 }
      );
    }

    return Response.json({ ok: true, enabled: !!body.enable });
  },
});
