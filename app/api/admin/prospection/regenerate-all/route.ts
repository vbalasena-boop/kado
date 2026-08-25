import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { NON_CONTACTABLE_STATUSES, type ProspectStatus } from "@/lib/prospection/types";
import { regenerateProspectMessages, type RegenTarget } from "@/lib/prospection/regenerate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Row = RegenTarget & { status: ProspectStatus };

/**
 * Régénère les messages (email + DM) de TOUS les prospects contactables, avec
 * la dernière version des gabarits. Rafraîchit les BROUILLONS et les messages
 * APPROUVÉS non envoyés (statut conservé) ; ne touche jamais aux ENVOYÉS. Admin.
 */
export const POST = adminRoute({
  handler: async () => {
    const db = getAdminClient();
    const { data, error } = await db
      .from("prospects")
      .select("id, name, city, category, google_reviews_count, status")
      .limit(1000);
    if (error) return Response.json({ error: "db_error" }, { status: 500 });

    const rows = ((data ?? []) as Row[]).filter(
      (r) => !NON_CONTACTABLE_STATUSES.includes(r.status)
    );

    let regenerated = 0;
    for (const p of rows) {
      try {
        await regenerateProspectMessages(db, p);
        regenerated++;
      } catch {
        // On continue les autres prospects même si l'un échoue.
      }
    }

    return Response.json({ ok: true, regenerated });
  },
});
