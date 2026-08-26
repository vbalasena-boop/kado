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
  // Une ou plusieurs villes séparées par des virgules / points-virgules / retours.
  city: z.string().min(1).max(300),
  segments: z.array(z.enum(PROSPECT_SEGMENTS)).min(1),
  limit: z.number().int().min(1).max(120).optional(),
});

type Db = ReturnType<typeof getAdminClient>;

/** Source une seule ville : recherche → dédup → insertion. Best-effort. */
async function sourceOneCity(
  db: Db,
  city: string,
  segments: (typeof PROSPECT_SEGMENTS)[number][],
  limit?: number
): Promise<{ found: number; inserted: number; duplicates: number; mock: boolean }> {
  const { prospects, mock } = await searchProspects({ city, segments, limit });
  if (prospects.length === 0) return { found: 0, inserted: 0, duplicates: 0, mock };

  const placeIds = prospects.map((p) => p.place_id);
  const { data: existing } = await db.from("prospects").select("place_id").in("place_id", placeIds);
  const existingIds = new Set((existing ?? []).map((r) => r.place_id as string));
  const { toInsert, duplicates } = partitionNew(prospects, existingIds);

  let inserted = 0;
  if (toInsert.length > 0) {
    const rows = toInsert.map((p) => {
      const { score, factors } = scoreProspect({
        google_reviews_count: p.google_reviews_count,
        google_rating: p.google_rating,
        google_last_review_at: null,
        instagram_active: null,
        email: null,
      });
      return { ...toRow(p), score, score_factors: { factors } };
    });
    const { data: ins } = await db.from("prospects").insert(rows).select("id");
    inserted = ins?.length ?? 0;
    if (ins && ins.length > 0) {
      await db.from("prospect_events").insert(
        ins.map((r) => ({ prospect_id: r.id as string, type: "sourced", meta: { city } }))
      );
    }
  }
  return { found: prospects.length, inserted, duplicates: duplicates.length, mock };
}

/** Découpe la saisie en villes uniques (virgule / point-virgule / retour ligne). */
function parseCities(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;\n]/)) {
    const c = part.trim();
    const key = c.toLowerCase();
    if (c && !seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
  }
  return out.slice(0, 5); // garde-fou : 5 villes max par passage
}

/**
 * Sourcing de prospects (admin uniquement) — mono ou MULTI-villes.
 * Cherche les commerces via Google Places (ou mode démo sans clé), déduplique
 * par `place_id` (aussi entre villes), insère les nouveaux et journalise.
 */
export const POST = adminRoute({
  schema,
  handler: async ({ body }) => {
    const cities = parseCities(body.city);
    if (cities.length === 0) {
      return Response.json({ ok: true, mock: false, found: 0, inserted: 0, duplicates: 0, cities: [] });
    }

    const db = getAdminClient();
    let found = 0;
    let inserted = 0;
    let duplicates = 0;
    let mock = false;
    const perCity: { city: string; inserted: number; duplicates: number }[] = [];

    for (const city of cities) {
      const r = await sourceOneCity(db, city, body.segments, body.limit);
      found += r.found;
      inserted += r.inserted;
      duplicates += r.duplicates;
      mock = mock || r.mock;
      perCity.push({ city, inserted: r.inserted, duplicates: r.duplicates });
    }

    return Response.json({ ok: true, mock, found, inserted, duplicates, cities: perCity });
  },
});
