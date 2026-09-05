import { z } from "zod";
import { publicRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const Body = z.object({ slug: z.string().optional() });

/**
 * Enregistre un CLIC sur le lien neutre « Laisser un avis Google » (page de
 * jeu). Aucune donnée personnelle : uniquement le commerce + l'horodatage, pour
 * mesurer côté commerçant si le lien est cliqué. Ouvert à tous, rate-limité.
 *
 * Volontairement best-effort et tolérant : un échec ne doit jamais gêner le
 * client (le lien s'ouvre de toute façon dans un nouvel onglet côté navigateur).
 */
export const POST = publicRoute({
  schema: Body,
  rateLimit: { key: ({ ip }) => `reviewclick:${ip}`, limit: 20, windowSeconds: 60 },
  handler: async ({ body }) => {
    const slug = String(body.slug ?? "").trim();
    if (!slug) return Response.json({ error: "missing" }, { status: 400 });

    const db = getAdminClient();
    const { data: biz } = await db
      .from("businesses")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!biz) return Response.json({ error: "not_found" }, { status: 404 });

    // Insertion tolérante : si la table 0077 n'est pas encore déployée (42P01),
    // on n'échoue pas — la mesure est un confort, jamais un blocage.
    const { error } = await db
      .from("review_clicks")
      .insert({ business_id: (biz as any).id });
    if (error && (error as { code?: string }).code !== "42P01") {
      return Response.json({ error: "save_failed" }, { status: 500 });
    }
    return Response.json({ ok: true });
  },
});
