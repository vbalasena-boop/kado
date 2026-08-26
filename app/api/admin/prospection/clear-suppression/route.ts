import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Vide la liste de suppression (admin) — utilitaire de nettoyage.
 * Utile pour repartir propre après des faux bounces / tests. À utiliser avec
 * précaution : ces adresses ne devaient normalement plus être recontactées.
 */
export const POST = adminRoute({
  handler: async () => {
    const db = getAdminClient();
    const { error, count } = await db
      .from("suppression_list")
      .delete({ count: "exact" })
      .not("email", "is", null);
    if (error) return Response.json({ error: "delete_failed" }, { status: 500 });
    return Response.json({ ok: true, deleted: count ?? 0 });
  },
});
