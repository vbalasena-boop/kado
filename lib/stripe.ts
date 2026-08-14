import Stripe from "stripe";

let cached: Stripe | null = null;

/** Client Stripe (serveur uniquement). */
export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe non configuré (STRIPE_SECRET_KEY manquant).");
  cached = new Stripe(key);
  return cached;
}
