import { NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Active / désactive l'option « Campagnes » (+15 €/mois) :
 * un article récurrent ajouté (ou retiré) sur l'abonnement Stripe existant,
 * avec prorata. Pendant l'essai gratuit, l'option est incluse d'office.
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

  const priceId = process.env.STRIPE_PRICE_CAMPAIGNS;
  if (!priceId) {
    return Response.json({ error: "addon_not_configured" }, { status: 500 });
  }
  if (!business.stripe_subscription_id) {
    return Response.json({ error: "subscribe_first" }, { status: 400 });
  }

  const stripe = getStripe();
  const db = getAdminClient();

  try {
    const sub = await stripe.subscriptions.retrieve(
      business.stripe_subscription_id
    );
    const existing = sub.items.data.find(
      (it) => (typeof it.price === "string" ? it.price : it.price?.id) === priceId
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

    await db
      .from("businesses")
      .update({ campaigns_addon: enable })
      .eq("id", business.id);

    return Response.json({ ok: true, enabled: enable });
  } catch (e: any) {
    return Response.json(
      { error: "stripe_error", detail: e?.message ?? "stripe" },
      { status: 500 }
    );
  }
}
