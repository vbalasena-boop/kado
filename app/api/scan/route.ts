import { z } from "zod";
import { publicRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const Body = z.object({ slug: z.string().optional() });

/**
 * Enregistre un SCAN (= ouverture de la page de jeu, ≈ scan du QR). Aucune
 * donnée personnelle : commerce + horodatage. Sert à mesurer la 1re marche de
 * l'entonnoir (« scan → jeu »). Le client déduplique déjà par appareil/jour
 * (localStorage), ce qui borne le volume ; on rate-limite en plus par IP.
 *
 * Best-effort et tolérant : table 0078 absente (42P01) → 200, jamais bloquant.
 */
export const POST = publicRoute({
  schema: Body,
  rateLimit: { key: ({ ip }) => `scan:${ip}`, limit: 30, windowSeconds: 60 },
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

    const { error } = await db
      .from("scans")
      .insert({ business_id: (biz as any).id });
    if (error && (error as { code?: string }).code !== "42P01") {
      return Response.json({ error: "save_failed" }, { status: 500 });
    }
    return Response.json({ ok: true });
  },
});
