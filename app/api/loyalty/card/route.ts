import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateCode } from "@/lib/draw";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sendEmail, emailLayout } from "@/lib/email";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const CARD_COLS = "id, code, stamps, rewards_earned, reward_ready, reward_code";
const CARD_COLS_EXT = `${CARD_COLS}, birthday_day, marketing_ok`;

/**
 * Récupère (ou crée) la carte de fidélité d'un client pour un établissement,
 * identifiée par son e-mail. Gère le parrainage : une création via un lien
 * de parrain crédite ce dernier d'un tampon (une fois par filleul).
 */
export async function POST(req: NextRequest) {
  // Anti-abus : 20 ouvertures de carte/min max par IP
  const ip = clientIp(req);
  if (!(await rateLimit(`loyalty:${ip}`, 20, 60))) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: { slug?: string; email?: string; parrain?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
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
  let justCreated = false;

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
      justCreated = true;
    }

    // Bonus parrain : +1 tampon (une fois par filleul réellement inscrit)
    if (justCreated && sponsor && !sponsor.reward_ready) {
      const goal = cfg.loyalty_goal || 10;
      const ns = (sponsor.stamps || 0) + 1;
      const nowIso = new Date().toISOString();
      if (ns >= goal) {
        await db
          .from("loyalty_cards")
          .update({
            stamps: 0,
            rewards_earned: (sponsor.rewards_earned || 0) + 1,
            reward_ready: true,
            reward_code: generateCode("RC"),
            last_stamp_at: nowIso,
          })
          .eq("id", sponsor.id);
      } else {
        await db
          .from("loyalty_cards")
          .update({ stamps: ns, last_stamp_at: nowIso })
          .eq("id", sponsor.id);
      }
      await sendEmail({
        to: sponsor.email,
        subject: `+1 tampon chez ${biz.name} — merci pour le parrainage !`,
        html: emailLayout({
          preview: "Votre ami a rejoint la carte de fidélité.",
          heading: "Votre ami a rejoint — +1 tampon ! 🤝",
          emoji: "🎟️",
          bodyHtml: `Bonne nouvelle : la personne que vous avez invitée vient de créer sa carte de fidélité chez <b>${biz.name}</b>. Votre carte gagne <b>+1 tampon</b>.${
            ns >= goal
              ? " Et ce tampon complète votre carte : votre récompense est débloquée ! 🎉"
              : ""
          }`,
          footnote: "Ouvrez votre carte pour voir votre progression.",
        }),
      });
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
    stampEmoji: (cfg as any).loyalty_stamp_emoji || "⭐",
    birthdayEnabled,
    referralEnabled,
    birthdaySet: card.birthday_day != null,
    marketingOk: !!card.marketing_ok,
  });
}
