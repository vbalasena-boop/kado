import { readPlayerId } from "@/lib/player";
import { getAdminClient } from "@/lib/supabase/admin";
import { hasAccess } from "@/lib/auth";
import Game from "./Game";

export const dynamic = "force-dynamic";

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
}: {
  params: { slug: string };
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
    .select("id, slug, name, logo_url, status, subscription_ends_at")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!biz) {
    return <Unavailable message="Cet établissement n'existe pas." />;
  }
  if (!hasAccess(biz)) {
    return (
      <Unavailable message="Ce jeu est momentanément indisponible. Revenez plus tard." />
    );
  }

  const [{ data: config }, { data: prizes }] = await Promise.all([
    supa
      .from("wheel_configs")
      .select(
        "primary_color, accent_color, bg_color, instagram_url, review_url, compliance_note"
      )
      .eq("business_id", biz.id)
      .maybeSingle(),
    supa
      .from("prizes")
      .select("id, label, emoji, weight, color, position")
      .eq("business_id", biz.id)
      .order("position", { ascending: true }),
  ]);

  // Tours déjà joués par ce navigateur (verrou côté serveur)
  const played: Record<string, { label: string; code: string }> = {};
  const playerId = readPlayerId();
  if (playerId) {
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
        }
      }
      played={played}
    />
  );
}
