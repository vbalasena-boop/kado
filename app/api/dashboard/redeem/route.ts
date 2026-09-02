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
 * Statuts : not_found | no_win | already | expired | daily_limit | valid | redeemed.
 */
export const POST = merchantRoute({
  schema: Body,
  handler: async ({ body: rawBody, business }) => {
    const body = rawBody as { code?: string; action?: string };
    const code = (body.code || "").trim().toUpperCase();
    if (!code) return Response.json({ status: "not_found" });

    const db = getAdminClient();
    const playRes = await db
      .from("plays")
      .select("id, player_id, prize_label, prize_code, created_at, redeemed_at, is_losing")
      .eq("business_id", business.id)
      .eq("prize_code", code)
      .maybeSingle();
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

    // Option « 1 cadeau récupéré par jour et par client » (0074, lue tolérante).
    // Si activée : ce client (player_id du tour) a-t-il DÉJÀ fait valider un
    // cadeau aujourd'hui ? Si oui, on refuse — que ce soit en 'check' ou 'redeem'.
    let onePerDay = false;
    try {
      const { data } = await db
        .from("wheel_configs")
        .select("one_prize_per_day")
        .eq("business_id", business.id)
        .maybeSingle();
      onePerDay = !!(data as { one_prize_per_day?: boolean | null } | null)
        ?.one_prize_per_day;
    } catch {
      onePerDay = false;
    }
    if (onePerDay && (play as { player_id?: string | null }).player_id) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data: sameDay } = await db
        .from("plays")
        .select("id")
        .eq("business_id", business.id)
        .eq("player_id", (play as { player_id: string }).player_id)
        .neq("id", play.id)
        .not("redeemed_at", "is", null)
        .gte("redeemed_at", startOfDay.toISOString())
        .limit(1);
      if (sameDay && sameDay.length > 0) {
        return Response.json({ status: "daily_limit", prize: label });
      }
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
