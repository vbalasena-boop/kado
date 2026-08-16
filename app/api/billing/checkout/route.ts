import { NextRequest } from "next/server";
import { getMyBusiness, getSessionUser } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRICE_MAP: Record<string, string | undefined> = {
  roue: process.env.STRIPE_PRICE_ROUE,
  fidelite: process.env.STRIPE_PRICE_FIDELITE,
  complet: process.env.STRIPE_PRICE_COMPLET,
};

function resolvePriceId(plan: string): string | null {
  return PRICE_MAP[plan] || process.env.STRIPE_PRICE_ID || null;
}

export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }
  const biz = business;

  let body: { plan?: string } = {};
  try {
    body = await req.json();
  } catch {
    // pas de corps = formule actuelle
  }

  const plan = ["roue", "fidelite", "complet"].includes(body.plan ?? "")
    ? body.plan!
    : biz.plan || "roue";

  const priceId = resolvePriceId(plan);
  if (!priceId) {
    return Response.json({ error: "no_price_configured" }, { status: 500 });
  }

  const user = await getSessionUser();
  const stripe = getStripe();
  const db = getAdminClient();
  const origin = new URL(req.url).origin;

  try {
    // Client Stripe : on réutilise l'existant seulement s'il est valide
    // dans le mode courant (sinon on le recrée — utile après un test→live).
    let customerId = (biz as any).stripe_customer_id as string | null;
    if (customerId) {
      try {
        const c = await stripe.customers.retrieve(customerId);
        if ((c as any).deleted) customerId = null;
      } catch {
        customerId = null; // n'existe pas dans ce mode
      }
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user?.email ?? undefined,
        name: biz.name,
        metadata: { business_id: biz.id },
      });
      customerId = customer.id;
      await db
        .from("businesses")
        .update({ stripe_customer_id: customerId })
        .eq("id", biz.id);
    }

    await db.from("businesses").update({ plan }).eq("id", biz.id);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard/billing?success=1`,
      cancel_url: `${origin}/dashboard/billing`,
      metadata: { business_id: biz.id, plan },
      subscription_data: { metadata: { business_id: biz.id, plan } },
      allow_promotion_codes: true,
    });

    return Response.json({ url: session.url });
  } catch (e: any) {
    return Response.json(
      { error: "stripe_error", detail: e?.message ?? "stripe" },
      { status: 500 }
    );
  }
}
