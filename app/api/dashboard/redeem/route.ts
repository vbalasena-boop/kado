import { z } from "zod";
import { merchantRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { prizeIsLosing } from "@/lib/draw";

export const dynamic = "force-dynamic";

const DEFAULT_EXPIRY_DAYS = 30;

const Body = z.object({
  code: z.unknown().optional(),
  action: z.unknown().optional(),
});

/**
 * Vérifie / valide un code cadeau présenté en caisse.
 * action = 'check' (juste vérifier) | 'redeem' (marquer comme utilisé).
 * Statuts : not_found | no_win | already | expired | valid | redeemed.
 */
export const POST = merchantRoute({
  schema: Body,
  handler: async ({ body: rawBody, business }) => {
    const body = rawBody as { code?: string; action?: string };
    const code = (body.code || "").trim().toUpperCase();
    if (!code) return Response.json({ status: "not_found" });

    const db = getAdminClient();
    let playRes = await db
      .from("plays")
      .select("id, prize_label, prize_code, created_at, redeemed_at, is_losing")
      .eq("business_id", business.id)
      .eq("prize_code", code)
      .maybeSingle();
    // Repli si la colonne is_losing n'existe pas encore (migration 0037).
    if (playRes.error && (playRes.error as { code?: string }).code === "42703") {
      playRes = await db
        .from("plays")
        .select("id, prize_label, prize_code, created_at, redeemed_at")
        .eq("business_id", business.id)
        .eq("prize_code", code)
        .maybeSingle();
    }
    const play = playRes.data;

    if (!play) return Response.json({ status: "not_found" });

    const label = play.prize_label || "";
    if (prizeIsLosing({ is_losing: (play as { is_losing?: boolean | null }).is_losing, label })) {
      return Response.json({ status: "no_win", prize: label });
    }
    if (play.redeemed_at) {
      return Response.json({
        status: "already",
        prize: label,
        redeemed_at: play.redeemed_at,
      });
    }
    // Durée de validité choisie par le commerçant (null = illimitée).
    // Colonne absente (migration 0025 pas passée) : ancien comportement 30 j.
    let validityDays: number | null = DEFAULT_EXPIRY_DAYS;
    const { data: cfg, error: cfgErr } = await db
      .from("wheel_configs")
      .select("prize_validity_days")
      .eq("business_id", business.id)
      .maybeSingle();
    validityDays =
      cfgErr || !cfg
        ? DEFAULT_EXPIRY_DAYS
        : ((cfg as any).prize_validity_days ?? null);
    const expired =
      validityDays != null &&
      new Date(play.created_at).getTime() + validityDays * 864e5 < Date.now();
    if (expired) {
      return Response.json({ status: "expired", prize: label, days: validityDays });
    }

    if (body.action === "redeem") {
      const { error } = await db
        .from("plays")
        .update({ redeemed_at: new Date().toISOString() })
        .eq("id", play.id)
        .is("redeemed_at", null); // évite la double validation concurrente
      if (error) return Response.json({ error: "update_failed" }, { status: 500 });
      return Response.json({ status: "redeemed", prize: label });
    }

    return Response.json({ status: "valid", prize: label });
  },
});
