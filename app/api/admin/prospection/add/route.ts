import { z } from "zod";
import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { PROSPECT_SEGMENTS } from "@/lib/prospection/types";
import { scoreProspect } from "@/lib/prospection/score";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(1).max(200),
  city: z.string().max(100).optional(),
  category: z.enum(PROSPECT_SEGMENTS).optional(),
  email: z.string().max(200).optional(),
  instagram_handle: z.string().max(100).optional(),
  google_rating: z.number().min(0).max(5).optional(),
  google_reviews_count: z.number().int().min(0).optional(),
  website: z.string().max(300).optional(),
});

/** Ajoute un prospect saisi à la main (admin). Score calculé à l'insertion. */
export const POST = adminRoute({
  schema,
  handler: async ({ body }) => {
    const clean = (s?: string) => {
      const t = (s ?? "").trim();
      return t === "" ? null : t;
    };
    const email = clean(body.email)?.toLowerCase() ?? null;
    const instagram_handle = clean(body.instagram_handle)?.replace(/^@/, "") ?? null;

    const { score, factors } = scoreProspect({
      google_reviews_count: body.google_reviews_count ?? null,
      google_rating: body.google_rating ?? null,
      google_last_review_at: null,
      instagram_active: instagram_handle ? true : null,
      email,
    });

    const db = getAdminClient();
    const { data, error } = await db
      .from("prospects")
      .insert({
        name: body.name.trim(),
        city: clean(body.city),
        category: body.category ?? "autre",
        email,
        instagram_handle,
        instagram_active: instagram_handle ? true : null,
        website: clean(body.website),
        google_rating: body.google_rating ?? null,
        google_reviews_count: body.google_reviews_count ?? null,
        score,
        score_factors: { factors },
        status: "new",
      })
      .select("id")
      .single();
    if (error) return Response.json({ error: "insert_failed" }, { status: 500 });

    await db
      .from("prospect_events")
      .insert({ prospect_id: data.id, type: "sourced", meta: { manual: true } });

    return Response.json({ ok: true, id: data.id });
  },
});
