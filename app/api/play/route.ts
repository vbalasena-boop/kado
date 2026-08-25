import { z } from "zod";
import { publicRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { getOrCreatePlayerId } from "@/lib/player";
import { weightedIndex, generateCode, prizeIsLosing } from "@/lib/draw";
import { sendPushToBusiness } from "@/lib/push";
import { isTriggerActionAllowed } from "@/lib/wheel";

export const dynamic = "force-dynamic";

// L'avis (`review`) ne débloque plus jamais de tour : il est retiré des types
// acceptés. Les tours sont désormais pilotés par `trigger_actions`.
const VALID_TYPES = ["instagram", "loyalty", "optin"] as const;

// Schéma permissif : la validation de playType (VALID_TYPES) reste dans le handler.
const Body = z.object({
  slug: z.string().optional(),
  playType: z.string().optional(),
});

/**
 * Enregistre un tour de roue.
 * - Vérifie que l'établissement existe et est actif.
 * - Tire le lot CÔTÉ SERVEUR.
 * - Insère la partie ; la contrainte SQL unique(business_id, player_id, play_type)
 *   empêche de rejouer le même type → renvoie 409 "déjà joué".
 */
export const POST = publicRoute({
  schema: Body,
  // Anti-abus : 30 tours/min max par IP
  rateLimit: { key: ({ ip }) => `play:${ip}`, limit: 30, windowSeconds: 60 },
  handler: async ({ body }) => {
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

    const [{ data: prizes }, { data: cfg }, taRes] = await Promise.all([
      supa
        .from("prizes")
        .select("id, label, emoji, weight, color, position, is_losing")
        .eq("business_id", biz.id)
        .order("position", { ascending: true }),
      supa
        .from("wheel_configs")
        .select("daily_prize_limit")
        .eq("business_id", biz.id)
        .maybeSingle(),
      // `trigger_actions` (colonne récente 0045) lue À PART : si elle manque, son
      // erreur reste isolée et ne fait jamais perdre `daily_prize_limit` (plafond
      // quotidien). Lecture tolérante → repli `["instagram"]` via la garde.
      supa
        .from("wheel_configs")
        .select("trigger_actions")
        .eq("business_id", biz.id)
        .maybeSingle(),
    ]);

    if (!prizes || prizes.length === 0) {
      return Response.json({ error: "no_prizes" }, { status: 409 });
    }

    // Action non déclenchante (non configurée, ou avis) → tour non autorisé.
    const triggerActions = taRes.error
      ? undefined
      : (taRes.data as any)?.trigger_actions;
    if (!isTriggerActionAllowed(playType, triggerActions)) {
      return Response.json({ error: "action_not_allowed" }, { status: 403 });
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
    // ultérieur du lot).
    const { error } = await supa
      .from("plays")
      .insert({ ...baseRow, is_losing: prizeIsLosing(prize) });

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
      // 23514 = violation du CHECK play_type (migration 0046 pas encore
      // appliquée) : ce type de tour n'est pas accepté → refus propre, pas un 500.
      if ((error as any).code === "23514") {
        return Response.json({ error: "action_not_allowed" }, { status: 403 });
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
  },
});
