import { timingSafeEqual } from "node:crypto";
import { hashRateLimitKey } from "@/lib/rate-limit";

export function normalizePlayEmail(email: string): string {
  const [local, originalDomain] = email.trim().toLowerCase().split("@");
  const domain = originalDomain === "googlemail.com" ? "gmail.com" : originalDomain;
  let name = local.split("+")[0];
  if (domain === "gmail.com") name = name.replace(/\./g, "");
  return `${name}@${domain}`;
}
export function playEmailHash(email: string): string {
  return hashRateLimitKey(normalizePlayEmail(email));
}
export function playEmailCodeHash(id: string, code: string): string {
  return hashRateLimitKey(`play-email-code:${id}:${code}`);
}
export function signPlayEmailToken(businessId: string, emailHash: string): string {
  const payload = Buffer.from(JSON.stringify({ businessId, emailHash, exp: Date.now() + 10 * 60_000 })).toString("base64url");
  return `${payload}.${hashRateLimitKey(`play-email-token:${payload}`)}`;
}
export function readPlayEmailToken(token: string | undefined, businessId: string): string | null {
  if (!token || token.length > 2048) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = Buffer.from(hashRateLimitKey(`play-email-token:${payload}`));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString());
    return value.businessId === businessId && typeof value.exp === "number" && value.exp > Date.now()
      && typeof value.emailHash === "string" && value.emailHash.length > 0 ? value.emailHash : null;
  } catch { return null; }
}
