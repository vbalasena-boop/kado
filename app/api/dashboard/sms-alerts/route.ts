import { z } from "zod";
import { merchantRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { isMissingColumnError } from "@/lib/db-errors";

export const dynamic = "force-dynamic";

const Body = z.object({ enabled: z.unknown().optional() });

/**
 * Active / désactive le SMS « votre commande est prête » (drapeau
 * businesses.sms_on_ready, migration 0078).
 *
 * Tolérant : si la colonne n'existe pas encore, on renvoie une erreur claire
 * plutôt qu'un 500 opaque, pour que l'UI invite à passer la migration.
 */
export const POST = merchantRoute({
  schema: Body,
  handler: async ({ body, business }) => {
    const enabled = !!body.enabled;
    const db = getAdminClient();
    const { error } = await db
      .from("businesses")
      .update({ sms_on_ready: enabled })
      .eq("id", business.id);
    if (error) {
      if (isMissingColumnError(error)) {
        return Response.json({ error: "migration_required" }, { status: 409 });
      }
      return Response.json({ error: "update_failed" }, { status: 500 });
    }
    return Response.json({ ok: true, enabled });
  },
});
