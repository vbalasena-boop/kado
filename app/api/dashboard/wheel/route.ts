import { NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";

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

  // Canaux activés (au moins un doit rester actif)
  let igEnabled = cfg.instagram_enabled !== false;
  let rvEnabled = cfg.review_enabled !== false;
  if (!igEnabled && !rvEnabled) {
    igEnabled = true;
    rvEnabled = true;
  }

  // Couleurs : valeur hex valide sinon défaut
  const hex = (v: string | null | undefined, def: string) =>
    v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : def;

  // upsert config (1-1 avec business)
  const basePayload = {
      business_id: business.id,
      primary_color: hex(cfg.primary_color, "#ffc24d"),
      accent_color: hex(cfg.accent_color, "#ff5d73"),
      bg_color: hex(cfg.bg_color, "#150c29"),
      instagram_url: cfg.instagram_url || null,
      review_url: cfg.review_url || null,
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
  // décor animé : colonne récente (0027) → insertion tolérante
  const decor = (cfg.decor_emojis || "").trim().slice(0, 40) || null;
  let { error: cfgErr } = await admin
    .from("wheel_configs")
    .upsert({ ...basePayload, decor_emojis: decor }, { onConflict: "business_id" });
  if (cfgErr && /decor_emojis/.test(cfgErr.message)) {
    ({ error: cfgErr } = await admin
      .from("wheel_configs")
      .upsert(basePayload, { onConflict: "business_id" }));
  }
  if (cfgErr)
    return Response.json(
      { error: "config_error", detail: cfgErr.message },
      { status: 500 }
    );

  // remplace la liste des cadeaux
  const prizes = (body.prizes ?? [])
    .filter((p) => p.label && p.label.trim())
    .slice(0, 20);
  if (prizes.length === 0) {
    return Response.json({ error: "no_prizes" }, { status: 400 });
  }

  await admin.from("prizes").delete().eq("business_id", business.id);
  const { error: insErr } = await admin.from("prizes").insert(
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

  return Response.json({ ok: true });
}
