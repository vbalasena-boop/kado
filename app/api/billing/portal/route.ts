import { NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Ouvre le portail client Stripe (changer de carte, annuler, factures). */
export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }
  const customerId = (business as any).stripe_customer_id as string | null;
  if (!customerId) {
    return Response.json({ error: "no_customer" }, { status: 400 });
  }

  const stripe = getStripe();
  const origin = new URL(req.url).origin;
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/dashboard/billing`,
  });

  return Response.json({ url: session.url });
}
