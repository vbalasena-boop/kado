import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { insertPrizes } from "@/lib/prizes";
import { unlockedSpinActions, hardenExternalUrl } from "@/lib/wheel";
import { isMissingColumnError } from "@/lib/db-errors";
import { reportError } from "@/lib/report";

export const dynamic = "force-dynamic";

/** Enregistre la configuration de roue du commerçant connecté. */
export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: {
    config?: {
      primary_color?: string;
      instagram_url?: string;
      review_url?: string;
      compliance_note?: string;
      daily_prize_limit?: number | null;
      prize_validity_days?: number | null;
      accent_color?: string | null;
      bg_color?: string | null;
      decor_emojis?: string | null;
      collect_email?: boolean;
      instagram_enabled?: boolean;
      review_enabled?: boolean;
      loyalty_enabled?: boolean;
      loyalty_goal?: number;
      loyalty_reward?: string;
      loyalty_reward_emoji?: string;
      loyalty_stamp_emoji?: string;
      game_type?: string;
      birthday_enabled?: boolean;
      birthday_reward?: string;
      referral_enabled?: boolean;
      reengage_almost?: boolean;
      reengage_inactive?: boolean;
      reengage_inactive_days?: number;
      reengage_reward?: boolean;
      review_invite?: boolean;
      convert_nudge?: boolean;
      feedback_enabled?: boolean;
      play_alerts?: boolean;
      monthly_draw?: boolean;
      monthly_draw_prize?: string;
      draw_period_days?: number;
      draw_next_at?: string | null;
      trigger_actions?: unknown;
      highlight_title?: string;
      highlight_text?: string;
      highlight_url?: string;
      highlight_until?: string | null;
    };
    prizes?: {
      label: string;
      emoji: string;
      weight: number;
      color: string;
    }[];
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const admin = getAdminClient();
  const cfg = body.config ?? {};

  // Page verrouillée par l'admin (formule Installation) ? Le commerçant ne
  // peut plus modifier l'apparence (couleurs + décor). Lecture tolérante.
  let themeLocked = false;
  {
    const { data: lk, error: lkErr } = await admin
      .from("wheel_configs")
      .select("theme_locked")
      .eq("business_id", business.id)
      .maybeSingle();
    themeLocked = lkErr ? false : !!(lk as any)?.theme_locked;
  }

  // Colonnes canaux (legacy). `trigger_actions` est désormais la SEULE source de
  // vérité pour « quels tours sont débloqués » (réconciliation éditeur, Epic 9).
  // On écrit ces colonnes telles quelles, SANS plus forcer « au moins un canal »
  // (ancien garde retiré) : le garant du « au moins un tour » vit dans
  // trigger_actions (resolveTriggerActions/sanitizeTriggerActions ne renvoient
  // jamais une liste vide). `instagram_enabled` n'a plus aucun lecteur.
  const igEnabled = cfg.instagram_enabled !== false;
  const rvEnabled = cfg.review_enabled !== false;

  // Couleurs : valeur hex valide sinon défaut
  const hex = (v: string | null | undefined, def: string) =>
    v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : def;

  // upsert config (1-1 avec business)
  const basePayload = {
      business_id: business.id,
      // Durci à l'écriture (anti-XSS) : jamais de `javascript:`/`data:` persisté
      // pour une URL ouverte via window.open côté joueur (cf. lib/wheel).
      instagram_url: hardenExternalUrl(cfg.instagram_url),
      review_url: hardenExternalUrl(cfg.review_url),
      compliance_note:
        cfg.compliance_note || "Le cadeau n'est pas conditionné à la note laissée.",
      daily_prize_limit:
        cfg.daily_prize_limit && cfg.daily_prize_limit > 0
          ? Math.round(cfg.daily_prize_limit)
          : null,
      collect_email: !!cfg.collect_email,
      instagram_enabled: igEnabled,
      review_enabled: rvEnabled,
      loyalty_enabled: !!cfg.loyalty_enabled,
      loyalty_goal: Math.min(
        30,
        Math.max(2, Math.round(Number(cfg.loyalty_goal) || 10))
      ),
      loyalty_reward:
        (cfg.loyalty_reward || "").trim().slice(0, 60) ||
        "Une récompense offerte",
      loyalty_reward_emoji: (cfg.loyalty_reward_emoji || "🎁").slice(0, 8),
      loyalty_stamp_emoji: (cfg.loyalty_stamp_emoji || "⭐").slice(0, 8),
      game_type: ["wheel", "scratch", "slot"].includes(cfg.game_type ?? "")
        ? cfg.game_type
        : "wheel",
      birthday_enabled: !!cfg.birthday_enabled,
      birthday_reward:
        (cfg.birthday_reward || "").trim().slice(0, 80) ||
        "Une surprise offerte",
      referral_enabled: !!cfg.referral_enabled,
      // validité des cadeaux : 1 à 365 jours, ou null = illimité
      prize_validity_days:
        cfg.prize_validity_days && cfg.prize_validity_days > 0
          ? Math.min(365, Math.max(1, Math.round(cfg.prize_validity_days)))
          : null,
  };
  // Apparence (couleurs + décor) : ignorée si la page est verrouillée par
  // l'admin, pour ne pas écraser la personnalisation « Installation ».
  const appearance = themeLocked
    ? {}
    : {
        primary_color: hex(cfg.primary_color, "#ffc24d"),
        accent_color: hex(cfg.accent_color, "#ff5d73"),
        bg_color: hex(cfg.bg_color, "#150c29"),
        decor_emojis: (cfg.decor_emojis || "").trim().slice(0, 40) || null,
      };
  let { error: cfgErr } = await admin
    .from("wheel_configs")
    .upsert({ ...basePayload, ...appearance }, { onConflict: "business_id" });
  if (cfgErr && /decor_emojis/.test(cfgErr.message)) {
    // Migration 0027 absente : réessaie sans le décor.
    const { decor_emojis, ...appNoDecor } = appearance as any;
    ({ error: cfgErr } = await admin
      .from("wheel_configs")
      .upsert({ ...basePayload, ...appNoDecor }, { onConflict: "business_id" }));
  }
  if (cfgErr)
    return Response.json(
      { error: "config_error", detail: cfgErr.message },
      { status: 500 }
    );

  // Alerte « cadeau gagné » : colonne récente (0029), mise à jour isolée et
  // tolérante (si la colonne manque, on ignore sans casser l'enregistrement).
  try {
    const { error } = await admin
      .from("wheel_configs")
      .update({ play_alerts: !!cfg.play_alerts })
      .eq("business_id", business.id);
    if (error && !isMissingColumnError(error)) {
      reportError(error, { where: "dashboard/wheel", field: "play_alerts" });
      return Response.json(
        { error: "save_failed", detail: error.message },
        { status: 500 }
      );
    }
  } catch (e) {
    reportError(e, { where: "dashboard/wheel", field: "play_alerts" });
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  // Tirage au sort : colonnes récentes (0030/0031), mise à jour isolée.
  try {
    const { error } = await admin
      .from("wheel_configs")
      .update({
        monthly_draw: !!cfg.monthly_draw,
        monthly_draw_prize:
          (cfg.monthly_draw_prize || "").trim().slice(0, 80) || null,
      })
      .eq("business_id", business.id);
    if (error && !isMissingColumnError(error)) {
      reportError(error, { where: "dashboard/wheel", field: "monthly_draw" });
      return Response.json(
        { error: "save_failed", detail: error.message },
        { status: 500 }
      );
    }
  } catch (e) {
    reportError(e, { where: "dashboard/wheel", field: "monthly_draw" });
    return Response.json({ error: "save_failed" }, { status: 500 });
  }
  try {
    const period = [7, 14, 30, 90].includes(Number(cfg.draw_period_days))
      ? Number(cfg.draw_period_days)
      : 30;
    // Date valide (AAAA-MM-JJ) → minuit ce jour-là ; sinon on laisse le cron programmer.
    const nextDate =
      cfg.draw_next_at && /^\d{4}-\d{2}-\d{2}$/.test(cfg.draw_next_at)
        ? new Date(cfg.draw_next_at + "T00:00:00Z").toISOString()
        : null;
    const { error } = await admin
      .from("wheel_configs")
      .update({ draw_period_days: period, draw_next_at: nextDate })
      .eq("business_id", business.id);
    if (error && !isMissingColumnError(error)) {
      reportError(error, { where: "dashboard/wheel", field: "draw" });
      return Response.json(
        { error: "save_failed", detail: error.message },
        { status: 500 }
      );
    }
  } catch (e) {
    reportError(e, { where: "dashboard/wheel", field: "draw" });
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  // Actions déclenchantes (non-avis) : colonne récente (0045), mise à jour
  // isolée et tolérante (si la colonne manque, on ignore sans casser le reste).
  // 9.1 ne fait que persister la config ; le jeu n'est pas modifié.
  try {
    const { error } = await admin
      .from("wheel_configs")
      .update({
        trigger_actions: unlockedSpinActions(cfg.trigger_actions, {
          loyaltyEnabled: !!cfg.loyalty_enabled,
        }),
      })
      .eq("business_id", business.id);
    if (error && !isMissingColumnError(error)) {
      reportError(error, { where: "dashboard/wheel", field: "trigger_actions" });
      return Response.json(
        { error: "save_failed", detail: error.message },
        { status: 500 }
      );
    }
  } catch (e) {
    reportError(e, { where: "dashboard/wheel", field: "trigger_actions" });
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  // Relance « plus qu'un tampon » (0056) : mise à jour isolée et tolérante.
  try {
    const { error } = await admin
      .from("wheel_configs")
      .update({ reengage_almost: !!cfg.reengage_almost })
      .eq("business_id", business.id);
    if (error && !isMissingColumnError(error)) {
      reportError(error, { where: "dashboard/wheel", field: "reengage_almost" });
      return Response.json(
        { error: "save_failed", detail: error.message },
        { status: 500 }
      );
    }
  } catch (e) {
    reportError(e, { where: "dashboard/wheel", field: "reengage_almost" });
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  // Relance « client inactif » (0057) : délai borné 7–180 j. Isolée et tolérante.
  try {
    const days = Math.min(
      180,
      Math.max(7, Math.round(Number(cfg.reengage_inactive_days) || 30))
    );
    const { error } = await admin
      .from("wheel_configs")
      .update({
        reengage_inactive: !!cfg.reengage_inactive,
        reengage_inactive_days: days,
      })
      .eq("business_id", business.id);
    if (error && !isMissingColumnError(error)) {
      reportError(error, { where: "dashboard/wheel", field: "reengage_inactive" });
      return Response.json(
        { error: "save_failed", detail: error.message },
        { status: 500 }
      );
    }
  } catch (e) {
    reportError(e, { where: "dashboard/wheel", field: "reengage_inactive" });
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  // Relance « récompense débloquée » (0058) : mise à jour isolée et tolérante.
  try {
    const { error } = await admin
      .from("wheel_configs")
      .update({ reengage_reward: !!cfg.reengage_reward })
      .eq("business_id", business.id);
    if (error && !isMissingColumnError(error)) {
      reportError(error, { where: "dashboard/wheel", field: "reengage_reward" });
      return Response.json(
        { error: "save_failed", detail: error.message },
        { status: 500 }
      );
    }
  } catch (e) {
    reportError(e, { where: "dashboard/wheel", field: "reengage_reward" });
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  // Invitation à laisser un avis (0062) : mise à jour isolée et tolérante.
  try {
    const { error } = await admin
      .from("wheel_configs")
      .update({ review_invite: !!cfg.review_invite })
      .eq("business_id", business.id);
    if (error && !isMissingColumnError(error)) {
      reportError(error, { where: "dashboard/wheel", field: "review_invite" });
      return Response.json(
        { error: "save_failed", detail: error.message },
        { status: 500 }
      );
    }
  } catch (e) {
    reportError(e, { where: "dashboard/wheel", field: "review_invite" });
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  // Relance de conversion (0066) : mise à jour isolée et tolérante.
  try {
    const { error } = await admin
      .from("wheel_configs")
      .update({ convert_nudge: !!cfg.convert_nudge })
      .eq("business_id", business.id);
    if (error && !isMissingColumnError(error)) {
      reportError(error, { where: "dashboard/wheel", field: "convert_nudge" });
      return Response.json(
        { error: "save_failed", detail: error.message },
        { status: 500 }
      );
    }
  } catch (e) {
    reportError(e, { where: "dashboard/wheel", field: "convert_nudge" });
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  // Feedback privé (0071) : mise à jour isolée et tolérante.
  try {
    const { error } = await admin
      .from("wheel_configs")
      .update({ feedback_enabled: !!cfg.feedback_enabled })
      .eq("business_id", business.id);
    if (error && !isMissingColumnError(error)) {
      reportError(error, { where: "dashboard/wheel", field: "feedback_enabled" });
      return Response.json(
        { error: "save_failed", detail: error.message },
        { status: 500 }
      );
    }
  } catch (e) {
    reportError(e, { where: "dashboard/wheel", field: "feedback_enabled" });
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  // « À la une » : colonnes récentes (0055), mise à jour isolée et tolérante.
  // URL durcie (anti-XSS) ; date au format AAAA-MM-JJ, sinon null (pas d'expiration).
  try {
    const hlUntil =
      cfg.highlight_until && /^\d{4}-\d{2}-\d{2}$/.test(cfg.highlight_until)
        ? cfg.highlight_until
        : null;
    const { error } = await admin
      .from("wheel_configs")
      .update({
        highlight_title: (cfg.highlight_title || "").trim().slice(0, 60) || null,
        highlight_text: (cfg.highlight_text || "").trim().slice(0, 160) || null,
        highlight_url: hardenExternalUrl(cfg.highlight_url),
        highlight_until: hlUntil,
      })
      .eq("business_id", business.id);
    if (error && !isMissingColumnError(error)) {
      reportError(error, { where: "dashboard/wheel", field: "highlight" });
      return Response.json(
        { error: "save_failed", detail: error.message },
        { status: 500 }
      );
    }
  } catch (e) {
    reportError(e, { where: "dashboard/wheel", field: "highlight" });
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  // remplace la liste des cadeaux
  const prizes = (body.prizes ?? [])
    .filter((p) => p.label && p.label.trim())
    .slice(0, 20);
  if (prizes.length === 0) {
    return Response.json({ error: "no_prizes" }, { status: 400 });
  }

  await admin.from("prizes").delete().eq("business_id", business.id);
  const { error: insErr } = await insertPrizes(
    admin,
    prizes.map((p, i) => ({
      business_id: business.id,
      label: p.label.trim().slice(0, 40),
      emoji: (p.emoji || "🎁").slice(0, 8),
      weight: Math.max(0, Math.round(Number(p.weight) || 0)),
      color: /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : "#ff5d73",
      position: i,
    }))
  );
  if (insErr) return Response.json({ error: "prizes_error" }, { status: 500 });

  // La page de jeu publique met en cache config + lots : on l'invalide pour
  // que l'édition soit visible immédiatement (sans attendre la revalidation).
  revalidateTag(`biz-${business.slug}`);

  return Response.json({ ok: true });
}
