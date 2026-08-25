import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { renderEmail, renderDm } from "@/lib/prospection/templates";
import { spamCheck } from "@/lib/prospection/spam";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = {
  id: string;
  name: string;
  city: string | null;
  category: string | null;
  google_reviews_count: number | null;
};

/**
 * Génère (ou régénère) les messages email + DM d'un prospect — story C2.
 * Remplace uniquement les brouillons (status 'draft') ; ne touche pas aux
 * messages approuvés/envoyés. Renvoie aussi une alerte anti-spam (C3).
 */
export const POST = adminRoute({
  handler: async ({ params }) => {
    const id = params.id;
    if (!id) return Response.json({ error: "missing_id" }, { status: 400 });

    const db = getAdminClient();
    const { data: p, error } = await db
      .from("prospects")
      .select("id, name, city, category, google_reviews_count")
      .eq("id", id)
      .single();
    if (error || !p) return Response.json({ error: "not_found" }, { status: 404 });

    const prospect = p as Row;
    const ctx = {
      name: prospect.name,
      city: prospect.city,
      category: prospect.category,
      google_reviews_count: prospect.google_reviews_count,
    };
    const email = renderEmail(ctx);
    const dm = renderDm(ctx);

    // Remplace les brouillons existants (garde approuvés/envoyés).
    await db
      .from("prospect_messages")
      .delete()
      .eq("prospect_id", id)
      .eq("status", "draft");

    const { error: insErr } = await db.from("prospect_messages").insert([
      { prospect_id: id, channel: "email", step: 1, subject: email.subject, body: email.body, status: "draft" },
      { prospect_id: id, channel: "instagram", step: 1, body: dm, status: "draft" },
    ]);
    if (insErr) return Response.json({ error: "insert_failed" }, { status: 500 });

    await db
      .from("prospect_events")
      .insert({ prospect_id: id, type: "messages_generated", meta: {} });

    const spam = spamCheck(`${email.subject}\n${email.body}`);
    return Response.json({ ok: true, spam });
  },
});
