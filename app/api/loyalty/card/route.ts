import { z } from "zod";
import { publicRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateCode } from "@/lib/draw";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const CARD_COLS = "id, code, stamps, rewards_earned, reward_ready, reward_code";
const CARD_COLS_EXT = `${CARD_COLS}, birthday_day, marketing_ok, unsubscribed_at`;

// Schéma permissif : la validation métier (e-mail, présence) reste dans le handler.
const Body = z.object({
  slug: z.string().optional(),
  email: z.string().optional(),
  parrain: z.string().optional(),
});

/**
 * Récupère (ou crée) la carte de fidélité d'un client pour un établissement,
 * identifiée par son e-mail. Gère le parrainage : une création via un lien
 * de parrain crédite ce dernier d'un tampon (une fois par filleul).
 */
export const POST = publicRoute({
  schema: Body,
  // Anti-abus : 20 ouvertures de carte/min max par IP
  rateLimit: { key: ({ ip }) => `loyalty:${ip}`, limit: 20, windowSeconds: 60 },
  handler: async ({ body }) => {
    const slug = (body.slug || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const parrain = (body.parrain || "").trim().toUpperCase() || null;
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
      .select(
        "loyalty_enabled, loyalty_goal, loyalty_reward, loyalty_reward_emoji, loyalty_stamp_emoji"
      )
      .eq("business_id", biz.id)
      .maybeSingle();
    if (!cfg?.loyalty_enabled) {
      return Response.json({ error: "loyalty_off" }, { status: 404 });
    }

    // Options facultatives (colonnes récentes → lecture tolérante)
    let birthdayEnabled = false;
    let referralEnabled = false;
    try {
      const { data: opts } = await db
        .from("wheel_configs")
        .select("birthday_enabled, referral_enabled")
        .eq("business_id", biz.id)
        .maybeSingle();
      birthdayEnabled = !!(opts as any)?.birthday_enabled;
      referralEnabled = !!(opts as any)?.referral_enabled;
    } catch {
      /* migration non passée */
    }

    // Lecture de la carte (avec repli si les colonnes récentes manquent)
    async function readCard() {
      const q = (cols: string) =>
        db
          .from("loyalty_cards")
          .select(cols)
          .eq("business_id", biz!.id)
          .eq("email", email)
          .maybeSingle();
      const { data, error } = await q(CARD_COLS_EXT);
      if (!error) return data as any;
      const { data: basic } = await q(CARD_COLS);
      return basic as any;
    }

    let card = await readCard();

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

      // Parrain valable ? (carte du même commerce, autre e-mail)
      let sponsor: any = null;
      if (parrain && referralEnabled) {
        const { data: s } = await db
          .from("loyalty_cards")
          .select("id, email, stamps, rewards_earned, reward_ready")
          .eq("business_id", biz.id)
          .eq("code", parrain)
          .maybeSingle();
        if (s && s.email !== email) sponsor = s;
      }

      const base = { business_id: biz.id, email, code };
      let created: any = null;
      if (sponsor) {
        const { data: c1, error: e1 } = await db
          .from("loyalty_cards")
          .insert({ ...base, referred_by_card: sponsor.id })
          .select(CARD_COLS)
          .single();
        if (!e1) created = c1;
      }
      if (!created) {
        const { data: c2, error: e2 } = await db
          .from("loyalty_cards")
          .insert(base)
          .select(CARD_COLS)
          .single();
        if (e2) {
          // course possible : on retente une lecture
          card = await readCard();
          if (!card) {
            return Response.json({ error: "create_failed" }, { status: 500 });
          }
        } else {
          created = c2;
        }
      }
      if (created) {
        card = created;
      }
      // Note : le bonus du parrain n'est PAS accordé ici. Il le sera au
      // premier achat du filleul (premier tampon validé en caisse) — voir
      // /api/dashboard/loyalty/stamp.
    }

    // Parrainage 2.0 : compteur de filleuls (rendu visible sur la carte pour
    // motiver le partage). Tolérant : colonnes récentes / erreur → 0.
    let referralCount = 0;
    let referralRewarded = 0;
    if (referralEnabled && card?.id) {
      try {
        const [{ count: joined }, { count: rewarded }] = await Promise.all([
          db
            .from("loyalty_cards")
            .select("*", { count: "exact", head: true })
            .eq("business_id", biz.id)
            .eq("referred_by_card", card.id),
          db
            .from("loyalty_cards")
            .select("*", { count: "exact", head: true })
            .eq("business_id", biz.id)
            .eq("referred_by_card", card.id)
            .not("referred_reward_granted_at", "is", null),
        ]);
        referralCount = joined ?? 0;
        referralRewarded = rewarded ?? 0;
      } catch {
        /* colonnes/migration absentes : compteur masqué (0) */
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
      // Le code de récompense n'est JAMAIS renvoyé côté public (défense en
      // profondeur) : la validation se fait en caisse par le commerçant, qui
      // voit l'état « récompense prête ». Le client affiche « Montrez cette
      // carte au commerçant » sans avoir besoin du code.
      reward: cfg.loyalty_reward,
      rewardEmoji: cfg.loyalty_reward_emoji,
      stampEmoji: (cfg as any).loyalty_stamp_emoji || "⭐",
      birthdayEnabled,
      referralEnabled,
      referralCount,
      referralRewarded,
      birthdaySet: card.birthday_day != null,
      marketingOk: !!card.marketing_ok,
      unsubscribed: !!card.unsubscribed_at,
    });
  },
});
