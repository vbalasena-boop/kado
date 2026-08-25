import { getMyBusiness, hasModule } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { sanitizeTriggerActions } from "@/lib/wheel";
import WheelEditor from "./WheelEditor";

export const dynamic = "force-dynamic";

export default async function WheelPage() {
  const { business } = await getMyBusiness();
  if (!business) return null;

  const admin = getAdminClient();
  const [{ data: config }, { data: prizes }] = await Promise.all([
    admin
      .from("wheel_configs")
      .select(
        "primary_color, accent_color, bg_color, instagram_url, review_url, compliance_note, daily_prize_limit, bg_image_url, collect_email, instagram_enabled, review_enabled, loyalty_enabled, loyalty_goal, loyalty_reward, loyalty_reward_emoji, loyalty_stamp_emoji, game_type, birthday_enabled, birthday_reward, referral_enabled"
      )
      .eq("business_id", business.id)
      .maybeSingle(),
    admin
      .from("prizes")
      .select("id, label, emoji, weight, color, position")
      .eq("business_id", business.id)
      .order("position", { ascending: true }),
  ]);

  // Validité des cadeaux (lecture tolérante si la migration 0025 manque)
  const { data: v, error: vErr } = await admin
    .from("wheel_configs")
    .select("prize_validity_days")
    .eq("business_id", business.id)
    .maybeSingle();
  const prizeValidity: number | null =
    vErr || !v ? 30 : ((v as any).prize_validity_days ?? null);

  // Décor animé (lecture tolérante si la migration 0027 manque)
  const { data: dec, error: decErr } = await admin
    .from("wheel_configs")
    .select("decor_emojis")
    .eq("business_id", business.id)
    .maybeSingle();
  const decorEmojis: string = decErr ? "" : ((dec as any)?.decor_emojis ?? "");

  // Page verrouillée par l'admin (lecture tolérante si migration 0028 absente)
  const { data: tl, error: tlErr } = await admin
    .from("wheel_configs")
    .select("theme_locked")
    .eq("business_id", business.id)
    .maybeSingle();
  const themeLocked: boolean = tlErr ? false : !!(tl as any)?.theme_locked;

  // Alerte cadeau gagné (lecture tolérante si migration 0029 absente)
  const { data: pa, error: paErr } = await admin
    .from("wheel_configs")
    .select("play_alerts")
    .eq("business_id", business.id)
    .maybeSingle();
  const playAlerts: boolean = paErr ? false : !!(pa as any)?.play_alerts;

  // Tirage au sort (lecture tolérante si migrations 0030/0031 absentes)
  const { data: md, error: mdErr } = await admin
    .from("wheel_configs")
    .select("monthly_draw, monthly_draw_prize, draw_period_days, draw_next_at")
    .eq("business_id", business.id)
    .maybeSingle();
  const monthlyDraw: boolean = mdErr ? false : !!(md as any)?.monthly_draw;
  const monthlyDrawPrize: string = mdErr
    ? ""
    : ((md as any)?.monthly_draw_prize ?? "");
  const drawPeriodDays: number = mdErr
    ? 30
    : ((md as any)?.draw_period_days ?? 30);
  const drawNextAt: string | null = mdErr
    ? null
    : ((md as any)?.draw_next_at ?? null);

  // Actions déclenchantes non-avis (lecture tolérante si migration 0045 absente)
  const { data: ta, error: taErr } = await admin
    .from("wheel_configs")
    .select("trigger_actions")
    .eq("business_id", business.id)
    .maybeSingle();
  const triggerActions: string[] = taErr
    ? ["instagram"]
    : sanitizeTriggerActions((ta as any)?.trigger_actions);

  return (
    <WheelEditor
      initialConfig={{
        ...(config ?? {
          primary_color: "#ffc24d",
          instagram_url: "",
          review_url: "",
          compliance_note: "Le cadeau n'est pas conditionné à la note laissée.",
        }),
        prize_validity_days: prizeValidity,
        decor_emojis: decorEmojis,
        theme_locked: themeLocked,
        play_alerts: playAlerts,
        monthly_draw: monthlyDraw,
        monthly_draw_prize: monthlyDrawPrize,
        draw_period_days: drawPeriodDays,
        draw_next_at: drawNextAt,
        trigger_actions: triggerActions,
      }}
      initialPrizes={prizes ?? []}
      initialLogoUrl={business.logo_url}
      initialBgUrl={config?.bg_image_url ?? null}
      showRoue={hasModule(business, "roue")}
      showFidelite={hasModule(business, "fidelite")}
      plan={business.plan}
    />
  );
}
