import { NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRICE_MAP: Record<string, string | undefined> = {
  roue: process.env.STRIPE_PRICE_ROUE,
  fidelite: process.env.STRIPE_PRICE_FIDELITE,
  complet: process.env.STRIPE_PRICE_COMPLET,
};

/**
 * Change la formule d'un établissement (admin).
 * Si un abonnement Stripe est actif, la facturation réelle est ajustée
 * (prorata) ; sinon seule la base est mise à jour (compte manuel).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });

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

  const db = getAdminClient();
  const { data: biz } = await db
    .from("businesses")
    .select("id, stripe_subscription_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!biz) return Response.json({ error: "not_found" }, { status: 404 });

  let stripeAdjusted = false;
  const newPriceId = PRICE_MAP[plan];
  if (biz.stripe_subscription_id && newPriceId) {
    try {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(
        biz.stripe_subscription_id
      );
      // l'article de la formule = celui qui correspond à un des 3 prix
      const planPrices = Object.values(PRICE_MAP).filter(Boolean);
      const item = sub.items.data.find((it) => {
        const pid = typeof it.price === "string" ? it.price : it.price?.id;
        return pid && planPrices.includes(pid);
      });
      if (item) {
        await stripe.subscriptions.update(biz.stripe_subscription_id, {
          items: [{ id: item.id, price: newPriceId }],
          metadata: { ...sub.metadata, plan },
          proration_behavior: "create_prorations",
        });
        stripeAdjusted = true;
      } else {
        // article de formule introuvable (anciens prix ?) : on synchronise au
        // moins les métadonnées pour que le webhook ne réécrive pas la base
        await stripe.subscriptions.update(biz.stripe_subscription_id, {
          metadata: { ...sub.metadata, plan },
        });
      }
    } catch (e: any) {
      return Response.json(
        { error: "stripe_error", detail: e?.message ?? "stripe" },
        { status: 500 }
      );
    }
  }

  const { error } = await db
    .from("businesses")
    .update({ plan })
    .eq("id", params.id);
  if (error) return Response.json({ error: "update_failed" }, { status: 500 });

  return Response.json({ ok: true, stripe: stripeAdjusted });
}
