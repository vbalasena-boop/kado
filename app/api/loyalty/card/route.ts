import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateCode } from "@/lib/draw";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Récupère (ou crée) la carte de fidélité d'un client pour un établissement,
 * identifiée par son e-mail. Renvoie l'état public de la carte + les réglages.
 */
export async function POST(req: NextRequest) {
  let body: { slug?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const slug = (body.slug || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  if (!slug || !EMAIL_RE.test(email)) {
    return Response.json({ error: "bad_email" }, { status: 400 });
  }

  const db = getAdminClient();
  const { data: biz } = await db
    .from("businesses")
    .select("id, name, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!biz || biz.status !== "active") {
    return Response.json({ error: "unavailable" }, { status: 404 });
  }

  const { data: cfg } = await db
    .from("wheel_configs")
    .select("loyalty_enabled, loyalty_goal, loyalty_reward, loyalty_reward_emoji, loyalty_stamp_emoji")
    .eq("business_id", biz.id)
    .maybeSingle();
  if (!cfg?.loyalty_enabled) {
    return Response.json({ error: "loyalty_off" }, { status: 404 });
  }

  // get-or-create
  let { data: card } = await db
    .from("loyalty_cards")
    .select("code, stamps, rewards_earned, reward_ready, reward_code")
    .eq("business_id", biz.id)
    .eq("email", email)
    .maybeSingle();

  if (!card) {
    // code de carte unique pour cet établissement
    let code = generateCode("FID");
    for (let i = 0; i < 6; i++) {
      const { data: clash } = await db
        .from("loyalty_cards")
        .select("id")
        .eq("business_id", biz.id)
        .eq("code", code)
        .maybeSingle();
      if (!clash) break;
      code = generateCode("FID");
    }
    const { data: created, error } = await db
      .from("loyalty_cards")
      .insert({ business_id: biz.id, email, code })
      .select("code, stamps, rewards_earned, reward_ready, reward_code")
      .single();
    if (error || !created) {
      // course possible : on retente une lecture
      const { data: again } = await db
        .from("loyalty_cards")
        .select("code, stamps, rewards_earned, reward_ready, reward_code")
        .eq("business_id", biz.id)
        .eq("email", email)
        .maybeSingle();
      if (!again) {
        return Response.json({ error: "create_failed" }, { status: 500 });
      }
      card = again;
    } else {
      card = created;
    }
  }

  return Response.json({
    ok: true,
    business: biz.name,
    code: card.code,
    stamps: card.stamps,
    goal: cfg.loyalty_goal,
    rewardsEarned: card.rewards_earned,
    rewardReady: card.reward_ready,
    rewardCode: card.reward_ready ? card.reward_code : null,
    reward: cfg.loyalty_reward,
    rewardEmoji: cfg.loyalty_reward_emoji,
    stampEmoji: cfg.loyalty_stamp_emoji || "⭐",
  });
}
