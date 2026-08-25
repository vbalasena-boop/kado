import { createHmac, timingSafeEqual } from "crypto";
import { SITE } from "@/lib/campaigns";

/** Durée de validité par défaut d'un lien de ré-abonnement : 48 h (un
 *  consentement doit être confirmé rapidement ; réduit la fenêtre de rejeu). */
export const RESUB_TTL_MS = 48 * 60 * 60 * 1000;

/** Préfixe d'usage : isole ce jeton des autres HMAC (désinscription, etc.). */
const PURPOSE = "resub-v1";

function secret() {
  const s =
    process.env.PLAYER_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (s) return s;
  // Pas de repli codé en dur en production : un secret connu rendrait les
  // jetons de ré-abonnement forgeables. On ne tolère un repli qu'en dev/local.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PLAYER_COOKIE_SECRET manquant : les jetons de ré-abonnement seraient forgeables."
    );
  }
  return "dev-secret-change-me";
}

/** Encode un e-mail pour le transport en URL (base64url). */
export function encodeEmail(email: string): string {
  return Buffer.from(email, "utf8").toString("base64url");
}

/** Décode un e-mail transporté en base64url (minuscules, jamais lève). */
export function decodeEmail(e64: string): string {
  try {
    return Buffer.from(e64, "base64url").toString("utf8").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Jeton signé « re-consent » : HMAC-SHA256 sur (purpose + business + email +
 * exp). `exp` étant DANS la signature, impossible de prolonger la validité
 * sans invalider le jeton.
 */
export function signResubToken(
  businessId: string,
  email: string,
  exp: number
): string {
  return createHmac("sha256", secret())
    .update(`${PURPOSE}:${businessId}:${email.toLowerCase()}:${exp}`)
    .digest("hex");
}

/**
 * Vérifie un jeton de ré-abonnement : signature (comparaison à temps
 * constant) ET non-expiration (`exp > nowMs`). Ne lève jamais.
 */
export function verifyResubToken(
  businessId: string,
  email: string,
  exp: number,
  token: string,
  nowMs: number = Date.now()
): boolean {
  if (!businessId || !email || !token || !Number.isFinite(exp)) return false;
  if (!(exp > nowMs)) return false;
  const expected = signResubToken(businessId, email, exp);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(token, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Construit le lien absolu de confirmation de ré-abonnement.
 * Renvoie `{ exp, url }` — `exp` = instant d'expiration (ms epoch).
 */
export function buildResubConfirmUrl(
  businessId: string,
  email: string,
  ttlMs: number = RESUB_TTL_MS
): { exp: number; url: string } {
  const mail = email.toLowerCase();
  const exp = Date.now() + ttlMs;
  const t = signResubToken(businessId, mail, exp);
  const url =
    `${SITE}/api/loyalty/resubscribe/confirm` +
    `?b=${encodeURIComponent(businessId)}` +
    `&e=${encodeEmail(mail)}` +
    `&exp=${exp}` +
    `&t=${t}`;
  return { exp, url };
}
