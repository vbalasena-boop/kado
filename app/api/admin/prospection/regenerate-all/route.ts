import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { renderEmail, renderDm } from "@/lib/prospection/templates";
import { NON_CONTACTABLE_STATUSES, type ProspectStatus } from "@/lib/prospection/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Row = {
  id: string;
  name: string;
  city: string | null;
  category: string | null;
  google_reviews_count: number | null;
  status: ProspectStatus;
};

/**
 * Régénère les messages (email + DM) de TOUS les prospects contactables, avec
 * la dernière version des gabarits. Ne touche qu'aux BROUILLONS (garde les
 * messages approuvés/envoyés). Admin.
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
      const ctx = {
        name: p.name,
        city: p.city,
        category: p.category,
        google_reviews_count: p.google_reviews_count,
        seed: p.id,
      };
      const email = renderEmail(ctx);
      const dm = renderDm(ctx);

      // Remplace les brouillons (garde approuvés/envoyés).
      await db
        .from("prospect_messages")
        .delete()
        .eq("prospect_id", p.id)
        .eq("status", "draft");

      const { error: insErr } = await db.from("prospect_messages").insert([
        { prospect_id: p.id, channel: "email", step: 1, subject: email.subject, body: email.body, status: "draft" },
        { prospect_id: p.id, channel: "instagram", step: 1, body: dm, status: "draft" },
      ]);
      if (!insErr) regenerated++;
    }

    return Response.json({ ok: true, regenerated });
  },
});
