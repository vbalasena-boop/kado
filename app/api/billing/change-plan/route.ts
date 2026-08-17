import { NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRICE_MAP: Record<string, string | undefined> = {
  roue: process.env.STRIPE_PRICE_ROUE,
  fidelite: process.env.STRIPE_PRICE_FIDELITE,
  complet: process.env.STRIPE_PRICE_COMPLET,
};

export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const plan = body.plan;
  if (!plan || !["roue", "fidelite", "complet"].includes(plan)) {
    return Response.json({ error: "invalid_plan" }, { status: 400 });
  }

  if (plan === business.plan) {
    return Response.json({ ok: true, unchanged: true });
  }

  const db = getAdminClient();

  if (!business.stripe_subscription_id) {
    await db.from("businesses").update({ plan }).eq("id", business.id);
    return Response.json({ ok: true });
  }

  const newPriceId = PRICE_MAP[plan];
  if (!newPriceId) {
    await db.from("businesses").update({ plan }).eq("id", business.id);
    return Response.json({ ok: true });
  }

  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(
    business.stripe_subscription_id
  );
  // L'article à remplacer est celui de la FORMULE (pas l'option Campagnes,
  // qui est un article séparé du même abonnement).
  const planPrices = Object.values(PRICE_MAP).filter(Boolean);
  const planItem = sub.items.data.find((it) => {
    const pid = typeof it.price === "string" ? it.price : it.price?.id;
    return pid && planPrices.includes(pid);
  });
  const itemId = planItem?.id ?? sub.items.data[0]?.id;
  if (!itemId) {
    return Response.json({ error: "no_sub_item" }, { status: 500 });
  }

  await stripe.subscriptions.update(business.stripe_subscription_id, {
    items: [{ id: itemId, price: newPriceId }],
    metadata: { ...sub.metadata, plan },
    proration_behavior: "create_prorations",
  });

  await db.from("businesses").update({ plan }).eq("id", business.id);

  return Response.json({ ok: true });
}
