import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getOrCreatePlayerId } from "@/lib/player";
import { weightedIndex, generateCode } from "@/lib/draw";

export const dynamic = "force-dynamic";

const VALID_TYPES = ["instagram", "review"] as const;

/**
 * Enregistre un tour de roue.
 * - Vérifie que l'établissement existe et est actif.
 * - Tire le lot CÔTÉ SERVEUR.
 * - Insère la partie ; la contrainte SQL unique(business_id, player_id, play_type)
 *   empêche de rejouer le même type → renvoie 409 "déjà joué".
 */
export async function POST(req: NextRequest) {
  let body: { slug?: string; playType?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const { slug, playType } = body;
  if (!slug || !playType || !VALID_TYPES.includes(playType as any)) {
    return Response.json({ error: "invalid_params" }, { status: 400 });
  }

  const supa = getAdminClient();

  const { data: biz } = await supa
    .from("businesses")
    .select("id, status")
    .eq("slug", slug)
    .maybeSingle();

  if (!biz || biz.status !== "active") {
    return Response.json({ error: "unavailable" }, { status: 404 });
  }

  const playerId = getOrCreatePlayerId();

  const [{ data: prizes }, { data: cfg }] = await Promise.all([
    supa
      .from("prizes")
      .select("id, label, emoji, weight, color, position")
      .eq("business_id", biz.id)
      .order("position", { ascending: true }),
    supa
      .from("wheel_configs")
      .select("daily_prize_limit, instagram_enabled, review_enabled")
      .eq("business_id", biz.id)
      .maybeSingle(),
  ]);

  if (!prizes || prizes.length === 0) {
    return Response.json({ error: "no_prizes" }, { status: 409 });
  }

  // Canal désactivé par le commerçant → tour non autorisé
  const channelEnabled =
    playType === "instagram"
      ? cfg?.instagram_enabled !== false
      : cfg?.review_enabled !== false;
  if (!channelEnabled) {
    return Response.json({ error: "channel_disabled" }, { status: 403 });
  }

  const isWin = (label: string) => !label.toLowerCase().includes("rien");

  let idx = weightedIndex(prizes);

  // Plafond de cadeaux par jour : au-delà, on force un "Rien" (si disponible)
  const limit = cfg?.daily_prize_limit;
  if (limit && limit > 0 && isWin(prizes[idx].label)) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { count } = await supa
      .from("plays")
      .select("*", { count: "exact", head: true })
      .eq("business_id", biz.id)
      .gte("created_at", start.toISOString())
      .not("prize_label", "ilike", "%rien%");
    if ((count ?? 0) >= limit) {
      const noWin = prizes.findIndex((p) => !isWin(p.label));
      if (noWin >= 0) idx = noWin;
    }
  }

  const prize = prizes[idx];
  const code = generateCode();

  const { error } = await supa.from("plays").insert({
    business_id: biz.id,
    player_id: playerId,
    play_type: playType,
    prize_label: prize.label,
    prize_code: code,
  });

  if (error) {
    // 23505 = violation de contrainte unique => ce type de tour est déjà joué
    if ((error as any).code === "23505") {
      const { data: existing } = await supa
        .from("plays")
        .select("prize_label, prize_code")
        .eq("business_id", biz.id)
        .eq("player_id", playerId)
        .eq("play_type", playType)
        .maybeSingle();
      return Response.json(
        {
          alreadyPlayed: true,
          label: existing?.prize_label ?? null,
          code: existing?.prize_code ?? null,
        },
        { status: 409 }
      );
    }
    return Response.json({ error: "db_error" }, { status: 500 });
  }

  return Response.json({
    index: idx,
    label: prize.label,
    emoji: prize.emoji,
    code,
  });
}
