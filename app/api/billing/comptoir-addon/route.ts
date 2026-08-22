import { NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Active / désactive l'option « Suivi au comptoir » (bipeur digital, +12 €/mois).
 * - Essai gratuit ou plan « Comptoir » : incluse, simple bascule du drapeau.
 * - Autres formules : article récurrent ajouté/retiré sur l'abonnement Stripe
 *   (avec prorata), et le drapeau order_tracking suit.
 * Le drapeau businesses.order_tracking sert d'entitlement partout.
 */
export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: { enable?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const enable = !!body.enable;
  const db = getAdminClient();

  async function setFlag(v: boolean) {
    const { error } = await db
      .from("businesses")
      .update({ order_tracking: v })
      .eq("id", business!.id);
    if (error) return false;
    return true;
  }

  // Inclus d'office : essai gratuit, plan « Comptoir » et plan « Complet ».
  const included =
    business.subscription_status === "trial" ||
    (business as any).plan === "comptoir" ||
    (business as any).plan === "complet";
  if (included) {
    const ok = await setFlag(enable);
    if (!ok) return Response.json({ error: "not_ready" }, { status: 409 });
    return Response.json({ ok: true, enabled: enable, billed: false });
  }

  // Sinon : article payant sur l'abonnement Stripe.
  const priceId = process.env.STRIPE_PRICE_COMPTOIR_ADDON;
  if (!priceId) {
    return Response.json({ error: "addon_not_configured" }, { status: 500 });
  }
  if (!business.stripe_subscription_id) {
    return Response.json({ error: "subscribe_first" }, { status: 400 });
  }

  const stripe = getStripe();
  try {
    const sub = await stripe.subscriptions.retrieve(
      business.stripe_subscription_id
    );
    const existing = sub.items.data.find(
      (it) =>
        (typeof it.price === "string" ? it.price : it.price?.id) === priceId
    );

    if (enable && !existing) {
      await stripe.subscriptionItems.create({
        subscription: sub.id,
        price: priceId,
        quantity: 1,
        proration_behavior: "create_prorations",
      });
    }
    if (!enable && existing) {
      await stripe.subscriptionItems.del(existing.id, {
        proration_behavior: "create_prorations",
      });
    }

    await setFlag(enable);
    return Response.json({ ok: true, enabled: enable, billed: true });
  } catch (e: any) {
    return Response.json(
      { error: "stripe_error", detail: e?.message ?? "stripe" },
      { status: 500 }
    );
  }
}
