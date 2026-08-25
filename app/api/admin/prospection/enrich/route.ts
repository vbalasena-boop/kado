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
 * Enrichissement (admin) — story A4, cascade 0 € inspirée du workflow OndéOndé.
 * Pour chaque prospect ayant un site mais pas encore d'email ET/OU d'Instagram,
 * lit le site (accueil + pages contact) pour en déduire les 2 signaux, met à
 * jour la fiche (sans écraser l'existant), trace la source et recalcule le score.
 * Les avis Google (nb/note) restent le signal central, capturés au sourcing.
 */
export const POST = adminRoute({
  schema,
  handler: async ({ body }) => {
    const limit = body?.limit ?? 15;
    const db = getAdminClient();

    // Prospects avec un site, à qui il manque l'email OU l'Instagram.
    const { data, error } = await db
      .from("prospects")
      .select(
        "id, website, email, instagram_handle, google_rating, google_reviews_count, google_last_review_at"
      )
      .not("website", "is", null)
      .or("email.is.null,instagram_handle.is.null")
      .limit(limit);
    if (error) return Response.json({ error: "db_error" }, { status: 500 });

    const rows = (data ?? []) as Row[];
    let enriched = 0;
    let emailsFound = 0;
    let instaFound = 0;

    for (const r of rows) {
      const contact = await enrichWebsite(r.website);

      // On ne remplit que ce qui manque (jamais d'écrasement).
      const newEmail = !r.email && contact.email ? contact.email : null;
      const newInsta =
        !r.instagram_handle && contact.instagram ? contact.instagram : null;
      if (!newEmail && !newInsta) continue;

      const email = r.email ?? newEmail;
      const instagram_handle = r.instagram_handle ?? newInsta;
      const instagram_active = instagram_handle ? true : r.instagram_handle ? true : null;

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
      if (newEmail) emailsFound++;
      if (newInsta) instaFound++;

      // Traçabilité de la source (comme les "etage" du workflow d'inspiration).
      await db.from("prospect_events").insert({
        prospect_id: r.id,
        type: "enriched",
        meta: {
          email_found: Boolean(newEmail),
          instagram_found: Boolean(newInsta),
          source: "site_web",
        },
      });
    }

    return Response.json({
      ok: true,
      scanned: rows.length,
      enriched,
      emails_found: emailsFound,
      instagram_found: instaFound,
    });
  },
});
