import { createHmac } from "crypto";

function secret() {
  const s =
    process.env.PLAYER_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (s) return s;
  // Pas de repli codé en dur en production : un secret connu rendrait les
  // jetons de désinscription forgeables. On ne tolère un repli qu'en dev/local.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PLAYER_COOKIE_SECRET manquant : les jetons de désinscription seraient forgeables."
    );
  }
  return "dev-secret-change-me";
}

/** Jeton signé pour les liens de désinscription (b + e → HMAC tronqué). */
export function unsubToken(businessId: string, email: string) {
  return createHmac("sha256", secret())
    .update(`${businessId}:${email}`)
    .digest("hex")
    .slice(0, 24);
}
