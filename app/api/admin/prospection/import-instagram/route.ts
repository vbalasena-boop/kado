import { z } from "zod";
import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { PROSPECT_SEGMENTS } from "@/lib/prospection/types";
import { scoreProspect } from "@/lib/prospection/score";
import {
  parseInstagramHandles,
  handleToName,
  MAX_INSTA_IMPORT,
} from "@/lib/prospection/insta-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  // Collage libre de comptes Instagram (un par ligne / virgules / URLs).
  text: z.string().min(1).max(20000),
  city: z.string().max(100).optional(),
  category: z.enum(PROSPECT_SEGMENTS).optional(),
});

/**
 * Import rapide de comptes Instagram (admin) : crée un prospect par compte,
 * en ignorant les comptes déjà présents. Rien n'est écrasé.
 */
export const POST = adminRoute({
  schema,
  handler: async ({ body }) => {
    const handles = parseInstagramHandles(body.text);
    if (handles.length === 0) {
      return Response.json({ ok: true, inserted: 0, duplicates: 0, found: 0 });
    }

    const db = getAdminClient();
    const city = (body.city ?? "").trim() || null;
    const category = body.category ?? "autre";

    // Dédup : on écarte les comptes déjà en base (insensible à la casse).
    const { data: existing } = await db
      .from("prospects")
      .select("instagram_handle")
      .not("instagram_handle", "is", null)
      .limit(10000);
    const known = new Set(
      (existing ?? []).map((r) => String(r.instagram_handle).toLowerCase())
    );

    const toInsert = handles.filter((h) => !known.has(h));
    const duplicates = handles.length - toInsert.length;

    let inserted = 0;
    if (toInsert.length > 0) {
      const rows = toInsert.map((handle) => {
        const { score, factors } = scoreProspect({
          google_reviews_count: null,
          google_rating: null,
          google_last_review_at: null,
          instagram_active: true,
          email: null,
        });
        return {
          name: handleToName(handle),
          city,
          category,
          instagram_handle: handle,
          instagram_active: true,
          status: "new" as const,
          score,
          score_factors: { factors },
        };
      });
      const { data: ins, error } = await db.from("prospects").insert(rows).select("id");
      if (error) return Response.json({ error: "insert_failed" }, { status: 500 });
      inserted = ins?.length ?? 0;
      if (ins && ins.length > 0) {
        await db.from("prospect_events").insert(
          ins.map((r) => ({
            prospect_id: r.id as string,
            type: "sourced",
            meta: { manual: true, source: "instagram_import" },
          }))
        );
      }
    }

    return Response.json({
      ok: true,
      found: handles.length,
      inserted,
      duplicates,
      capped: handles.length >= MAX_INSTA_IMPORT,
    });
  },
});
