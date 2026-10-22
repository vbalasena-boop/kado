import { readPlayEmailToken } from "@/lib/play-email";
import { z } from "zod";
import { publicRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { getOrCreatePlayerId } from "@/lib/player";
import { weightedIndex, generateCode, prizeIsLosing } from "@/lib/draw";
import { sendPushToBusiness } from "@/lib/push";
import { isTriggerActionAllowed, instagramHref } from "@/lib/wheel";
import { isValidDeviceHash } from "@/lib/device-hash";
import { FINGERPRINT_CONSENT_VERSION } from "@/lib/fingerprint-consent";
import { clientIp, hashRateLimitKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// L'avis (`review`) ne débloque plus jamais de tour : il est retiré des types
// acceptés. Les tours sont désormais pilotés par `trigger_actions`.

const VALID_TYPES = ["instagram", "loyalty", "optin"] as const;

// Schéma permissif : la validation de playType (VALID_TYPES) reste dans le handler.
const Body = z.object({
  slug: z.string().optional(),
  playType: z.string().optional(),
  deviceHash: z.string().nullish(),
  emailToken: z.string().max(2048).optional(),
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
  rateLimit: {
    key: ({ ip }) => `play:${hashRateLimitKey(ip)}`,
    limit: 30,
    windowSeconds: 60,
  },
  handler: async ({ body, req }) => {
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
      : await getOrCreatePlayerId();

    // Empreinte d'appareil (verrou secondaire). On n'accepte qu'un hex SHA-256
    // bien formé ; toute autre valeur impose la vérification par e-mail.
    // En démo, on la neutralise (aucun re-verrouillage).
    let deviceHash =
      !isDemo && isValidDeviceHash(body.deviceHash) ? body.deviceHash : null;
    if (deviceHash) {
      const { data: consent, error: consentError } = await supa
        .from("player_fingerprint_consents")
        .select("consented, policy_version")
        .eq("business_id", biz.id)
        .eq("player_id", playerId)
        .maybeSingle();
      if (consentError || consent?.consented !== true || consent.policy_version !== FINGERPRINT_CONSENT_VERSION) {
        deviceHash = null;
      }
    }

    const emailHash = !isDemo && !deviceHash ? readPlayEmailToken(body.emailToken, biz.id) : null;
    if (!isDemo && !deviceHash && !emailHash) {
      return Response.json({ error: "email_required" }, { status: 409 });
    }
    if (emailHash) {
      const { data: dup, error } = await supa.from("plays")
        .select("prize_label, prize_code").eq("business_id", biz.id)
        .eq("play_type", playType).eq("email_hash", emailHash).maybeSingle();
      if (error) return Response.json({ error: "play_save_unavailable" }, { status: 503 });
      if (dup) return Response.json({ alreadyPlayed: true, label: dup.prize_label, code: dup.prize_code }, { status: 409 });
    }

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
        .select("trigger_actions, loyalty_enabled, instagram_url")
        .eq("business_id", biz.id)
        .maybeSingle(),
    ]);

    // Limite automatique par commerce et réseau : aucune action n'est demandée
    // au commerçant ou au joueur. Les démos restent illimitées.
    if (
      !isDemo &&
      !(await rateLimit(
        `play-business:${biz.id}:${hashRateLimitKey(clientIp(req))}`,
        80,
        60 * 60
      ))
    ) {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }

    if (!prizes || prizes.length === 0) {
      return Response.json({ error: "no_prizes" }, { status: 409 });
    }

    // Action non déclenchante (non configurée, ou avis) → tour non autorisé.
    // Mêmes filets de sécurité que côté jeu (miroir de `unlockedSpinActions`) :
    //  - carte désactivée (`loyalty_enabled` falsy) → « loyalty » refusée ;
    //  - aucun lien Instagram renseigné → « instagram » refusée, sauf si c'est
    //    la seule action offerte (le jeu reste jouable).
    const triggerActions = taRes.error
      ? undefined
      : (taRes.data as any)?.trigger_actions;
    if (
      !isTriggerActionAllowed(playType, triggerActions, {
        loyaltyEnabled: !!(taRes.data as any)?.loyalty_enabled,
        instagramLinked: taRes.error
          ? true
          : instagramHref((taRes.data as any) ?? {}) !== null,
      })
    ) {
      return Response.json({ error: "action_not_allowed" }, { status: 403 });
    }

    const isWin = (p: { is_losing?: boolean | null; label: string }) =>
      !prizeIsLosing(p);

    let idx = weightedIndex(prizes);

    // Enregistre le tour dans une transaction serveur qui réserve le plafond
    // du cadeau et insère la partie ensemble.
    const limit = cfg?.daily_prize_limit;
    const code = generateCode();
    const record = async () => supa.rpc("record_play_with_daily_prize_limit", {
      p_business_id: biz.id,
      p_player_id: playerId,
      p_play_type: playType,
      p_prize_label: prizes[idx].label,
      p_prize_code: code,
      p_is_losing: prizeIsLosing(prizes[idx]),
      p_device_hash: deviceHash,
      p_email_hash: emailHash,
      p_daily_limit: isDemo ? null : limit,
    });

    let { data: recordStatus, error: recordError } = await record();
    if (recordError) {
      return Response.json({ error: "play_save_unavailable" }, { status: 503 });
    }
    if (recordStatus === "daily_prize_limit_reached") {
      const noWin = prizes.findIndex((p) => !isWin(p));
      if (noWin < 0) {
        return Response.json({ error: "daily_prize_limit_reached" }, { status: 409 });
      }
      idx = noWin;
      ({ data: recordStatus, error: recordError } = await record());
      if (recordError) {
        return Response.json({ error: "play_save_unavailable" }, { status: 503 });
      }
    }

    if (recordStatus === "already_played") {
      const findExisting = (column: string, value: string) => supa.from("plays")
        .select("prize_label, prize_code").eq("business_id", biz.id)
        .eq(column, value).eq("play_type", playType).maybeSingle();
      // Le conflit peut venir du cookie, même si un nouvel e-mail a été vérifié.
      let { data: existing } = await findExisting("player_id", playerId);
      if (!existing && (emailHash || deviceHash)) {
        ({ data: existing } = await findExisting(emailHash ? "email_hash" : "device_hash", (emailHash ?? deviceHash)!));
      }
      return Response.json(
        {
          alreadyPlayed: true,
          label: existing?.prize_label ?? null,
          code: existing?.prize_code ?? null,
        },
        { status: 409 }
      );
    }
    if (recordStatus !== "inserted") {
      return Response.json({ error: "play_save_unavailable" }, { status: 503 });
    }

    const prize = prizes[idx];

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
