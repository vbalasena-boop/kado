import { z } from "zod";
import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({ mode: z.enum(["demo", "all"]) });

/**
 * Supprime des prospects (admin) — utilitaire de nettoyage.
 * - mode "demo" : uniquement les données de démonstration (place_id "mock…").
 * - mode "all"  : tous les prospects (messages/événements supprimés en cascade).
 */
export const POST = adminRoute({
  schema,
  handler: async ({ body }) => {
    const db = getAdminClient();
    const q = db.from("prospects").delete({ count: "exact" });
    const query =
      body.mode === "demo"
        ? q.ilike("place_id", "mock%")
        : q.not("id", "is", null);

    const { error, count } = await query;
    if (error) return Response.json({ error: "delete_failed" }, { status: 500 });

    return Response.json({ ok: true, deleted: count ?? 0 });
  },
});
