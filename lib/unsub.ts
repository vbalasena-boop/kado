import { createHmac } from "crypto";

function secret() {
  return (
    process.env.PLAYER_COOKIE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "kado"
  );
}

/** Jeton signé pour les liens de désinscription (b + e → HMAC tronqué). */
export function unsubToken(businessId: string, email: string) {
  return createHmac("sha256", secret())
    .update(`${businessId}:${email}`)
    .digest("hex")
    .slice(0, 24);
}
