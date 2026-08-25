import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { spamCheck } from "@/lib/prospection/spam";
import { regenerateProspectMessages, type RegenTarget } from "@/lib/prospection/regenerate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Génère (ou régénère) les messages email + DM d'un prospect — story C2.
 * Rafraîchit les brouillons ET les messages approuvés non envoyés (garde leur
 * statut) ; ne touche jamais aux messages envoyés. Renvoie une alerte anti-spam.
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

    const { email } = await regenerateProspectMessages(db, p as RegenTarget);

    await db
      .from("prospect_events")
      .insert({ prospect_id: id, type: "messages_generated", meta: {} });

    const spam = spamCheck(`${email.subject}\n${email.body}`);
    return Response.json({ ok: true, spam });
  },
});
