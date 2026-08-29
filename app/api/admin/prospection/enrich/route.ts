import { z } from "zod";
import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { enrichWebsite } from "@/lib/prospection/enrich";
import {
  serperConfigured,
  findInstagramViaSearch,
  findWebsiteViaSearch,
} from "@/lib/prospection/enrich-serper";
import { scoreProspect } from "@/lib/prospection/score";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z
  .object({
    limit: z.number().int().min(1).max(30).optional(),
    // Repart de zéro : oublie les fiches déjà tentées pour re-scanner TOUTE la
    // liste (utile après avoir activé Serper). L'enrichissement ne remplit que
    // ce qui manque — jamais d'écrasement.
    rescan: z.boolean().optional(),
  })
  .optional();

type Row = {
  id: string;
  name: string;
  city: string | null;
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

    // Re-scan complet demandé : on efface les marqueurs « déjà tentée » pour que
    // toute la liste soit re-traitée (ex. après activation de Serper).
    if (body?.rescan) {
      await db.from("prospect_events").delete().eq("type", "enrich_scanned");
    }

    // Prospects déjà tentés (marqueur `enrich_scanned`) — on ne les repasse pas,
    // pour AVANCER dans la liste à chaque clic au lieu de tourner sur les mêmes.
    const { data: scannedEvents } = await db
      .from("prospect_events")
      .select("prospect_id")
      .eq("type", "enrich_scanned")
      .limit(20000);
    const scannedIds = new Set((scannedEvents ?? []).map((e) => e.prospect_id as string));

    // Prospects avec un site, à qui il manque l'email OU l'Instagram.
    // Avec l'étage payant (Serper), on peut aussi enrichir des prospects SANS
    // site (recherche du compte/du site). Sinon, on se limite à ceux qui ont un site.
    const useSerper = serperConfigured();
    let q = db
      .from("prospects")
      .select(
        "id, name, city, website, email, instagram_handle, google_rating, google_reviews_count, google_last_review_at"
      )
      .or("email.is.null,instagram_handle.is.null")
      .limit(1000);
    if (!useSerper) q = q.not("website", "is", null);
    const { data, error } = await q;
    if (error) return Response.json({ error: "db_error" }, { status: 500 });

    // On écarte les fiches déjà tentées, puis on prend le prochain lot.
    const candidates = ((data ?? []) as Row[]).filter((r) => !scannedIds.has(r.id));
    const rows = candidates.slice(0, limit);
    let enriched = 0;
    let emailsFound = 0;
    let instaFound = 0;

    for (const r of rows) {
      const contact = await enrichWebsite(r.website);
      let source = "site_web";

      // --- Étage payant optionnel (Serper) : uniquement si activé + manquant ---
      if (useSerper) {
        if (!r.instagram_handle && !contact.instagram) {
          const ig = await findInstagramViaSearch(r.name, r.city);
          if (ig) {
            contact.instagram = ig;
            source = "recherche";
          }
        }
        if (!r.email && !contact.email) {
          const site = await findWebsiteViaSearch(r.name, r.city);
          if (site) {
            const c2 = await enrichWebsite(site);
            if (c2.email && !contact.email) {
              contact.email = c2.email;
              source = "recherche";
            }
            if (c2.instagram && !contact.instagram) {
              contact.instagram = c2.instagram;
              source = "recherche";
            }
          }
        }
      }

      // On ne remplit que ce qui manque (jamais d'écrasement).
      const newEmail = !r.email && contact.email ? contact.email : null;
      const newInsta =
        !r.instagram_handle && contact.instagram ? contact.instagram : null;
      if (!newEmail && !newInsta) {
        // Rien trouvé : on marque quand même la fiche « tentée » pour ne pas la
        // reprendre au prochain clic (sinon on tourne en rond).
        await db
          .from("prospect_events")
          .insert({ prospect_id: r.id, type: "enrich_scanned", meta: { found: false } });
        continue;
      }

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

      // Traçabilité de la source (comme les "etage" du workflow d'inspiration)
      // + marqueur « tentée » pour ne pas la reprendre au prochain clic.
      await db.from("prospect_events").insert([
        {
          prospect_id: r.id,
          type: "enriched",
          meta: {
            email_found: Boolean(newEmail),
            instagram_found: Boolean(newInsta),
            source,
          },
        },
        { prospect_id: r.id, type: "enrich_scanned", meta: { found: true } },
      ]);
    }

    return Response.json({
      ok: true,
      scanned: rows.length,
      enriched,
      emails_found: emailsFound,
      instagram_found: instaFound,
      // Fiches restant à tenter après ce lot (pour enchaîner automatiquement).
      remaining: Math.max(0, candidates.length - rows.length),
    });
  },
});
