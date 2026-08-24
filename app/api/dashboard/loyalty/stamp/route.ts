import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { merchantRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateCode } from "@/lib/draw";
import { sendEmail, emailLayout } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Bonus de parrainage : au PREMIER achat du filleul (premier tampon validé
 * en caisse), le parrain gagne +1 tampon — une seule fois par filleul.
 * Si le parrain a une récompense en attente, le bonus est réessayé au
 * prochain tampon du filleul. Tolérant si les colonnes manquent.
 */
async function grantReferralBonus(
  db: SupabaseClient,
  businessId: string,
  businessName: string,
  goal: number,
  stampedCardId: string
) {
  try {
    const { data: ref } = await db
      .from("loyalty_cards")
      .select("id, referred_by_card, referred_reward_granted_at")
      .eq("id", stampedCardId)
      .maybeSingle();
    if (!ref?.referred_by_card || ref.referred_reward_granted_at) return;

    const { data: opts } = await db
      .from("wheel_configs")
      .select("referral_enabled")
      .eq("business_id", businessId)
      .maybeSingle();
    if (!(opts as any)?.referral_enabled) return;

    const { data: sponsor } = await db
      .from("loyalty_cards")
      .select("id, email, stamps, rewards_earned, reward_ready")
      .eq("id", ref.referred_by_card)
      .maybeSingle();
    // récompense en attente chez le parrain → on retentera plus tard
    if (!sponsor || sponsor.reward_ready) return;

    const nowIso = new Date().toISOString();
    const ns = (sponsor.stamps || 0) + 1;
    const completes = ns >= goal;
    await db
      .from("loyalty_cards")
      .update(
        completes
          ? {
              stamps: 0,
              rewards_earned: (sponsor.rewards_earned || 0) + 1,
              reward_ready: true,
              reward_code: generateCode("RC"),
              last_stamp_at: nowIso,
            }
          : { stamps: ns, last_stamp_at: nowIso }
      )
      .eq("id", sponsor.id);
    await db
      .from("loyalty_cards")
      .update({ referred_reward_granted_at: nowIso })
      .eq("id", stampedCardId);

    await sendEmail({
      to: sponsor.email,
      subject: `+1 tampon chez ${businessName} — merci pour le parrainage !`,
      fromName: `${businessName} via Kado`,
      html: emailLayout({
        preview: "Votre filleul a fait son premier achat.",
        heading: "Votre filleul est passé en caisse — +1 tampon ! 🤝",
        emoji: "🎟️",
        bodyHtml: `Bonne nouvelle : la personne que vous avez invitée vient de faire son premier achat chez <b>${businessName}</b>. Votre carte gagne <b>+1 tampon</b>.${
          completes
            ? " Et ce tampon complète votre carte : votre récompense est débloquée ! 🎉"
            : ""
        }`,
        footnote: "Ouvrez votre carte pour voir votre progression.",
      }),
    });
  } catch {
    /* le bonus ne doit jamais faire échouer le tampon */
  }
}

const Body = z.object({
  query: z.unknown().optional(),
  action: z.unknown().optional(),
});

/**
 * Ajoute un tampon à une carte de fidélité (ou marque une récompense comme
 * offerte). Réservé au commerçant connecté. Identification par code de carte
 * ou par e-mail du client.
 * action = 'stamp' (ajoute un tampon) | 'collect' (récompense remise).
 */
export const POST = merchantRoute({
  schema: Body,
  handler: async ({ body: rawBody, business }) => {
    const body = rawBody as { query?: string; action?: string };
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
      await grantReferralBonus(db, business.id, business.name, goal, card.id);
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
    await grantReferralBonus(db, business.id, business.name, goal, card.id);
    return Response.json({
      status: "stamped",
      card: view({ ...card, stamps: newStamps }),
    });
  },
});
