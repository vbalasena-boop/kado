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
  return (
    PRICE_MAP[plan] ||
    process.env.STRIPE_PRICE_ID ||
    null
  );
}

export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: { plan?: string } = {};
  try {
    body = await req.json();
  } catch {
    // no body = use current plan
  }

  const plan = ["roue", "fidelite", "complet"].includes(body.plan ?? "")
    ? body.plan!
    : business.plan || "roue";

  const priceId = resolvePriceId(plan);
  if (!priceId) {
    return Response.json({ error: "no_price_configured" }, { status: 500 });
  }

  const user = await getSessionUser();
  const stripe = getStripe();
  const db = getAdminClient();
  const origin = new URL(req.url).origin;

  let customerId = (business as any).stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user?.email ?? undefined,
      name: business.name,
      metadata: { business_id: business.id },
    });
    customerId = customer.id;
    await db
      .from("businesses")
      .update({ stripe_customer_id: customerId })
      .eq("id", business.id);
  }

  await db.from("businesses").update({ plan }).eq("id", business.id);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/dashboard/billing?success=1`,
    cancel_url: `${origin}/dashboard/billing`,
    metadata: { business_id: business.id, plan },
    subscription_data: { metadata: { business_id: business.id, plan } },
    allow_promotion_codes: true,
  });

  return Response.json({ url: session.url });
}
