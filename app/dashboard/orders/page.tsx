import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import OrdersClient, {
  type Product,
  type Order,
  type OrderStats,
} from "./OrdersClient";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { business } = await getMyBusiness();
  if (!business) return null;

  const db = getAdminClient();

  // Module activé ? (lecture tolérante si la migration n'est pas passée)
  let enabled = false;
  let orderHours: Record<string, [string, string] | null> | null = null;
  try {
    const { data } = await db
      .from("businesses")
      .select("click_collect, order_hours")
      .eq("id", business.id)
      .maybeSingle();
    enabled = !!(data as any)?.click_collect;
    orderHours = (data as any)?.order_hours ?? null;
  } catch {
    // colonne order_hours absente : retente sans elle
    try {
      const { data } = await db
        .from("businesses")
        .select("click_collect")
        .eq("id", business.id)
        .maybeSingle();
      enabled = !!(data as any)?.click_collect;
    } catch {
      enabled = false;
    }
  }
  // Essai gratuit : toutes les options sont ouvertes, commande incluse.
  if (business.subscription_status === "trial") enabled = true;

  if (!enabled) {
    return (
      <>
        <h1 className="dash-h1">Commandes</h1>
        <div className="dash-card camp-locked">
          <div className="camp-locked-emoji">🛒</div>
          <h2>Click &amp; collect — bientôt disponible</h2>
          <p className="muted">
            Vos clients commandent en ligne et paient sur place au retrait.
            Ce module est en cours de lancement : il est activé par l'équipe
            Kado. Intéressé&nbsp;? Répondez simplement à l'un de nos e-mails
            ou contactez votre conseiller.
          </p>
        </div>
      </>
    );
  }

  let products: Product[] = [];
  let orders: Order[] = [];
  let allForStats: {
    items: { name: string; qty: number; price_cents: number }[];
    total_cents: number;
    status: string;
    created_at: string;
  }[] = [];
  try {
    const { data: p } = await db
      .from("products")
      .select("id, name, price_cents, active, image_url, description")
      .eq("business_id", business.id)
      .order("created_at", { ascending: true });
    products = (p as Product[]) ?? [];
    // Lecture tolérante : service_mode / table_label peuvent ne pas exister
    // encore (migration 0037 non appliquée).
    const baseCols =
      "id, code, customer_name, customer_phone, pickup_at, note, items, total_cents, status, created_at";
    let { data: o, error: oErr } = (await db
      .from("orders")
      .select(`${baseCols}, service_mode, table_label`)
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(150)) as { data: any[] | null; error: any };
    if (oErr) {
      ({ data: o } = (await db
        .from("orders")
        .select(baseCols)
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .limit(150)) as { data: any[] | null; error: any });
    }
    orders = (o as Order[]) ?? [];

    // Toutes les commandes servies, pour les statistiques (2000 max)
    const { data: s } = await db
      .from("orders")
      .select("items, total_cents, status, created_at")
      .eq("business_id", business.id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(2000);
    allForStats = (s as typeof allForStats) ?? [];
  } catch {
    /* tables absentes : listes vides */
  }

  // ---- Statistiques ----
  const startDay = new Date();
  startDay.setHours(0, 0, 0, 0);
  const startMonth = new Date();
  startMonth.setDate(1);
  startMonth.setHours(0, 0, 0, 0);

  const dayOrders = allForStats.filter(
    (o) => new Date(o.created_at) >= startDay
  );
  const monthOrders = allForStats.filter(
    (o) => new Date(o.created_at) >= startMonth
  );
  const sum = (list: typeof allForStats) =>
    list.reduce((a, o) => a + (o.total_cents ?? 0), 0);

  // Meilleures ventes (toutes commandes non annulées)
  const byProduct = new Map<string, { qty: number; cents: number }>();
  for (const o of allForStats) {
    for (const it of o.items ?? []) {
      const cur = byProduct.get(it.name) ?? { qty: 0, cents: 0 };
      cur.qty += it.qty ?? 0;
      cur.cents += (it.price_cents ?? 0) * (it.qty ?? 0);
      byProduct.set(it.name, cur);
    }
  }
  const top = [...byProduct.entries()]
    .map(([name, v]) => ({ name, qty: v.qty, cents: v.cents }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const stats: OrderStats = {
    today: dayOrders.length,
    todayCents: sum(dayOrders),
    month: monthOrders.length,
    monthCents: sum(monthOrders),
    total: allForStats.length,
    totalCents: sum(allForStats),
    avgCents:
      allForStats.length > 0
        ? Math.round(sum(allForStats) / allForStats.length)
        : 0,
    top,
  };

  return (
    <OrdersClient
      slug={business.slug}
      products={products}
      orders={orders}
      stats={stats}
      hours={orderHours}
    />
  );
}
