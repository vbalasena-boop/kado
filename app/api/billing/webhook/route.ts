import { NextRequest } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Applique l'état d'un abonnement Stripe à l'établissement correspondant. */
async function applySubscription(sub: Stripe.Subscription) {
  const db = getAdminClient();
  const businessId = sub.metadata?.business_id;
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const active = sub.status === "active" || sub.status === "trialing";
  const endsAt = (sub as any).current_period_end
    ? new Date((sub as any).current_period_end * 1000).toISOString()
    : null;

  const plan = sub.metadata?.plan;
  const patch: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    subscription_status: active ? "active" : "suspended",
    status: active ? "active" : "suspended",
    subscription_ends_at: endsAt,
  };
  if (plan && ["roue", "fidelite", "complet"].includes(plan)) {
    patch.plan = plan;
  }

  const query = db.from("businesses").update(patch);
  if (businessId) await query.eq("id", businessId);
  else await query.eq("stripe_customer_id", customerId);
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: "no_webhook_secret" }, { status: 500 });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) return Response.json({ error: "no_signature" }, { status: 400 });

  const stripe = getStripe();
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch {
    return Response.json({ error: "bad_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          if (session.metadata?.business_id && !sub.metadata?.business_id) {
            sub.metadata = { business_id: session.metadata.business_id };
          }
          await applySubscription(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await applySubscription(event.data.object as Stripe.Subscription);
        break;
      }
      default:
        break;
    }
  } catch {
    return Response.json({ error: "handler_error" }, { status: 500 });
  }

  return Response.json({ received: true });
}
