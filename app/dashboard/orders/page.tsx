import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import OrdersClient, { type Product, type Order } from "./OrdersClient";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { business } = await getMyBusiness();
  if (!business) return null;

  const db = getAdminClient();

  // Module activé ? (lecture tolérante si la migration n'est pas passée)
  let enabled = false;
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
  try {
    const { data: p } = await db
      .from("products")
      .select("id, name, price_cents, active, image_url, description")
      .eq("business_id", business.id)
      .order("created_at", { ascending: true });
    products = (p as Product[]) ?? [];
    const { data: o } = await db
      .from("orders")
      .select(
        "id, code, customer_name, customer_phone, pickup_at, note, items, total_cents, status, created_at"
      )
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(150);
    orders = (o as Order[]) ?? [];
  } catch {
    /* tables absentes : listes vides */
  }

  return (
    <OrdersClient
      slug={business.slug}
      products={products}
      orders={orders}
    />
  );
}
