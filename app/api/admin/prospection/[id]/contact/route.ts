import { z } from "zod";
import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { scoreProspect } from "@/lib/prospection/score";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  email: z.string().max(200).nullable().optional(),
  instagram_handle: z.string().max(100).nullable().optional(),
});

/**
 * Saisie/édition manuelle du contact d'un prospect (admin).
 * Utile quand l'enrichissement automatique n'a rien trouvé : l'opérateur
 * complète l'email et/ou l'Instagram à la main. Le score est recalculé.
 */
export const POST = adminRoute({
  schema,
  handler: async ({ body, params }) => {
    const id = params.id;
    if (!id) return Response.json({ error: "missing_id" }, { status: 400 });
    if (body.email === undefined && body.instagram_handle === undefined) {
      return Response.json({ error: "nothing_to_update" }, { status: 400 });
    }

    const db = getAdminClient();
    const { data: p, error } = await db
      .from("prospects")
      .select(
        "email, instagram_handle, google_rating, google_reviews_count, google_last_review_at"
      )
      .eq("id", id)
      .single();
    if (error || !p) return Response.json({ error: "not_found" }, { status: 404 });

    const norm = (s: string | null): string | null => {
      const t = (s ?? "").trim();
      return t === "" ? null : t;
    };
    const email = body.email !== undefined ? norm(body.email)?.toLowerCase() ?? null : undefined;
    const handle =
      body.instagram_handle !== undefined
        ? norm(body.instagram_handle)?.replace(/^@/, "") ?? null
        : undefined;

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (email !== undefined) patch.email = email;
    if (handle !== undefined) {
      patch.instagram_handle = handle;
      patch.instagram_active = handle ? true : null;
    }

    // Recalcule le score avec les valeurs finales (édité, sinon existant).
    const finalEmail = email !== undefined ? email : (p.email as string | null);
    const finalHandle =
      handle !== undefined ? handle : (p.instagram_handle as string | null);
    const { score, factors } = scoreProspect({
      google_reviews_count: p.google_reviews_count,
      google_rating: p.google_rating,
      google_last_review_at: p.google_last_review_at,
      instagram_active: finalHandle ? true : null,
      email: finalEmail,
    });
    patch.score = score;
    patch.score_factors = { factors };

    const { error: upErr } = await db.from("prospects").update(patch).eq("id", id);
    if (upErr) return Response.json({ error: "update_failed" }, { status: 500 });

    await db
      .from("prospect_events")
      .insert({ prospect_id: id, type: "contact_edited", meta: { manual: true } });

    return Response.json({ ok: true });
  },
});
