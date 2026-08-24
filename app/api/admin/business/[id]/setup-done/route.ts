import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Marque l'installation clé en main d'un établissement comme réalisée. */
export const POST = adminRoute({
  handler: async ({ params }) => {
    const db = getAdminClient();
    const { error } = await db
      .from("businesses")
      .update({ setup_done_at: new Date().toISOString() })
      .eq("id", params.id);
    if (error) return Response.json({ error: "update_failed" }, { status: 500 });

    return Response.json({ ok: true });
  },
});
