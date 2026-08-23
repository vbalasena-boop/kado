import { NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Récupère l'id du compte Stripe connecté du commerce (lecture tolérante). */
async function getAccountId(db: any, businessId: string): Promise<string | null> {
  try {
    const { data } = await db
      .from("businesses")
      .select("stripe_account_id")
      .eq("id", businessId)
      .maybeSingle();
    return (data as any)?.stripe_account_id ?? null;
  } catch {
    return null;
  }
}

/**
 * POST : démarre (ou reprend) la connexion Stripe du commerçant — compte
 * Express + lien d'onboarding. Renvoie { url } pour rediriger le commerçant.
 * L'argent des commandes ira DIRECTEMENT sur ce compte.
 */
export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }
  const origin = new URL(req.url).origin;
  const db = getAdminClient();
  const stripe = getStripe();

  try {
    let acct = await getAccountId(db, business.id);
    if (!acct) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "FR",
        email: undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: { business_id: business.id },
      });
      acct = account.id;
      const { error } = await db
        .from("businesses")
        .update({ stripe_account_id: acct })
        .eq("id", business.id);
      if (error) {
        return Response.json({ error: "not_ready" }, { status: 409 });
      }
    }

    const link = await stripe.accountLinks.create({
      account: acct,
      refresh_url: `${origin}/dashboard/orders?connect=refresh`,
      return_url: `${origin}/dashboard/orders?connect=done`,
      type: "account_onboarding",
    });
    return Response.json({ url: link.url });
  } catch (e: any) {
    return Response.json(
      { error: "stripe_error", detail: e?.message ?? "stripe" },
      { status: 500 }
    );
  }
}

/**
 * GET : vérifie l'état du compte connecté (paiements activés ?) et met à jour
 * businesses.stripe_account_ready. Appelé au retour de l'onboarding.
 */
export async function GET(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }
  const db = getAdminClient();
  const stripe = getStripe();
  try {
    const acct = await getAccountId(db, business.id);
    if (!acct) return Response.json({ connected: false, ready: false });
    const account = await stripe.accounts.retrieve(acct);
    const ready = !!account.charges_enabled;
    await db
      .from("businesses")
      .update({ stripe_account_ready: ready })
      .eq("id", business.id);
    return Response.json({ connected: true, ready });
  } catch (e: any) {
    return Response.json(
      { error: "stripe_error", detail: e?.message ?? "stripe" },
      { status: 500 }
    );
  }
}
