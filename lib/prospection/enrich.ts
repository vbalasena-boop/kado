/**
 * Prospection Kado — enrichissement contact (story A4).
 *
 * À partir du site web d'un commerce, tente de deviner un email de contact et
 * un compte Instagram. L'extraction (parsing) est une fonction pure, testable
 * sur du HTML ; la récupération réseau est isolée dans `enrichWebsite`.
 */
import { reportError } from "@/lib/report";

export interface Contact {
  email: string | null;
  instagram: string | null;
}

// Domaines/fragments d'emails à ignorer (faux positifs fréquents).
const EMAIL_BLOCKLIST = [
  "example.com",
  "sentry.io",
  "wixpress.com",
  "domain.com",
  "email.com",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
];

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const INSTA_RE =
  /instagram\.com\/((?!p\/|reel\/|reels\/|explore\/|stories\/)[A-Za-z0-9._]{1,30})/gi;

// Préfixes d'email "de contact" à privilégier.
const PREFERRED_PREFIXES = ["contact", "bonjour", "hello", "info", "commercial"];

/** Extrait un email + un handle Instagram d'un HTML (fonction pure). */
export function extractContact(html: string): Contact {
  return { email: extractEmail(html), instagram: extractInstagram(html) };
}

function extractEmail(html: string): string | null {
  const found = new Set<string>();
  for (const m of html.matchAll(EMAIL_RE)) {
    const email = m[0].toLowerCase();
    if (EMAIL_BLOCKLIST.some((b) => email.includes(b))) continue;
    found.add(email);
  }
  if (found.size === 0) return null;
  const list = [...found];
  // Priorité aux adresses de contact génériques.
  const preferred = list.find((e) =>
    PREFERRED_PREFIXES.some((p) => e.startsWith(`${p}@`))
  );
  return preferred ?? list[0];
}

function extractInstagram(html: string): string | null {
  for (const m of html.matchAll(INSTA_RE)) {
    const handle = m[1];
    if (!handle) continue;
    const lower = handle.toLowerCase();
    // Ignore les liens vers Instagram lui-même (partage, embed…).
    if (["sharer", "share", "embed", "accounts"].includes(lower)) continue;
    return handle;
  }
  return null;
}

/**
 * Récupère le site (home + éventuellement /contact) et en extrait le contact.
 * Best-effort : ne lève jamais, renvoie {null,null} en cas d'échec.
 */
export async function enrichWebsite(website: string | null): Promise<Contact> {
  if (!website) return { email: null, instagram: null };
  const base = normalizeUrl(website);
  if (!base) return { email: null, instagram: null };

  const pages = [base, joinUrl(base, "contact")];
  const acc: Contact = { email: null, instagram: null };
  for (const url of pages) {
    if (acc.email && acc.instagram) break;
    const html = await fetchHtml(url);
    if (!html) continue;
    const c = extractContact(html);
    acc.email = acc.email ?? c.email;
    acc.instagram = acc.instagram ?? c.instagram;
  }
  return acc;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "KadoProspectionBot/1.0 (+https://kado-app.fr)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("text/html")) return null;
    const text = await res.text();
    return text.slice(0, 500_000); // borne la taille
  } catch (err) {
    reportError(err, { where: "prospection.enrichWebsite", url });
    return null;
  }
}

function normalizeUrl(raw: string): string | null {
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withProto);
    return u.origin;
  } catch {
    return null;
  }
}

function joinUrl(origin: string, path: string): string {
  return `${origin.replace(/\/$/, "")}/${path}`;
}
