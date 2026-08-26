import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { merchantRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateCode } from "@/lib/draw";
import { sendEmail, emailLayout } from "@/lib/email";
import { escapeHtml, SITE } from "@/lib/campaigns";
import { unsubToken } from "@/lib/unsub";

export const dynamic = "force-dynamic";

/**
 * E-mail « récompense débloquée » (transactionnel, best-effort, jamais bloquant).
 * Envoyé quand une carte se complète, SI le commerçant a activé la relance
 * (`reengage_reward`, lu de façon tolérante) et si le client n'est pas
 * désinscrit. Contient le code de récompense à présenter en caisse.
 */
async function maybeSendRewardEmail(
  db: SupabaseClient,
  business: { id: string; name: string },
  cfg: { loyalty_reward?: string | null; loyalty_reward_emoji?: string | null },
  card: { email: string; unsubscribed_at?: string | null },
  rewardCode: string
) {
  try {
    if (!card.email || card.unsubscribed_at) return;
    // Toggle commerçant (colonne 0058 absente → désactivé par défaut).
    const { data: rr, error } = await db
      .from("wheel_configs")
      .select("reengage_reward")
      .eq("business_id", business.id)
      .maybeSingle();
    if (error || !(rr as any)?.reengage_reward) return;

    const shop = escapeHtml(business.name || "votre commerce");
    const reward = escapeHtml((cfg.loyalty_reward || "votre récompense").toString());
    const emoji = cfg.loyalty_reward_emoji || "🎁";
    const code = escapeHtml(rewardCode);
    const unsub = `${SITE}/api/unsubscribe?b=${business.id}&e=${encodeURIComponent(
      Buffer.from(card.email).toString("base64url")
    )}&t=${unsubToken(business.id, card.email)}`;

    await sendEmail({
      to: card.email,
      subject: `Bravo ! Votre récompense est débloquée chez ${business.name} ${emoji}`,
      fromName: `${business.name} via Kado`,
      marketing: false,
      html: emailLayout({
        preview: "Votre carte de fidélité est complète 🎉",
        heading: "Récompense débloquée ! 🎉",
        emoji,
        bodyHtml: `Félicitations, votre carte de fidélité chez <b>${shop}</b> est complète&nbsp;! Vous avez débloqué&nbsp;: <b>${emoji} ${reward}</b>.<br><br>Présentez ce code en caisse lors de votre prochaine visite&nbsp;:<br><br><span style="display:inline-block;font-family:monospace;font-size:26px;font-weight:800;letter-spacing:2px;background:#f4f0ff;border-radius:12px;padding:12px 18px;color:#1b1035;">${code}</span>`,
        footnote: `Message lié à votre carte de fidélité. <a href="${unsub}" style="color:#9a94b4;">Ne plus recevoir ces e-mails</a>`,
      }),
    });
  } catch {
    /* best-effort : ne doit jamais faire échouer le tampon */
  }
}

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

    // Réservation ATOMIQUE du bonus : on bascule referred_reward_granted_at de
    // NULL → maintenant, et on ne poursuit QUE si CET appel a fait la bascule.
    // Deux tampons concurrents du même filleul ne peuvent donc pas créditer le
    // parrain deux fois (course « lecture null puis écriture »).
    const { data: claimed } = await db
      .from("loyalty_cards")
      .update({ referred_reward_granted_at: nowIso })
      .eq("id", stampedCardId)
      .is("referred_reward_granted_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) return; // déjà réservé ailleurs

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
  // La fidélité (tampons/récompenses) est réservée aux formules qui l'incluent.
  // L'UI le masque déjà ; on ferme aussi l'accès direct à l'API (défense en
  // profondeur). Sûr : un commerce sans fidélité n'a pas de carte à tamponner.
  requireModule: "fidelite",
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
      .select(
        "id, email, code, stamps, rewards_earned, reward_ready, reward_code, unsubscribed_at"
      )
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
      // Relance positive « récompense débloquée » (best-effort, non bloquant).
      await maybeSendRewardEmail(db, business, cfg, card, rewardCode);
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
