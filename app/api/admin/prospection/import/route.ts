import { z } from "zod";
import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { PROSPECT_SEGMENTS } from "@/lib/prospection/types";
import { scoreProspect } from "@/lib/prospection/score";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Une ligne de CSV importée (déjà découpée en colonnes côté client).
const rowSchema = z.object({
  name: z.string().min(1).max(200),
  city: z.string().max(100).optional(),
  category: z.string().max(40).optional(),
  email: z.string().max(200).optional(),
  instagram_handle: z.string().max(100).optional(),
  website: z.string().max(300).optional(),
  google_rating: z.number().min(0).max(5).nullable().optional(),
  google_reviews_count: z.number().int().min(0).nullable().optional(),
});

const schema = z.object({
  rows: z.array(rowSchema).min(1).max(1000),
});

const SEGMENT_SET = new Set<string>(PROSPECT_SEGMENTS);

/** Nettoie une chaîne : trim + null si vide. */
function clean(s?: string | null): string | null {
  const t = (s ?? "").trim();
  return t === "" ? null : t;
}

/** Normalise un segment libre vers un segment connu, sinon « autre ». */
function normSegment(s?: string | null): (typeof PROSPECT_SEGMENTS)[number] {
  const v = (s ?? "").trim().toLowerCase();
  return SEGMENT_SET.has(v) ? (v as (typeof PROSPECT_SEGMENTS)[number]) : "autre";
}

/**
 * Import CSV de prospects (admin). Les lignes sont déjà découpées côté client.
 * Déduplique par email (contre les prospects existants + la liste de
 * suppression) et par nom+ville (insensible à la casse). Ne devine jamais
 * d'email : on n'insère que ce qui est fourni. Best-effort, idempotent.
 */
export const POST = adminRoute({
  schema,
  handler: async ({ body }) => {
    const db = getAdminClient();

    // Prépare les lignes candidates (nettoyage + normalisation).
    type Candidate = {
      name: string;
      city: string | null;
      category: (typeof PROSPECT_SEGMENTS)[number];
      email: string | null;
      instagram_handle: string | null;
      website: string | null;
      google_rating: number | null;
      google_reviews_count: number | null;
    };
    const candidates: Candidate[] = body.rows.map((r) => ({
      name: r.name.trim(),
      city: clean(r.city),
      category: normSegment(r.category),
      email: clean(r.email)?.toLowerCase() ?? null,
      instagram_handle: clean(r.instagram_handle)?.replace(/^@/, "").replace(/^.*instagram\.com\//i, "").replace(/\/.*$/, "") || null,
      website: clean(r.website),
      google_rating: r.google_rating ?? null,
      google_reviews_count: r.google_reviews_count ?? null,
    }));

    // --- Dédup contre l'existant ---
    const emails = [...new Set(candidates.map((c) => c.email).filter(Boolean) as string[])];

    const existingEmails = new Set<string>();
    if (emails.length > 0) {
      const { data: ex } = await db.from("prospects").select("email").in("email", emails);
      for (const r of ex ?? []) if (r.email) existingEmails.add((r.email as string).toLowerCase());
      const { data: sup } = await db
        .from("suppression_list")
        .select("email")
        .in("email", emails);
      for (const r of sup ?? []) if (r.email) existingEmails.add((r.email as string).toLowerCase());
    }

    // Dédup nom+ville : on récupère les couples existants pour les villes concernées.
    const cities = [...new Set(candidates.map((c) => c.city).filter(Boolean) as string[])];
    const existingNameCity = new Set<string>();
    const nameCityKey = (name: string, city: string | null) =>
      `${name.trim().toLowerCase()}|${(city ?? "").trim().toLowerCase()}`;
    if (candidates.length > 0) {
      const q = db.from("prospects").select("name, city").limit(5000);
      const { data: ex } = cities.length > 0 ? await q.in("city", cities) : await q;
      for (const r of ex ?? [])
        existingNameCity.add(nameCityKey(r.name as string, (r.city as string) ?? null));
    }

    // --- Filtrage : doublons + dédup interne au fichier ---
    let duplicates = 0;
    const seenEmail = new Set<string>();
    const seenNameCity = new Set<string>();
    const toInsert = candidates.filter((c) => {
      if (c.email) {
        if (existingEmails.has(c.email) || seenEmail.has(c.email)) {
          duplicates++;
          return false;
        }
      }
      const key = nameCityKey(c.name, c.city);
      if (existingNameCity.has(key) || seenNameCity.has(key)) {
        duplicates++;
        return false;
      }
      if (c.email) seenEmail.add(c.email);
      seenNameCity.add(key);
      return true;
    });

    if (toInsert.length === 0) {
      return Response.json({ ok: true, received: body.rows.length, inserted: 0, duplicates });
    }

    const rows = toInsert.map((c) => {
      const { score, factors } = scoreProspect({
        google_reviews_count: c.google_reviews_count,
        google_rating: c.google_rating,
        google_last_review_at: null,
        instagram_active: c.instagram_handle ? true : null,
        email: c.email,
      });
      return {
        name: c.name,
        city: c.city,
        category: c.category,
        email: c.email,
        instagram_handle: c.instagram_handle,
        instagram_active: c.instagram_handle ? true : null,
        website: c.website,
        google_rating: c.google_rating,
        google_reviews_count: c.google_reviews_count,
        score,
        score_factors: { factors },
        status: "new" as const,
      };
    });

    const { data: ins, error } = await db.from("prospects").insert(rows).select("id");
    if (error) return Response.json({ error: "insert_failed" }, { status: 500 });

    const inserted = ins?.length ?? 0;
    if (ins && ins.length > 0) {
      await db.from("prospect_events").insert(
        ins.map((r) => ({ prospect_id: r.id as string, type: "sourced", meta: { imported: true } }))
      );
    }

    return Response.json({ ok: true, received: body.rows.length, inserted, duplicates });
  },
});
