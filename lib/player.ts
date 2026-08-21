import { cookies } from "next/headers";
import crypto from "crypto";

/**
 * Identifiant anonyme de joueur, stocké dans un cookie HttpOnly signé (HMAC).
 * La signature empêche un joueur de forger l'identifiant d'un autre.
 * Aucune donnée personnelle : juste un UUID aléatoire.
 */
const COOKIE = "sr_pid";

/**
 * Secret de signature du cookie joueur. En production, il DOIT être défini :
 * sans lui, les cookies deviennent forgeables et le verrou des 2 tours
 * s'effondre. On tolère un repli uniquement hors production (dev/local).
 */
function getSecret(): string {
  const s = process.env.PLAYER_COOKIE_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PLAYER_COOKIE_SECRET manquant : le verrou joueur serait forgeable."
    );
  }
  return "dev-secret-change-me";
}

function sign(value: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(value)
    .digest("base64url");
}

function pack(id: string): string {
  return `${id}.${sign(id)}`;
}

function unpack(raw: string | undefined): string | null {
  if (!raw) return null;
  const i = raw.lastIndexOf(".");
  if (i < 0) return null;
  const id = raw.slice(0, i);
  const sig = raw.slice(i + 1);
  return sign(id) === sig ? id : null;
}

/** Lecture seule (utilisable dans un Server Component). Renvoie null si absent. */
export function readPlayerId(): string | null {
  return unpack(cookies().get(COOKIE)?.value);
}

/**
 * Lit l'identifiant, ou en crée un et pose le cookie.
 * À utiliser uniquement dans un Route Handler / Server Action (cookie modifiable).
 */
export function getOrCreatePlayerId(): string {
  const jar = cookies();
  const existing = unpack(jar.get(COOKIE)?.value);
  if (existing) return existing;
  const id = crypto.randomUUID();
  jar.set(COOKIE, pack(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return id;
}
