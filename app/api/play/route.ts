import { z } from "zod";
import { publicRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { getOrCreatePlayerId } from "@/lib/player";
import { weightedIndex, generateCode, prizeIsLosing } from "@/lib/draw";
import { sendPushToBusiness } from "@/lib/push";
import { isTriggerActionAllowed } from "@/lib/wheel";
import { isValidDeviceHash } from "@/lib/device-hash";

export const dynamic = "force-dynamic";

// L'avis (`review`) ne débloque plus jamais de tour : il est retiré des types
// acceptés. Les tours sont désormais pilotés par `trigger_actions`.
const VALID_TYPES = ["instagram", "loyalty", "optin"] as const;

// Schéma permissif : la validation de playType (VALID_TYPES) reste dans le handler.
const Body = z.object({
  slug: z.string().optional(),
  playType: z.string().optional(),
  deviceHash: z.string().nullish(),
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

    // Lecture du drapeau `demo` avec repli tolérant (colonne 0073 récente).
    let bizRes = await supa
      .from("businesses")
      .select("id, status, subscription_status, demo")
      .eq("slug", slug)
      .maybeSingle();
    if (bizRes.error) {
      bizRes = await supa
        .from("businesses")
        .select("id, status, subscription_status")
        .eq("slug", slug)
        .maybeSingle();
    }
    const biz = bizRes.data as
      | {
          id: string;
          status: string;
          subscription_status?: string | null;
          demo?: boolean | null;
        }
      | null;

    if (!biz || biz.status !== "active") {
      return Response.json({ error: "unavailable" }, { status: 404 });
    }

    // DÉMO : tours ILLIMITÉS. On n'applique aucun des verrous par client —
    // chaque tour reçoit un identifiant de joueur unique (jamais de collision
    // sur la contrainte unique), la dédup par appareil est désactivée et le
    // plafond quotidien ne s'applique pas.
    //
    // Vaut pour TOUTES les démos, mais UNIQUEMENT tant qu'elles sont des démos :
    // dès qu'un établissement devient PAYANT (subscription_status = 'active'),
    // il repasse en mode normal, même si le drapeau démo n'a pas été retiré.
    // Passer en essai retire déjà le drapeau (→ mode normal aussi).
    const isDemo = !!biz.demo && biz.subscription_status !== "active";

    const playerId = isDemo
      ? globalThis.crypto.randomUUID()
      : getOrCreatePlayerId();

    // Empreinte d'appareil (verrou secondaire). On n'accepte qu'un hex SHA-256
    // bien formé ; toute autre valeur est ignorée (repli sur le cookie seul).
    // En démo, on la neutralise (aucun re-verrouillage).
    const deviceHash =
      !isDemo && isValidDeviceHash(body.deviceHash) ? body.deviceHash : null;

    // Cet APPAREIL a-t-il déjà joué ce type ? Attrape le rejeu en navigation
    // privée / cookies vidés, que le cookie laisse passer. Vérification SOUPLE
    // (SELECT) ; repli si la colonne device_hash n'existe pas encore (42703).
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
        .select("trigger_actions, loyalty_enabled")
        .eq("business_id", biz.id)
        .maybeSingle(),
    ]);

    if (!prizes || prizes.length === 0) {
      return Response.json({ error: "no_prizes" }, { status: 409 });
    }

    // Action non déclenchante (non configurée, ou avis) → tour non autorisé.
    // Filet de sécurité fidélité : si la carte est désactivée (`loyalty_enabled`
    // falsy), « loyalty » est refusée même si elle figure encore dans la config.
    const triggerActions = taRes.error
      ? undefined
      : (taRes.data as any)?.trigger_actions;
    if (
      !isTriggerActionAllowed(playType, triggerActions, {
        loyaltyEnabled: !!(taRes.data as any)?.loyalty_enabled,
      })
    ) {
      return Response.json({ error: "action_not_allowed" }, { status: 403 });
    }

    const isWin = (p: { is_losing?: boolean | null; label: string }) =>
      !prizeIsLosing(p);

    let idx = weightedIndex(prizes);

    // Plafond de cadeaux par jour : au-delà, on force un "Rien" (si disponible).
    // Réservation ATOMIQUE (RPC 0054) pour éviter le dépassement sous forte
    // affluence ; repli sur l'ancien comptage souple si la fonction n'est pas
    // encore déployée.
    const limit = cfg?.daily_prize_limit;
    if (!isDemo && limit && limit > 0 && isWin(prizes[idx])) {
      let allowed: boolean;
      const { data: claimed, error: claimErr } = await supa.rpc(
        "claim_daily_prize",
        { biz: biz.id, lim: limit }
      );
      if (claimErr) {
        // Migration 0054 absente → comptage direct (plafond souple, best effort).
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        // Miroir SQL de labelIsLosing() (lib/draw.ts) : tours GAGNANTS du jour.
        const { count } = await supa
          .from("plays")
          .select("*", { count: "exact", head: true })
          .eq("business_id", biz.id)
          .gte("created_at", start.toISOString())
          .not("prize_label", "ilike", "%rien%");
        allowed = (count ?? 0) < limit;
      } else {
        allowed = claimed === true;
      }
      if (!allowed) {
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
    // Instantané du caractère perdant au moment du tour + empreinte d'appareil.
    // Repli si une colonne optionnelle (is_losing / device_hash) n'existe pas
    // encore (migration non appliquée).
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
