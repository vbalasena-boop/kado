import { readPlayerId } from "@/lib/player";
import { redirect } from "next/navigation";
import { getAdminClient } from "@/lib/supabase/admin";
import { hasAccess, hasModule, getSessionUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin-guard";
import Game from "./Game";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
// Page « application » propre à chaque commerce : non indexée pour ne pas
// diluer le référencement du site (Google se concentre sur les pages marketing).
export const metadata = { robots: { index: false, follow: false } };

function Unavailable({ message }: { message: string }) {
  return (
    <main className="landing">
      <div className="landing-card">
        <div className="landing-logo">🚫</div>
        <h1>Page indisponible</h1>
        <p>{message}</p>
      </div>
    </main>
  );
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { preview?: string };
}) {
  let supa;
  try {
    supa = getAdminClient();
  } catch {
    return (
      <Unavailable message="Le service n'est pas encore configuré (base de données manquante)." />
    );
  }

  const { data: biz } = await supa
    .from("businesses")
    .select(
      "id, slug, name, logo_url, status, subscription_ends_at, owner_user_id, plan, subscription_status"
    )
    .eq("slug", params.slug)
    .maybeSingle();

  if (!biz) {
    return <Unavailable message="Cet établissement n'existe pas." />;
  }

  // Mode test : réservé au propriétaire connecté (ou à un admin)
  let preview = false;
  if (searchParams?.preview === "1") {
    const user = await getSessionUser();
    if (
      user &&
      (user.id === biz.owner_user_id || isAdminEmail(user.email))
    ) {
      preview = true;
    }
  }

  if (!preview && !hasAccess(biz)) {
    return (
      <Unavailable message="Ce jeu est momentanément indisponible. Revenez plus tard." />
    );
  }

  const bizForPlan = { plan: biz.plan ?? "roue", subscription_status: biz.subscription_status ?? "trial" };
  if (!preview && !hasModule(bizForPlan, "roue")) {
    redirect(`/${biz.slug}/fidelite`);
  }

  const [{ data: config }, { data: prizes }] = await Promise.all([
    supa
      .from("wheel_configs")
      .select(
        "primary_color, accent_color, bg_color, bg_image_url, collect_email, instagram_url, review_url, compliance_note, instagram_enabled, review_enabled, loyalty_enabled, game_type"
      )
      .eq("business_id", biz.id)
      .maybeSingle(),
    supa
      .from("prizes")
      .select("id, label, emoji, weight, color, position")
      .eq("business_id", biz.id)
      .order("position", { ascending: true }),
  ]);

  // Click & collect actif ? (lecture tolérante si migration absente)
  let orderEnabled = false;
  try {
    const { data: cc } = await supa
      .from("businesses")
      .select("click_collect")
      .eq("id", biz.id)
      .maybeSingle();
    orderEnabled = !!(cc as any)?.click_collect;
  } catch {
    orderEnabled = false;
  }

  // Validité des cadeaux (lecture tolérante, 30 j par défaut)
  const { data: pv, error: pvErr } = await supa
    .from("wheel_configs")
    .select("prize_validity_days")
    .eq("business_id", biz.id)
    .maybeSingle();
  const prizeValidity: number | null =
    pvErr || !pv ? 30 : ((pv as any).prize_validity_days ?? null);

  // Décor animé (lecture tolérante si la migration 0027 manque)
  const { data: dec, error: decErr } = await supa
    .from("wheel_configs")
    .select("decor_emojis")
    .eq("business_id", biz.id)
    .maybeSingle();
  const decorEmojis: string = decErr ? "" : ((dec as any)?.decor_emojis ?? "");

  // Tours déjà joués par ce navigateur (verrou côté serveur)
  const played: Record<string, { label: string; code: string }> = {};
  const playerId = readPlayerId();
  if (playerId && !preview) {
    const { data: rows } = await supa
      .from("plays")
      .select("play_type, prize_label, prize_code")
      .eq("business_id", biz.id)
      .eq("player_id", playerId);
    for (const r of rows ?? []) {
      played[r.play_type] = { label: r.prize_label, code: r.prize_code };
    }
  }

  return (
    <Game
      slug={biz.slug}
      name={biz.name}
      logoUrl={biz.logo_url}
      orderEnabled={orderEnabled}
      prizeValidityDays={prizeValidity}
      decorEmojis={decorEmojis}
      prizes={prizes ?? []}
      config={
        config ?? {
          primary_color: "#ffc24d",
          accent_color: "#ff5d73",
          bg_color: "#150c29",
          instagram_url: null,
          review_url: null,
          compliance_note:
            "Le cadeau n'est pas conditionné à la note laissée.",
          instagram_enabled: true,
          review_enabled: true,
          loyalty_enabled: false,
          game_type: "wheel",
        }
      }
      played={played}
      preview={preview}
    />
  );
}
