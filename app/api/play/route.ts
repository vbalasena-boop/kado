import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getOrCreatePlayerId } from "@/lib/player";
import { weightedIndex, generateCode, prizeIsLosing } from "@/lib/draw";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sendPushToBusiness } from "@/lib/push";
import { isValidDeviceHash } from "@/lib/device-hash";

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
  // Anti-abus : 30 tours/min max par IP
  const ip = clientIp(req);
  if (!(await rateLimit(`play:${ip}`, 30, 60))) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: { slug?: string; playType?: string; deviceHash?: string | null };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const { slug, playType } = body;
  if (!slug || !playType || !VALID_TYPES.includes(playType as any)) {
    return Response.json({ error: "invalid_params" }, { status: 400 });
  }

  // Empreinte d'appareil (verrou secondaire). On n'accepte qu'un hex SHA-256
  // bien formé ; toute autre valeur est ignorée (repli sur le cookie seul).
  const deviceHash = isValidDeviceHash(body.deviceHash) ? body.deviceHash : null;

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

  // Verrou secondaire : cet APPAREIL a-t-il déjà joué ce type ? Attrape le
  // rejeu en navigation privée / cookies vidés, que le cookie laisse passer.
  // Vérification SOUPLE (SELECT) : on ne fait jamais échouer un tour à cause
  // d'une collision d'empreinte, et on retombe sur le cookie si la colonne
  // device_hash n'existe pas encore (migration 0041 non appliquée → 42703).
  if (deviceHash) {
    const { data: dup, error: dupErr } = await supa
      .from("plays")
      .select("prize_label, prize_code")
      .eq("business_id", biz.id)
      .eq("play_type", playType)
      .eq("device_hash", deviceHash)
      .limit(1)
      .maybeSingle();
    if (!dupErr && dup) {
      return Response.json(
        {
          alreadyPlayed: true,
          label: dup.prize_label ?? null,
          code: dup.prize_code ?? null,
        },
        { status: 409 }
      );
    }
  }

  const [prizesRes, { data: cfg }] = await Promise.all([
    supa
      .from("prizes")
      .select("id, label, emoji, weight, color, position, is_losing")
      .eq("business_id", biz.id)
      .order("position", { ascending: true }),
    supa
      .from("wheel_configs")
      .select("daily_prize_limit, instagram_enabled, review_enabled")
      .eq("business_id", biz.id)
      .maybeSingle(),
  ]);

  // Repli si la colonne is_losing n'existe pas encore (migration 0037 non
  // appliquée) : on refait la sélection sans elle (détection via le libellé).
  let prizes: Array<{
    id: string;
    label: string;
    emoji: string;
    weight: number;
    color: string;
    position: number;
    is_losing?: boolean | null;
  }> | null = prizesRes.data;
  if (prizesRes.error && (prizesRes.error as { code?: string }).code === "42703") {
    const { data } = await supa
      .from("prizes")
      .select("id, label, emoji, weight, color, position")
      .eq("business_id", biz.id)
      .order("position", { ascending: true });
    prizes = data;
  }

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

  const isWin = (p: { is_losing?: boolean | null; label: string }) =>
    !prizeIsLosing(p);

  let idx = weightedIndex(prizes);

  // Plafond de cadeaux par jour : au-delà, on force un "Rien" (si disponible)
  const limit = cfg?.daily_prize_limit;
  if (limit && limit > 0 && isWin(prizes[idx])) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    // Miroir SQL de labelIsLosing() (lib/draw.ts) : compte les tours GAGNANTS
    // du jour. Garder les deux définitions alignées.
    const { count } = await supa
      .from("plays")
      .select("*", { count: "exact", head: true })
      .eq("business_id", biz.id)
      .gte("created_at", start.toISOString())
      .not("prize_label", "ilike", "%rien%");
    if ((count ?? 0) >= limit) {
      const noWin = prizes.findIndex((p) => !isWin(p));
      if (noWin >= 0) idx = noWin;
    }
  }

  const prize = prizes[idx];
  const code = generateCode();

  const baseRow = {
    business_id: biz.id,
    player_id: playerId,
    play_type: playType,
    prize_label: prize.label,
    prize_code: code,
  };
  // Instantané du caractère perdant au moment du tour (robuste à un renommage
  // ultérieur du lot) + empreinte d'appareil. Repli si une colonne optionnelle
  // (is_losing / device_hash) n'existe pas encore (migration non appliquée).
  let { error } = await supa
    .from("plays")
    .insert({ ...baseRow, is_losing: prizeIsLosing(prize), device_hash: deviceHash });
  if (error && (error as { code?: string }).code === "42703") {
    ({ error } = await supa.from("plays").insert(baseRow));
  }

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

  // Alerte temps réel au commerçant à chaque cadeau gagné (si activée).
  // Lecture tolérante : colonne 0029 peut manquer ; on n'échoue jamais le tour.
  if (isWin(prize)) {
    try {
      const { data: alertCfg, error: alertErr } = await supa
        .from("wheel_configs")
        .select("play_alerts")
        .eq("business_id", biz.id)
        .maybeSingle();
      if (!alertErr && (alertCfg as any)?.play_alerts) {
        await sendPushToBusiness(supa, biz.id, {
          title: "🎉 Cadeau gagné !",
          body: `${prize.emoji || "🎁"} ${prize.label} — un client vient de gagner.`,
          url: "/dashboard",
        });
      }
    } catch {
      /* la notif ne doit jamais bloquer le tour */
    }
  }

  return Response.json({
    index: idx,
    label: prize.label,
    emoji: prize.emoji,
    code,
  });
}
