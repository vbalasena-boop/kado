import { z } from "zod";
import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { PROSPECT_SEGMENTS } from "@/lib/prospection/types";
import { searchProspects } from "@/lib/prospection/places";
import { toRow, partitionNew } from "@/lib/prospection/source";
import { scoreProspect } from "@/lib/prospection/score";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  city: z.string().min(1).max(100),
  segments: z.array(z.enum(PROSPECT_SEGMENTS)).min(1),
  limit: z.number().int().min(1).max(120).optional(),
});

/**
 * Sourcing de prospects (admin uniquement).
 * Cherche les commerces d'une ville via Google Places (ou mode démo sans clé),
 * déduplique par `place_id`, insère les nouveaux et journalise l'événement.
 */
export const POST = adminRoute({
  schema,
  handler: async ({ body }) => {
    const { prospects, mock } = await searchProspects({
      city: body.city,
      segments: body.segments,
      limit: body.limit,
    });

    if (prospects.length === 0) {
      return Response.json({ ok: true, mock, found: 0, inserted: 0, duplicates: 0 });
    }

    const db = getAdminClient();
    const placeIds = prospects.map((p) => p.place_id);

    const { data: existing, error: exErr } = await db
      .from("prospects")
      .select("place_id")
      .in("place_id", placeIds);
    if (exErr) return Response.json({ error: "db_error" }, { status: 500 });

    const existingIds = new Set((existing ?? []).map((r) => r.place_id as string));
    const { toInsert, duplicates } = partitionNew(prospects, existingIds);

    let inserted = 0;
    if (toInsert.length > 0) {
      const rows = toInsert.map((p) => {
        // Signaux non encore enrichis au sourcing (email/Insta/fraîcheur → A4).
        const { score, factors } = scoreProspect({
          google_reviews_count: p.google_reviews_count,
          google_rating: p.google_rating,
          google_last_review_at: null,
          instagram_active: null,
          email: null,
        });
        return { ...toRow(p), score, score_factors: { factors } };
      });
      const { data: ins, error: insErr } = await db
        .from("prospects")
        .insert(rows)
        .select("id");
      if (insErr) return Response.json({ error: "insert_failed" }, { status: 500 });
      inserted = ins?.length ?? 0;

      if (ins && ins.length > 0) {
        // Journal d'audit (best-effort : n'échoue pas la requête si ça rate).
        await db.from("prospect_events").insert(
          ins.map((r) => ({
            prospect_id: r.id as string,
            type: "sourced",
            meta: { city: body.city },
          }))
        );
      }
    }

    return Response.json({
      ok: true,
      mock,
      found: prospects.length,
      inserted,
      duplicates: duplicates.length,
    });
  },
});
