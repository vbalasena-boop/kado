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
 * unsubAt + exp). `exp` étant DANS la signature, impossible de prolonger la
 * validité sans invalider le jeton.
 *
 * `unsubAt` = `loyalty_cards.unsubscribed_at` COURANT (chaîne, `""` si null).
 * Le lier à la signature rend le lien à USAGE UNIQUE : dès que l'état change
 * (ré-abonnement → null, ou nouvelle désinscription → autre timestamp), un
 * ancien jeton ne re-dérive plus la même signature.
 *
 * `unsubAt` est CANONISÉ en epoch-ms (`Date.parse`) avant d'entrer dans la
 * signature : deux représentations du même instant (ex. `...T00:00:00Z` vs
 * `...T00:00:00.000Z`) produisent la même chaîne signée. Cela élimine tout
 * risque de drift de sérialisation du `timestamptz` entre la lecture à la
 * demande et à la confirmation. `null`/`undefined`/parse invalide → `""`.
 */
export function signResubToken(
  businessId: string,
  email: string,
  exp: number,
  unsubAt: string | null | undefined
): string {
  let u = "";
  if (unsubAt) {
    const ms = Date.parse(String(unsubAt));
    u = Number.isNaN(ms) ? "" : String(ms);
  }
  return createHmac("sha256", secret())
    .update(`${PURPOSE}:${businessId}:${email.toLowerCase()}:${u}:${exp}`)
    .digest("hex");
}

/**
 * Vérifie un jeton de ré-abonnement : signature (comparaison à temps
 * constant) ET non-expiration (`exp > nowMs`). Ne lève jamais.
 *
 * `unsubAt` est re-dérivé côté serveur depuis l'état COURANT de la carte : un
 * jeton signé pour un ancien `unsubscribed_at` ne valide plus (usage unique).
 */
export function verifyResubToken(
  businessId: string,
  email: string,
  exp: number,
  unsubAt: string | null | undefined,
  token: string,
  nowMs: number = Date.now()
): boolean {
  if (!businessId || !email || !token || !Number.isFinite(exp)) return false;
  if (!(exp > nowMs)) return false;
  const expected = signResubToken(businessId, email, exp, unsubAt);
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
  unsubAt: string | null | undefined,
  ttlMs: number = RESUB_TTL_MS
): { exp: number; url: string } {
  const mail = email.toLowerCase();
  const exp = Date.now() + ttlMs;
  const t = signResubToken(businessId, mail, exp, unsubAt);
  const url =
    `${SITE}/api/loyalty/resubscribe/confirm` +
    `?b=${encodeURIComponent(businessId)}` +
    `&e=${encodeEmail(mail)}` +
    `&exp=${exp}` +
    `&t=${t}`;
  return { exp, url };
}
