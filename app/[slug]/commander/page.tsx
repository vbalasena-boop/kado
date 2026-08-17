import { getAdminClient } from "@/lib/supabase/admin";
import { hasAccess } from "@/lib/auth";
import { isOpenNow, nextOpeningLabel, type OrderHours } from "@/lib/hours";
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
  try {
    const { data } = await db
      .from("businesses")
      .select(
        "id, slug, name, logo_url, status, subscription_ends_at, click_collect"
      )
      .eq("slug", params.slug)
      .maybeSingle();
    biz = data;
  } catch {
    biz = null;
  }

  if (!biz || !biz.click_collect) {
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
  try {
    const { data } = await db
      .from("products")
      .select("id, name, price_cents, image_url, description")
      .eq("business_id", biz.id)
      .eq("active", true)
      .order("created_at", { ascending: true });
    products = data ?? [];
  } catch {
    // colonnes photo absentes (migration 0020 pas encore passée)
    try {
      const { data } = await db
        .from("products")
        .select("id, name, price_cents")
        .eq("business_id", biz.id)
        .eq("active", true)
        .order("created_at", { ascending: true });
      products = data ?? [];
    } catch {
      products = [];
    }
  }

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

  return (
    <OrderClient
      slug={biz.slug}
      name={biz.name}
      logoUrl={biz.logo_url}
      products={products}
      open={open}
      nextOpen={nextOpen}
    />
  );
}
