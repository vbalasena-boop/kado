/**
 * Prospection Kado — étage d'enrichissement PAYANT optionnel (Serper.dev).
 *
 * Serper est une API de recherche Google bon marché. Cet étage ne s'active QUE
 * si `SERPER_API_KEY` est défini. Il sert à trouver les signaux que le site seul
 * ne donne pas :
 *   - le compte Instagram (recherche « <nom> <ville> instagram ») ;
 *   - le site officiel (quand Google Places n'en donne pas), qu'on parse ensuite
 *     pour l'email — donc toujours **zéro devinette** sur les emails.
 *
 * Les fonctions de parsing sont pures et testables ; le réseau est isolé.
 */
import { reportError } from "@/lib/report";
import { isJunkHandle, isPlatformDomain } from "@/lib/prospection/enrich";

export interface SearchResult {
  link?: string;
}

const INSTA_LINK_RE =
  /instagram\.com\/((?!p\/|reel\/|reels\/|explore\/|stories\/|accounts\/|share)[A-Za-z0-9._]{1,30})/i;

/** L'étage payant est-il activé ? (clé API présente) */
export function serperConfigured(): boolean {
  return Boolean(process.env.SERPER_API_KEY);
}

/** Extrait le premier handle Instagram valide d'une liste de résultats. */
export function instagramHandleFromResults(results: SearchResult[]): string | null {
  for (const r of results) {
    const m = INSTA_LINK_RE.exec(r.link ?? "");
    if (m && !isJunkHandle(m[1])) return m[1].replace(/[._]+$/, "");
  }
  return null;
}

/** Extrait le 1ᵉ site « officiel » (ni réseau social ni plateforme) des résultats. */
export function officialWebsiteFromResults(results: SearchResult[]): string | null {
  for (const r of results) {
    try {
      const host = new URL(r.link ?? "").hostname.replace(/^www\./, "");
      if (!isPlatformDomain(host)) return `https://${host}`;
    } catch {
      /* lien invalide ignoré */
    }
  }
  return null;
}

/** Appel réseau Serper (renvoie [] si non configuré ou en cas d'échec). */
async function serperSearch(q: string): Promise<SearchResult[]> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q, gl: "fr", hl: "fr", num: 10 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      organic?: SearchResult[];
      knowledgeGraph?: { website?: string };
    };
    const out: SearchResult[] = [...(data.organic ?? [])];
    if (data.knowledgeGraph?.website) out.unshift({ link: data.knowledgeGraph.website });
    return out;
  } catch (err) {
    reportError(err, { where: "prospection.serperSearch", q });
    return [];
  }
}

/** Cherche le compte Instagram d'un commerce via recherche Google (Serper). */
export async function findInstagramViaSearch(
  name: string,
  city: string | null
): Promise<string | null> {
  const results = await serperSearch(`${name} ${city ?? ""} instagram`.trim());
  return instagramHandleFromResults(results);
}

/** Cherche le site officiel d'un commerce via recherche Google (Serper). */
export async function findWebsiteViaSearch(
  name: string,
  city: string | null
): Promise<string | null> {
  const results = await serperSearch(`${name} ${city ?? ""} site officiel`.trim());
  return officialWebsiteFromResults(results);
}
