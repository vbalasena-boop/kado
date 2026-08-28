import { getAdminClient } from "@/lib/supabase/admin";
import { hasAccess, hasModule } from "@/lib/auth";
import { buildTheme } from "@/lib/theme";
import { visibleHighlight } from "@/lib/highlight";
import LoyaltyCard from "./LoyaltyCard";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
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
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { parrain?: string };
}) {
  const db = getAdminClient();
  const { data: biz } = await db
    .from("businesses")
    .select("id, name, logo_url, status, subscription_ends_at, plan, subscription_status")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!biz) return <Unavailable message="Cet établissement n'existe pas." />;
  if (!hasAccess(biz)) {
    return <Unavailable message="Ce service est momentanément indisponible." />;
  }
  if (!hasModule({ plan: biz.plan ?? "roue", subscription_status: biz.subscription_status ?? "trial" }, "fidelite")) {
    return (
      <Unavailable message="Ce commerce ne propose pas encore de carte de fidélité." />
    );
  }

  const { data: cfg } = await db
    .from("wheel_configs")
    .select(
      "loyalty_enabled, loyalty_goal, loyalty_reward, loyalty_reward_emoji, loyalty_stamp_emoji, primary_color, accent_color, bg_color, bg_image_url"
    )
    .eq("business_id", biz.id)
    .maybeSingle();

  if (!cfg?.loyalty_enabled) {
    return (
      <Unavailable message="Ce commerce ne propose pas encore de carte de fidélité." />
    );
  }

  // Même thème que la page de jeu → expérience cohérente pour le client.
  const themeCss = buildTheme(
    (cfg as any).primary_color || "#ffc24d",
    (cfg as any).accent_color || "#ff5d73",
    (cfg as any).bg_color || "#150c29",
    (cfg as any).bg_image_url || null
  );

  // « À la une » : lecture SÉPARÉE et tolérante (une colonne 0055 manquante ne
  // doit pas casser la carte de fidélité). Résolue avec la date du jour.
  const { data: hlRow } = await db
    .from("wheel_configs")
    .select("highlight_title, highlight_text, highlight_url, highlight_until")
    .eq("business_id", biz.id)
    .maybeSingle();
  const today = new Date().toISOString().slice(0, 10);
  const highlight = visibleHighlight(hlRow, today);

  // Feedback privé (lecture tolérante si colonne 0071 absente).
  let feedbackEnabled = false;
  try {
    const { data: fb } = await db
      .from("wheel_configs")
      .select("feedback_enabled")
      .eq("business_id", biz.id)
      .maybeSingle();
    feedbackEnabled = !!(fb as any)?.feedback_enabled;
  } catch {
    feedbackEnabled = false;
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      <LoyaltyCard
        slug={params.slug}
        name={biz.name}
        logoUrl={biz.logo_url}
        goal={cfg.loyalty_goal}
        reward={cfg.loyalty_reward}
        rewardEmoji={cfg.loyalty_reward_emoji}
        stampEmoji={cfg.loyalty_stamp_emoji || "⭐"}
        parrain={searchParams?.parrain?.trim() || null}
        highlight={highlight}
        feedbackEnabled={feedbackEnabled}
      />
    </>
  );
}
