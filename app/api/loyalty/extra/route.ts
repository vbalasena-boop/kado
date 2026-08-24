import { z } from "zod";
import { publicRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const Body = z.object({
  slug: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  // Preuve de possession : le code imprimé sur la carte du client (renvoyé par
  // /api/loyalty/card). Requis pour toute modification.
  code: z.string().trim().min(1),
  birthday_day: z.number().int().min(1).max(31).optional(),
  birthday_month: z.number().int().min(1).max(12).optional(),
  marketing_ok: z.boolean().optional(),
});

/**
 * Complète la carte de fidélité d'un client : anniversaire et/ou consentement
 * marketing. Exige le code de carte comme preuve de possession, et ne ré-active
 * jamais une désinscription (RGPD) — voir plus bas.
 */
export const POST = publicRoute({
  schema: Body,
  rateLimit: {
    key: ({ ip }) => `loyalty-extra:${ip}`,
    limit: 15,
    windowSeconds: 60,
  },
  handler: async ({ body }) => {
    const db = getAdminClient();

    const { data: biz } = await db
      .from("businesses")
      .select("id, status")
      .eq("slug", body.slug)
      .maybeSingle();
    if (!biz || biz.status !== "active") {
      return Response.json({ error: "unavailable" }, { status: 404 });
    }

    // La carte doit correspondre au trio (établissement, e-mail, code). Sans le
    // bon code, un tiers ne peut pas modifier la carte d'autrui.
    const { data: card } = await db
      .from("loyalty_cards")
      .select("id")
      .eq("business_id", biz.id)
      .eq("email", body.email)
      .eq("code", body.code.toUpperCase())
      .maybeSingle();
    if (!card) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    const patch: Record<string, unknown> = {};
    if (body.birthday_day && body.birthday_month) {
      patch.birthday_day = body.birthday_day;
      patch.birthday_month = body.birthday_month;
    }
    if (typeof body.marketing_ok === "boolean") {
      patch.marketing_ok = body.marketing_ok;
      // RGPD : on NE ré-efface PLUS `unsubscribed_at` ici. Un client qui s'était
      // désinscrit ne peut pas être ré-abonné de force via cet endpoint public ;
      // un ré-opt-in devrait passer par un double opt-in (non implémenté). Les
      // crons respectent `unsubscribed_at`, donc un désinscrit reste protégé.
    }
    if (Object.keys(patch).length === 0) {
      return Response.json({ error: "nothing_to_update" }, { status: 400 });
    }

    const { error } = await db
      .from("loyalty_cards")
      .update(patch)
      .eq("id", card.id);
    if (error) {
      return Response.json({ error: "update_failed" }, { status: 500 });
    }

    return Response.json({ ok: true });
  },
});
