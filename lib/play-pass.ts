import { createHmac, randomBytes } from "crypto";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 10;

function secret(): string {
  const value = process.env.PLAYER_COOKIE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("PLAYER_COOKIE_SECRET is required for game passes.");
  }
  return "dev-play-pass-key";
}

/** Generate a cashier handout code with 10 random Crockford-like characters. */
export function generatePlayPassCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let token = "";
  for (const byte of bytes) token += ALPHABET[byte % ALPHABET.length];
  return `KDO-${token.slice(0, 5)}-${token.slice(5)}`;
}

export function normalizePlayPassCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase().replace(/\s+/g, "");
  return /^KDO-[23456789A-HJ-NP-Z]{5}-[23456789A-HJ-NP-Z]{5}$/.test(code)
    ? code
    : null;
}

/** Store only a keyed digest; a database read cannot reveal usable passes. */
export function hashPlayPassCode(code: string): string {
  return createHmac("sha256", secret()).update(code).digest("hex");
}
