import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { isJunkEmail, isJunkHandle } from "@/lib/prospection/enrich";
import { scoreProspect } from "@/lib/prospection/score";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Row = {
  id: string;
  email: string | null;
  instagram_handle: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  google_last_review_at: string | null;
};

/**
 * Revérifie les contacts déjà enregistrés et efface ceux qui sont invalides
 * (plateformes type privateaser/schedulista, emails d'exemple, handles cassés).
 * Recalcule le score après nettoyage.
 */
export const POST = adminRoute({
  handler: async () => {
    const db = getAdminClient();
    const { data, error } = await db
      .from("prospects")
      .select(
        "id, email, instagram_handle, google_rating, google_reviews_count, google_last_review_at"
      )
      .or("email.not.is.null,instagram_handle.not.is.null")
      .limit(1000);
    if (error) return Response.json({ error: "db_error" }, { status: 500 });

    const rows = (data ?? []) as Row[];
    let cleanedEmails = 0;
    let cleanedHandles = 0;

    for (const r of rows) {
      const badEmail = r.email != null && isJunkEmail(r.email);
      const badHandle = r.instagram_handle != null && isJunkHandle(r.instagram_handle);
      if (!badEmail && !badHandle) continue;

      const email = badEmail ? null : r.email;
      const instagram_handle = badHandle ? null : r.instagram_handle;
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

      if (badEmail) cleanedEmails++;
      if (badHandle) cleanedHandles++;
    }

    return Response.json({
      ok: true,
      scanned: rows.length,
      cleaned_emails: cleanedEmails,
      cleaned_handles: cleanedHandles,
    });
  },
});
