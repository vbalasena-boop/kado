import { readPlayerId } from "@/lib/player";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { getAdminClient } from "@/lib/supabase/admin";
import { hasAccess, hasModule, getSessionUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin-guard";
import { visibleHighlight } from "@/lib/highlight";
import Game from "./Game";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
// Page « application » propre à chaque commerce : non indexée pour ne pas
// diluer le référencement du site (Google se concentre sur les pages marketing).
export const metadata = { robots: { index: false, follow: false } };

const BIZ_BASE =
  "id, slug, name, logo_url, status, subscription_ends_at, owner_user_id, plan, subscription_status";
const CFG_BASE =
  "primary_color, accent_color, bg_color, bg_image_url, collect_email, instagram_url, review_url, compliance_note, instagram_enabled, review_enabled, loyalty_enabled, game_type";
const CFG_WIDE = `${CFG_BASE}, prize_validity_days, decor_emojis, monthly_draw, monthly_draw_prize, trigger_actions, highlight_title, highlight_text, highlight_url, highlight_until, feedback_enabled`;

type PublicData = {
  biz: any | null;
  config: any | null;
  cfgWide: boolean;
  prizes: any[];
};

/**
 * Données publiques d'une page de jeu (établissement + config de roue + lots).
 * Identiques pour tous les visiteurs d'un même commerce → mises en cache par
 * slug (revalidation 60 s + invalidation par tag `biz-<slug>` à chaque édition
 * côté commerçant). Les données personnalisées (tours joués) restent hors cache.
 */
function loadPublicData(slug: string): Promise<PublicData> {
  return unstable_cache(
    async (): Promise<PublicData> => {
      const supa = getAdminClient();
      // Établissement : lecture unique, `click_collect` inclus (repli si la
      // migration 0019 n'est pas encore appliquée).
      let bizRes = await supa
        .from("businesses")
        .select(`${BIZ_BASE}, click_collect, demo`)
        .eq("slug", slug)
        .maybeSingle();
      if (bizRes.error) {
        bizRes = await supa
          .from("businesses")
          .select(BIZ_BASE)
          .eq("slug", slug)
          .maybeSingle();
      }
      const biz = bizRes.data as any;
      if (!biz) return { biz: null, config: null, cfgWide: false, prizes: [] };

      // Config (un seul select large, repli global) + lots, en parallèle.
      const [cfg, prizes] = await Promise.all([
        (async () => {
          let r = await supa
            .from("wheel_configs")
            .select(CFG_WIDE)
            .eq("business_id", biz.id)
            .maybeSingle();
          if (r.error) {
            r = await supa
              .from("wheel_configs")
              .select(CFG_BASE)
              .eq("business_id", biz.id)
              .maybeSingle();
            return { data: r.data as any, wide: false };
          }
          return { data: r.data as any, wide: true };
        })(),
        supa
          .from("prizes")
          .select("id, label, emoji, weight, color, position")
          .eq("business_id", biz.id)
          .order("position", { ascending: true })
          .then((r) => r.data ?? []),
      ]);

      return { biz, config: cfg.data, cfgWide: cfg.wide, prizes: prizes ?? [] };
    },
    ["public-game", slug],
    { tags: [`biz-${slug}`], revalidate: 60 }
  )();
}

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
  // Service configuré ? (message amical plutôt qu'une erreur brute)
  try {
    getAdminClient();
  } catch {
    return (
      <Unavailable message="Le service n'est pas encore configuré (base de données manquante)." />
    );
  }

  const { biz, config, cfgWide, prizes } = await loadPublicData(params.slug);

  if (!biz) {
    return <Unavailable message="Cet établissement n'existe pas." />;
  }

  // Mode test : réservé au propriétaire connecté (ou à un admin)
  let preview = false;
  if (searchParams?.preview === "1") {
    const user = await getSessionUser();
    if (user && (user.id === biz.owner_user_id || isAdminEmail(user.email))) {
      preview = true;
    }
  }

  if (!preview && !hasAccess(biz)) {
    return (
      <Unavailable message="Ce jeu est momentanément indisponible. Revenez plus tard." />
    );
  }

  const bizForPlan = {
    plan: biz.plan ?? "roue",
    subscription_status: biz.subscription_status ?? "trial",
  };
  if (!preview && !hasModule(bizForPlan, "roue")) {
    redirect(`/${biz.slug}/fidelite`);
  }

  // Click & collect : issu de la lecture mise en cache ci-dessus.
  let orderEnabled = !!biz.click_collect;
  // Essai gratuit ou formule « Complet » (tout inclus) : la commande est
  // ouverte — mais le bouton public n'apparaît que si le commerçant a déjà
  // mis des produits au catalogue. (Lecture dynamique, hors cache.)
  if (
    !orderEnabled &&
    (biz.subscription_status === "trial" || biz.plan === "complet")
  ) {
    try {
      const { count } = await getAdminClient()
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("business_id", biz.id)
        .eq("active", true);
      orderEnabled = (count ?? 0) > 0;
    } catch {
      /* table produits absente : on n'affiche pas le bouton */
    }
  }

  // 30 j par défaut si la colonne (0025) manque ou s'il n'y a pas de config.
  const prizeValidity: number | null =
    !cfgWide || !config ? 30 : (config.prize_validity_days ?? null);
  const decorEmojis: string = config?.decor_emojis ?? "";
  const drawPrize: string =
    cfgWide && config?.monthly_draw
      ? String(config.monthly_draw_prize || "").trim()
      : "";

  // Démo : tours illimités (personne n'est bloqué). On ne charge pas l'historique
  // (les boutons restent actifs) et on l'indique au composant de jeu. Uniquement
  // tant que c'est une démo : un établissement devenu PAYANT
  // (subscription_status = 'active') repasse en mode normal.
  const demo = !!biz.demo && biz.subscription_status !== "active";

  // Tours déjà joués par ce navigateur (verrou serveur) — personnalisé, hors cache.
  const played: Record<string, { label: string; code: string }> = {};
  const playerId = readPlayerId();
  if (playerId && !preview && !demo) {
    const { data: rows } = await getAdminClient()
      .from("plays")
      .select("play_type, prize_label, prize_code")
      .eq("business_id", biz.id)
      .eq("player_id", playerId);
    for (const r of rows ?? []) {
      played[r.play_type] = { label: r.prize_label, code: r.prize_code };
    }
  }

  // « À la une » : résolu ici (hors cache) avec la date du jour → l'expiration
  // reste à jour même si les données de config sont mises en cache par slug.
  const today = new Date().toISOString().slice(0, 10);
  const highlight = visibleHighlight(config, today);

  return (
    <Game
      slug={biz.slug}
      name={biz.name}
      logoUrl={biz.logo_url}
      orderEnabled={orderEnabled}
      prizeValidityDays={prizeValidity}
      decorEmojis={decorEmojis}
      drawPrize={drawPrize}
      highlight={highlight}
      feedbackEnabled={!!(config as any)?.feedback_enabled}
      prizes={prizes ?? []}
      config={
        config ?? {
          primary_color: "#ffc24d",
          accent_color: "#ff5d73",
          bg_color: "#150c29",
          instagram_url: null,
          review_url: null,
          compliance_note: "Le cadeau n'est pas conditionné à la note laissée.",
          instagram_enabled: true,
          review_enabled: true,
          loyalty_enabled: false,
          game_type: "wheel",
          trigger_actions: ["instagram"],
        }
      }
      played={played}
      preview={preview}
      demo={demo}
    />
  );
}
