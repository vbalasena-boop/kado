import { createHmac, timingSafeEqual } from "crypto";

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

/**
 * Vérifie un jeton de désinscription en temps CONSTANT (anti-timing).
 * Une comparaison `===` court-circuite au premier octet différent et fuit,
 * en théorie, de l'information sur le jeton attendu ; `timingSafeEqual`
 * l'évite. Renvoie `false` sur toute entrée vide ou de mauvaise longueur.
 */
export function verifyUnsubToken(
  businessId: string,
  email: string,
  token: string
): boolean {
  if (!businessId || !email || !token) return false;
  const expected = unsubToken(businessId, email);
  const a = Buffer.from(token, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
