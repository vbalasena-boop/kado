import { z } from "zod";
import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { enrichWebsite } from "@/lib/prospection/enrich";
import { scoreProspect } from "@/lib/prospection/score";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z
  .object({ limit: z.number().int().min(1).max(30).optional() })
  .optional();

type Row = {
  id: string;
  website: string | null;
  email: string | null;
  instagram_handle: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  google_last_review_at: string | null;
};

/**
 * Enrichissement contact (admin) — story A4.
 * Pour les prospects ayant un site mais pas encore d'email/Instagram, tente de
 * les déduire du site web, met à jour la fiche et recalcule le score.
 */
export const POST = adminRoute({
  schema,
  handler: async ({ body }) => {
    const limit = body?.limit ?? 15;
    const db = getAdminClient();

    const { data, error } = await db
      .from("prospects")
      .select(
        "id, website, email, instagram_handle, google_rating, google_reviews_count, google_last_review_at"
      )
      .not("website", "is", null)
      .is("email", null)
      .limit(limit);
    if (error) return Response.json({ error: "db_error" }, { status: 500 });

    const rows = (data ?? []) as Row[];
    let enriched = 0;

    for (const r of rows) {
      const contact = await enrichWebsite(r.website);
      if (!contact.email && !contact.instagram) continue;

      const email = r.email ?? contact.email;
      const instagram_handle = r.instagram_handle ?? contact.instagram;
      const instagram_active = instagram_handle ? true : null;

      const { score, factors } = scoreProspect({
        google_reviews_count: r.google_reviews_count,
        google_rating: r.google_rating,
        google_last_review_at: r.google_last_review_at,
        instagram_active,
        email,
      });

      const { error: upErr } = await db
        .from("prospects")
        .update({
          email,
          instagram_handle,
          instagram_active,
          score,
          score_factors: { factors },
          updated_at: new Date().toISOString(),
        })
        .eq("id", r.id);
      if (upErr) continue;

      enriched++;
      await db
        .from("prospect_events")
        .insert({ prospect_id: r.id, type: "enriched", meta: { email: Boolean(email), instagram: Boolean(instagram_handle) } });
    }

    return Response.json({ ok: true, scanned: rows.length, enriched });
  },
});
