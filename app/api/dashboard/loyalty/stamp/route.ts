import { NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateCode } from "@/lib/draw";

export const dynamic = "force-dynamic";

/**
 * Ajoute un tampon à une carte de fidélité (ou marque une récompense comme
 * offerte). Réservé au commerçant connecté. Identification par code de carte
 * ou par e-mail du client.
 * action = 'stamp' (ajoute un tampon) | 'collect' (récompense remise).
 */
export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: { query?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const query = (body.query || "").trim();
  const action = body.action === "collect" ? "collect" : "stamp";
  if (!query) return Response.json({ status: "not_found" });

  const db = getAdminClient();

  // Réglages fidélité
  const { data: cfg } = await db
    .from("wheel_configs")
    .select("loyalty_enabled, loyalty_goal, loyalty_reward, loyalty_reward_emoji")
    .eq("business_id", business.id)
    .maybeSingle();
  if (!cfg?.loyalty_enabled) {
    return Response.json({ status: "loyalty_off" });
  }
  const goal = Math.max(1, cfg.loyalty_goal || 10);

  // Retrouve la carte par code (FID-…) puis par e-mail
  const isCode = /^fid-/i.test(query);
  let cardQ = db
    .from("loyalty_cards")
    .select("id, email, code, stamps, rewards_earned, reward_ready, reward_code")
    .eq("business_id", business.id);
  cardQ = isCode
    ? cardQ.eq("code", query.toUpperCase())
    : cardQ.eq("email", query.toLowerCase());
  const { data: card } = await cardQ.maybeSingle();
  if (!card) return Response.json({ status: "not_found" });

  const view = (c: {
    email: string;
    code: string;
    stamps: number;
    rewards_earned: number;
    reward_ready: boolean;
  }) => ({
    email: c.email,
    code: c.code,
    stamps: c.stamps,
    goal,
    rewardsEarned: c.rewards_earned,
    rewardReady: c.reward_ready,
    reward: cfg.loyalty_reward,
    rewardEmoji: cfg.loyalty_reward_emoji,
  });

  // Récompense en attente : on marque comme offerte
  if (action === "collect") {
    if (!card.reward_ready) {
      return Response.json({ status: "nothing_to_collect", card: view(card) });
    }
    const { error } = await db
      .from("loyalty_cards")
      .update({ reward_ready: false, reward_code: null })
      .eq("id", card.id);
    if (error) return Response.json({ error: "update_failed" }, { status: 500 });
    return Response.json({
      status: "collected",
      card: view({ ...card, reward_ready: false }),
    });
  }

  // Ajout d'un tampon — mais d'abord offrir la récompense en attente
  if (card.reward_ready) {
    return Response.json({ status: "reward_pending", card: view(card) });
  }

  const newStamps = card.stamps + 1;
  if (newStamps >= goal) {
    // carte complète → récompense débloquée, nouveau cycle
    const rewardCode = generateCode("RC");
    const { error } = await db
      .from("loyalty_cards")
      .update({
        stamps: 0,
        rewards_earned: card.rewards_earned + 1,
        reward_ready: true,
        reward_code: rewardCode,
        last_stamp_at: new Date().toISOString(),
      })
      .eq("id", card.id);
    if (error) return Response.json({ error: "update_failed" }, { status: 500 });
    return Response.json({
      status: "completed",
      card: view({
        ...card,
        stamps: 0,
        rewards_earned: card.rewards_earned + 1,
        reward_ready: true,
      }),
    });
  }

  const { error } = await db
    .from("loyalty_cards")
    .update({ stamps: newStamps, last_stamp_at: new Date().toISOString() })
    .eq("id", card.id);
  if (error) return Response.json({ error: "update_failed" }, { status: 500 });
  return Response.json({
    status: "stamped",
    card: view({ ...card, stamps: newStamps }),
  });
}
