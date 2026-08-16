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
        "primary_color, instagram_url, review_url, compliance_note, daily_prize_limit, bg_image_url, collect_email, instagram_enabled, review_enabled, loyalty_enabled, loyalty_goal, loyalty_reward, loyalty_reward_emoji, loyalty_stamp_emoji, game_type"
      )
      .eq("business_id", business.id)
      .maybeSingle(),
    admin
      .from("prizes")
      .select("id, label, emoji, weight, color, position")
      .eq("business_id", business.id)
      .order("position", { ascending: true }),
  ]);

  return (
    <WheelEditor
      initialConfig={
        config ?? {
          primary_color: "#ffc24d",
          instagram_url: "",
          review_url: "",
          compliance_note: "Le cadeau n'est pas conditionné à la note laissée.",
        }
      }
      initialPrizes={prizes ?? []}
      initialLogoUrl={business.logo_url}
      initialBgUrl={config?.bg_image_url ?? null}
      showRoue={hasModule(business, "roue")}
      showFidelite={hasModule(business, "fidelite")}
      plan={business.plan}
    />
  );
}
