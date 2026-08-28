import { z } from "zod";
import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { normalizeFeatures } from "@/lib/features";

export const dynamic = "force-dynamic";

/**
 * Réglages « à distance » d'un établissement (réservé admin).
 *
 * Permet d'activer/désactiver, sur UN seul établissement, ses fonctions
 * optionnelles sans se connecter à son compte :
 *   - `wheel`          : bascules de la page de jeu (wheel_configs)
 *   - `order_tracking` : option « Suivi au comptoir » (businesses)
 *   - `features`       : sac de fonctions avancées (businesses.features jsonb)
 *
 * Chaque bloc est appliqué INDÉPENDAMMENT et de façon tolérante : si une
 * colonne n'existe pas encore, le bloc concerné est ignoré sans faire échouer
 * les autres.
 */
const Body = z.object({
  wheel: z
    .object({
      review_invite: z.boolean().optional(),
      convert_nudge: z.boolean().optional(),
      feedback_enabled: z.boolean().optional(),
      play_alerts: z.boolean().optional(),
    })
    .optional(),
  order_tracking: z.boolean().optional(),
  features: z.record(z.boolean()).optional(),
});

export const POST = adminRoute({
  schema: Body,
  handler: async ({ body, params }) => {
    const db = getAdminClient();
    const applied: string[] = [];
    const skipped: string[] = [];

    // 1) Bascules de la page de jeu (wheel_configs).
    if (body.wheel && Object.keys(body.wheel).length > 0) {
      try {
        const { error } = await db
          .from("wheel_configs")
          .update(body.wheel)
          .eq("business_id", params.id);
        if (error) skipped.push("wheel");
        else applied.push("wheel");
      } catch {
        skipped.push("wheel");
      }
    }

    // 2) Option « Suivi au comptoir » (businesses.order_tracking).
    if (typeof body.order_tracking === "boolean") {
      try {
        const { error } = await db
          .from("businesses")
          .update({ order_tracking: body.order_tracking })
          .eq("id", params.id);
        if (error) skipped.push("order_tracking");
        else applied.push("order_tracking");
      } catch {
        skipped.push("order_tracking");
      }
    }

    // 3) Fonctions avancées (businesses.features jsonb) — clefs connues seules.
    if (body.features !== undefined) {
      try {
        const { error } = await db
          .from("businesses")
          .update({ features: normalizeFeatures(body.features) })
          .eq("id", params.id);
        if (error) skipped.push("features");
        else applied.push("features");
      } catch {
        skipped.push("features");
      }
    }

    return Response.json({ ok: true, applied, skipped });
  },
});
