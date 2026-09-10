import { getAdminClient } from "@/lib/supabase/admin";
import { selectTolerant } from "@/lib/db-errors";
import { hasAccess, hasClickCollect } from "@/lib/auth";
import { isOpenNow, nextOpeningLabel, type OrderHours } from "@/lib/hours";
import { buildTheme } from "@/lib/theme";
import OrderClient from "./OrderClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

function Unavailable({ message }: { message: string }) {
  return (
    <main className="landing">
      <div className="landing-card">
        <div className="landing-logo">🛒</div>
        <h1>Commande indisponible</h1>
        <p>{message}</p>
      </div>
    </main>
  );
}

export default async function CommanderPage({
  params,
}: {
  params: { slug: string };
}) {
  let db;
  try {
    db = getAdminClient();
  } catch {
    return <Unavailable message="Le service n'est pas configuré." />;
  }

  let biz: any = null;
  const bizCols =
    "id, slug, name, logo_url, status, subscription_status, subscription_ends_at, click_collect, plan";
  try {
    // Lecture tolérante : online_payment / stripe_account_ready peuvent manquer.
    let { data, error } = (await db
      .from("businesses")
      .select(`${bizCols}, online_payment, stripe_account_ready`)
      .eq("slug", params.slug)
      .maybeSingle()) as { data: any; error: any };
    if (error) {
      ({ data } = (await db
        .from("businesses")
        .select(bizCols)
        .eq("slug", params.slug)
        .maybeSingle()) as { data: any; error: any });
    }
    biz = data;
  } catch {
    biz = null;
  }
  const payOnline = !!biz?.online_payment && !!biz?.stripe_account_ready;

  // Règle UNIQUE (lib/auth) : essai, formules « Comptoir »/« Complet », ou
  // option `click_collect`. Ne pas dupliquer la condition ici — la formule
  // « Comptoir » est vendue avec « Commande en ligne incluse » et était
  // refusée par une copie incomplète de la règle.
  const orderOn = !!biz && hasClickCollect(biz);
  if (!biz || !orderOn) {
    return (
      <Unavailable message="Ce commerce ne propose pas la commande en ligne." />
    );
  }
  if (!hasAccess(biz)) {
    return (
      <Unavailable message="La commande en ligne est momentanément suspendue." />
    );
  }

  let products: {
    id: string;
    name: string;
    price_cents: number;
    image_url?: string | null;
    description?: string | null;
  }[] = [];
  // Lecture tolérante à 3 niveaux (Supabase ne « throw » pas : on inspecte
  // l'erreur). Avec `sold_out` (0081) → sans → socle sans photo (0020 absente).
  const { data: pr } = await selectTolerant(
    (cols) =>
      db
        .from("products")
        .select(cols)
        .eq("business_id", biz.id)
        .eq("active", true)
        .order("created_at", { ascending: true }),
    [
      "id, name, price_cents, image_url, description, sold_out",
      "id, name, price_cents, image_url, description",
      "id, name, price_cents",
    ]
  );
  products = (pr as typeof products) ?? [];

  if (products.length === 0) {
    return (
      <Unavailable message="Le catalogue n'est pas encore disponible. Repassez bientôt !" />
    );
  }

  // Horaires de commande (lecture tolérante)
  let open = true;
  let nextOpen: string | null = null;
  try {
    const { data: h } = await db
      .from("businesses")
      .select("order_hours")
      .eq("id", biz.id)
      .maybeSingle();
    const hours = (h as any)?.order_hours as OrderHours | null;
    open = isOpenNow(hours);
    nextOpen = open ? null : nextOpeningLabel(hours);
  } catch {
    open = true;
  }

  // Site du commerçant → lien « Retour au site » (lecture tolérante : la
  // colonne arrive avec la migration 0083).
  let siteUrl: string | null = null;
  try {
    const { data: w } = await db
      .from("businesses")
      .select("website_url")
      .eq("id", biz.id)
      .maybeSingle();
    siteUrl = ((w as any)?.website_url as string | null) || null;
  } catch {
    siteUrl = null;
  }

  // Thème du commerce → cohérence avec la page de jeu (lecture tolérante).
  let themeCss = "";
  try {
    const { data: c } = await db
      .from("wheel_configs")
      .select("primary_color, accent_color, bg_color, bg_image_url")
      .eq("business_id", biz.id)
      .maybeSingle();
    themeCss = buildTheme(
      (c as any)?.primary_color || "#ffc24d",
      (c as any)?.accent_color || "#ff5d73",
      (c as any)?.bg_color || "#150c29",
      (c as any)?.bg_image_url || null
    );
  } catch {
    themeCss = "";
  }

  return (
    <>
      {themeCss && <style dangerouslySetInnerHTML={{ __html: themeCss }} />}
      <OrderClient
        slug={biz.slug}
        name={biz.name}
        logoUrl={biz.logo_url}
        products={products}
        open={open}
        nextOpen={nextOpen}
        payOnline={payOnline}
        siteUrl={siteUrl}
      />
    </>
  );
}
