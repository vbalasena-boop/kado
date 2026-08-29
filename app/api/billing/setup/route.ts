import { NextRequest } from "next/server";
import { getMyBusiness, getSessionUser } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SETUP_MAP: Record<string, string | undefined> = {
  remote: process.env.STRIPE_PRICE_SETUP_REMOTE,
  onsite: process.env.STRIPE_PRICE_SETUP_ONSITE,
};

/**
 * Achat de l'« Installation clé en main » APRÈS la souscription :
 * paiement unique (mode payment), enregistré ensuite par le webhook
 * (checkout.session.completed avec metadata.setup).
 */
export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: { setup?: string; phone?: string; address?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const setup =
    body.setup === "remote" || body.setup === "onsite" ? body.setup : null;
  const phone =
    (body.phone || "").replace(/[^\d+ .-]/g, "").trim().slice(0, 20) || null;
  const address = (body.address || "").trim().slice(0, 200) || null;
  if (!setup) {
    return Response.json({ error: "invalid_setup" }, { status: 400 });
  }
  const priceId = SETUP_MAP[setup];
  if (!priceId) {
    return Response.json({ error: "setup_not_configured" }, { status: 500 });
  }

  const user = await getSessionUser();
  const stripe = getStripe();
  const db = getAdminClient();
  const origin = new URL(req.url).origin;

  // Téléphone / adresse fournis à la réservation : enregistrés (tolérant)
  if (phone) {
    await db.from("businesses").update({ phone }).eq("id", business.id);
  }
  if (address) {
    await db.from("businesses").update({ address }).eq("id", business.id);
  }

  try {
    let customerId = (business as any).stripe_customer_id as string | null;
    if (customerId) {
      try {
        const c = await stripe.customers.retrieve(customerId);
        if ((c as any).deleted) customerId = null;
      } catch {
        customerId = null;
      }
    }
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

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard/billing?setup_ok=1`,
      cancel_url: `${origin}/dashboard/billing`,
      metadata: { business_id: business.id, setup },
      allow_promotion_codes: true,
      // Paiement unique : on génère une VRAIE facture (et non un simple reçu),
      // avec l'adresse de facturation + n° de TVA/SIRET éventuel, enregistrés
      // sur le client Stripe. La facture est téléchargeable dans le portail.
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      invoice_creation: { enabled: true },
    });

    return Response.json({ url: session.url });
  } catch (e: any) {
    return Response.json(
      { error: "stripe_error", detail: e?.message ?? "stripe" },
      { status: 500 }
    );
  }
}
