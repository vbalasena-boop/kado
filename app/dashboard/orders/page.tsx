import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { selectTolerant } from "@/lib/db-errors";
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
  let tracking = false;
  let payConnected = false;
  let payReady = false;
  let onlinePayment = false;
  let smsOnReady = false;
  let orderHours: Record<string, [string, string] | null> | null = null;
  try {
    const { data } = await db
      .from("businesses")
      .select(
        "click_collect, order_hours, order_tracking, stripe_account_id, stripe_account_ready, online_payment"
      )
      .eq("id", business.id)
      .maybeSingle();
    enabled = !!(data as any)?.click_collect;
    tracking = !!(data as any)?.order_tracking;
    payConnected = !!(data as any)?.stripe_account_id;
    payReady = !!(data as any)?.stripe_account_ready;
    onlinePayment = !!(data as any)?.online_payment;
    orderHours = (data as any)?.order_hours ?? null;
  } catch {
    // Colonnes paiement (0040) absentes : retente sans elles.
    try {
      const { data } = await db
        .from("businesses")
        .select("click_collect, order_hours, order_tracking")
        .eq("id", business.id)
        .maybeSingle();
      enabled = !!(data as any)?.click_collect;
      tracking = !!(data as any)?.order_tracking;
      orderHours = (data as any)?.order_hours ?? null;
    } catch {
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
  }
  // SMS « c'est prêt » (0077) : lecture séparée et tolérante (colonne récente).
  try {
    const { data } = await db
      .from("businesses")
      .select("sms_on_ready")
      .eq("id", business.id)
      .maybeSingle();
    smsOnReady = !!(data as any)?.sms_on_ready;
  } catch {
    smsOnReady = false; // colonne absente : option non disponible
  }

  // Essai gratuit : toutes les options sont ouvertes, commande incluse.
  if (business.subscription_status === "trial") enabled = true;
  // Plans « Comptoir » et « Complet » : commandes + suivi au comptoir inclus.
  if (
    (business as any).plan === "comptoir" ||
    (business as any).plan === "complet"
  ) {
    enabled = true;
    tracking = true;
  }
  if (business.subscription_status === "trial") tracking = true;

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

  const startDay = new Date();
  startDay.setHours(0, 0, 0, 0);
  const startMonth = new Date();
  startMonth.setDate(1);
  startMonth.setHours(0, 0, 0, 0);
  const retentionStart = new Date();
  retentionStart.setMonth(retentionStart.getMonth() - 13);

  let products: Product[] = [];
  let orders: Order[] = [];
  let allForStats: {
    items: { name: string; qty: number; price_cents: number }[];
    total_cents: number;
    status: string;
    created_at: string;
    service_mode?: string | null;
    notified_ready_at?: string | null;
  }[] = [];
  try {
    // Lecture tolérante : `sold_out` (0081) peut ne pas exister encore.
    const { data: p } = await selectTolerant<Product>(
      (cols) =>
        db
          .from("products")
          .select(cols)
          .eq("business_id", business.id)
          .order("created_at", { ascending: true }),
      [
        "id, name, price_cents, active, image_url, description, sold_out",
        "id, name, price_cents, active, image_url, description",
      ],
    );
    products = p ?? [];
    // Lecture tolérante : service_mode / table_label peuvent ne pas exister
    // encore (migration 0037 non appliquée).
    const baseCols =
      "id, code, customer_name, customer_phone, pickup_at, note, items, total_cents, status, created_at";
    // `arrived_at` (0080) est la colonne la plus récente : tolérance à 3 niveaux
    // pour ne pas perdre service_mode/buzzer si seule 0080 manque.
    const wideCols = `${baseCols}, service_mode, table_label, buzzer_no, order_no, paid, refunded`;
    const { data: o } = await selectTolerant<Order>(
      (cols) =>
        db
          .from("orders")
          .select(cols)
          .eq("business_id", business.id)
          .gte("created_at", retentionStart.toISOString())
          .order("created_at", { ascending: false })
          .limit(150),
      [
        `${wideCols}, arrived_at, notified_ready_at`,
        `${wideCols}, arrived_at`,
        wideCols,
        baseCols,
      ],
    );
    orders = o ?? [];

    // Toutes les commandes servies, pour les statistiques (2000 max).
    // Lecture tolérante : service_mode / notified_ready_at peuvent manquer.
    // NB : on exclut aussi `awaiting_payment` (paiement en ligne jamais abouti)
    // pour ne pas gonfler le CA avec de l'argent jamais encaissé.
    let { data: s, error: sErr } = (await db
      .from("orders")
      .select("items, total_cents, status, created_at, service_mode, notified_ready_at")
      .eq("business_id", business.id)
      .gte("created_at", retentionStart.toISOString())
      .neq("status", "cancelled")
      .neq("status", "awaiting_payment")
      .order("created_at", { ascending: false })
      .limit(2000)) as { data: any[] | null; error: any };
    if (sErr) {
      ({ data: s } = (await db
        .from("orders")
        .select("items, total_cents, status, created_at")
        .eq("business_id", business.id)
        .gte("created_at", retentionStart.toISOString())
        .neq("status", "cancelled")
        .neq("status", "awaiting_payment")
        .order("created_at", { ascending: false })
        .limit(2000)) as { data: any[] | null; error: any });
    }
    allForStats = (s as typeof allForStats) ?? [];
  } catch {
    /* tables absentes : listes vides */
  }

  // ---- Statistiques ----
  const dayOrders = allForStats.filter(
    (o) => new Date(o.created_at) >= startDay
  );
  const monthOrders = allForStats.filter(
    (o) => new Date(o.created_at) >= startMonth
  );
  const sum = (list: typeof allForStats) =>
    list.reduce((a, o) => a + (o.total_cents ?? 0), 0);

  let historicalTotals: {
    totalOrders: number;
    totalCents: number;
    todayOrders: number;
    todayCents: number;
    monthOrders: number;
    monthCents: number;
  } | null = null;
  try {
    const { data, error } = await db.rpc("get_order_dashboard_totals", {
      p_business_id: business.id,
      p_today_start: startDay.toISOString(),
      p_month_start: startMonth.toISOString(),
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      historicalTotals = {
        totalOrders: Number(row.total_orders) || 0,
        totalCents: Number(row.total_cents) || 0,
        todayOrders: Number(row.today_orders) || 0,
        todayCents: Number(row.today_cents) || 0,
        monthOrders: Number(row.month_orders) || 0,
        monthCents: Number(row.month_cents) || 0,
      };
    }
  } catch {
    /* migration absente : replis sur les commandes chargées */
  }

  // Repli local tant que la migration d'agrégation n'est pas disponible.
  const byProduct = new Map<string, { qty: number; cents: number }>();
  for (const o of allForStats) {
    for (const it of o.items ?? []) {
      const cur = byProduct.get(it.name) ?? { qty: 0, cents: 0 };
      cur.qty += it.qty ?? 0;
      cur.cents += (it.price_cents ?? 0) * (it.qty ?? 0);
      byProduct.set(it.name, cur);
    }
  }
  let top = [...byProduct.entries()]
    .map(([name, v]) => ({ name, qty: v.qty, cents: v.cents }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);
  try {
    const { data, error } = await db.rpc("get_order_top_products", {
      p_business_id: business.id,
      p_since: retentionStart.toISOString(),
      p_limit: 5,
    });
    if (error) throw error;
    top = (data ?? []).map((row: any) => ({
      name: String(row.name),
      qty: Number(row.qty) || 0,
      cents: Number(row.cents) || 0,
    }));
  } catch {
    /* migration absente : les 2 000 dernières commandes servent de repli */
  }

  // Temps moyen de préparation (création → « prête »), sur les commandes servies.
  let prepSum = 0;
  let prepCount = 0;
  for (const o of allForStats) {
    if (!o.notified_ready_at) continue;
    const ms = new Date(o.notified_ready_at).getTime() - new Date(o.created_at).getTime();
    if (ms > 0 && ms < 6 * 3600 * 1000) {
      prepSum += ms;
      prepCount++;
    }
  }
  const avgPrepMin =
    prepCount > 0 ? Math.round(prepSum / prepCount / 60000) : null;

  // Répartition par mode de service.
  const modes = { surPlace: 0, emporter: 0, buzzer: 0 };
  for (const o of allForStats) {
    if (o.service_mode === "sur_place") modes.surPlace++;
    else if (o.service_mode === "buzzer") modes.buzzer++;
    else modes.emporter++;
  }

  const stats: OrderStats = {
    today: historicalTotals?.todayOrders ?? dayOrders.length,
    todayCents: historicalTotals?.todayCents ?? sum(dayOrders),
    month: historicalTotals?.monthOrders ?? monthOrders.length,
    monthCents: historicalTotals?.monthCents ?? sum(monthOrders),
    total: historicalTotals?.totalOrders ?? allForStats.length,
    totalCents: historicalTotals?.totalCents ?? sum(allForStats),
    avgCents: (historicalTotals?.totalOrders ?? allForStats.length) > 0
      ? Math.round(
          (historicalTotals?.totalCents ?? sum(allForStats)) /
            (historicalTotals?.totalOrders ?? allForStats.length),
        )
      : 0,
    top,
    avgPrepMin,
    modes,
  };

  // Site + domaine de commande (migration 0083, lecture tolérante).
  let siteUrl: string | null = null;
  let orderDomain: string | null = null;
  try {
    const { data } = await db
      .from("businesses")
      .select("website_url, order_domain")
      .eq("id", business.id)
      .maybeSingle();
    siteUrl = ((data as any)?.website_url as string | null) || null;
    orderDomain = ((data as any)?.order_domain as string | null) || null;
  } catch {
    siteUrl = null;
    orderDomain = null;
  }

  return (
    <OrdersClient
      slug={business.slug}
      shopName={business.name}
      products={products}
      orders={orders}
      stats={stats}
      hours={orderHours}
      tracking={tracking}
      payConnected={payConnected}
      payReady={payReady}
      onlinePayment={onlinePayment}
      smsOnReady={smsOnReady}
      siteUrl={siteUrl}
      orderDomain={orderDomain}
    />
  );
}
