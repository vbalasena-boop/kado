/**
 * Prospection Kado — jetons de désinscription (RGPD).
 *
 * Chaque email de prospection contient un lien de désinscription signé. Le
 * jeton est un HMAC de l'adresse : impossible à falsifier, pas besoin de le
 * stocker. À la désinscription, l'adresse est ajoutée à `suppression_list`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  return process.env.PROSPECT_UNSUB_SECRET || process.env.CRON_SECRET || "kado-prospection-dev-secret";
}

/** Jeton de désinscription pour une adresse (hex court). */
export function unsubToken(email: string): string {
  return createHmac("sha256", secret())
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

/** Vérifie qu'un jeton correspond bien à l'adresse (comparaison constante). */
export function verifyUnsubToken(email: string, token: string): boolean {
  const expected = unsubToken(email);
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Construit l'URL de désinscription absolue. */
export function unsubUrl(email: string, siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, "");
  const q = new URLSearchParams({ e: email, t: unsubToken(email) });
  return `${base}/api/prospection/unsubscribe?${q.toString()}`;
}
