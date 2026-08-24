import { z } from "zod";
import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const Body = z.object({
  status: z.enum(["active", "suspended"]).optional(),
  subscription_status: z.enum(["trial", "active", "suspended"]).optional(),
});

/** Active ou suspend un établissement (donne / retire l'accès). */
export const POST = adminRoute({
  schema: Body,
  handler: async ({ body, params }) => {
    const patch: Record<string, string> = {};
    if (body.status) {
      patch.status = body.status;
      // suspendre l'accès suspend aussi l'abonnement ; réactiver le repasse actif
      patch.subscription_status =
        body.status === "suspended" ? "suspended" : "active";
    }
    if (body.subscription_status) {
      patch.subscription_status = body.subscription_status;
    }
    if (Object.keys(patch).length === 0) {
      return Response.json({ error: "nothing_to_update" }, { status: 400 });
    }

    const db = getAdminClient();
    const { error } = await db
      .from("businesses")
      .update(patch)
      .eq("id", params.id);
    if (error) {
      return Response.json({ error: "update_failed" }, { status: 500 });
    }

    return Response.json({ ok: true });
  },
});
