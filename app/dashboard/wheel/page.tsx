import { getMyBusiness, hasModule } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
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
