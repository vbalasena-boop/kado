import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Supprime UN prospect (admin), avec ses messages/événements en cascade.
 * Irréversible. Utilisé depuis la fiche du prospect.
 */
export const POST = adminRoute({
  handler: async ({ params }) => {
    const id = params.id;
    if (!id) return Response.json({ error: "missing_id" }, { status: 400 });

    const db = getAdminClient();
    const { error, count } = await db
      .from("prospects")
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) return Response.json({ error: "delete_failed" }, { status: 500 });
    if (!count) return Response.json({ error: "not_found" }, { status: 404 });

    return Response.json({ ok: true, deleted: count });
  },
});
