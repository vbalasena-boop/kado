import Stripe from "stripe";

let cached: Stripe | null = null;

/** Client Stripe (serveur uniquement). */
export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe non configuré (STRIPE_SECRET_KEY manquant).");
  // Épingler la version d'API évite les ruptures silencieuses lors des montées
  // de version du SDK (ex. déplacement de `current_period_end`). Renseigne
  // STRIPE_API_VERSION avec la version affichée dans ton dashboard Stripe ;
  // sinon on garde la version par défaut du compte.
  const apiVersion = process.env.STRIPE_API_VERSION as
    | Stripe.LatestApiVersion
    | undefined;
  cached = apiVersion ? new Stripe(key, { apiVersion }) : new Stripe(key);
  return cached;
}
