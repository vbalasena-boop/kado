import { getAdminClient } from "@/lib/supabase/admin";
import { hasAccess } from "@/lib/auth";
import LoyaltyCard from "./LoyaltyCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function Unavailable({ message }: { message: string }) {
  return (
    <main className="landing">
      <div className="landing-card">
        <div className="landing-logo">🎟️</div>
        <h1>Carte indisponible</h1>
        <p>{message}</p>
      </div>
    </main>
  );
}

export default async function FidelitePage({
  params,
}: {
  params: { slug: string };
}) {
  const db = getAdminClient();
  const { data: biz } = await db
    .from("businesses")
    .select("id, name, logo_url, status, subscription_ends_at")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!biz) return <Unavailable message="Cet établissement n'existe pas." />;
  if (!hasAccess(biz)) {
    return <Unavailable message="Ce service est momentanément indisponible." />;
  }

  const { data: cfg } = await db
    .from("wheel_configs")
    .select("loyalty_enabled, loyalty_goal, loyalty_reward, loyalty_reward_emoji")
    .eq("business_id", biz.id)
    .maybeSingle();

  if (!cfg?.loyalty_enabled) {
    return (
      <Unavailable message="Ce commerce ne propose pas encore de carte de fidélité." />
    );
  }

  return (
    <LoyaltyCard
      slug={params.slug}
      name={biz.name}
      logoUrl={biz.logo_url}
      goal={cfg.loyalty_goal}
      reward={cfg.loyalty_reward}
      rewardEmoji={cfg.loyalty_reward_emoji}
    />
  );
}
