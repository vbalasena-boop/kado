/**
 * Prospection Kado — extrait de texte lisible d'un site web, pour nourrir la
 * rédaction IA (messages plus personnalisés, ancrés sur ce que fait vraiment le
 * commerce). Best-effort : jamais bloquant, renvoie null en cas d'échec.
 */
import { reportError } from "@/lib/report";

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&eacute;": "é",
  "&egrave;": "è",
  "&agrave;": "à",
  "&ccedil;": "ç",
};

/** Convertit un HTML en texte lisible (titre + description + contenu). Pur. */
export function htmlToText(html: string): string {
  let s = html;
  // Récupère <title> et la meta description en priorité (souvent le plus parlant).
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(s)?.[1] ?? "";
  const desc =
    /<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i.exec(s)?.[1] ??
    /<meta[^>]+content=["']([^"']+)["'][^>]*name=["']description["']/i.exec(s)?.[1] ??
    "";
  // Retire les blocs non textuels.
  s = s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  // Enlève les balises, décode quelques entités, normalise les espaces.
  s = s.replace(/<[^>]+>/g, " ");
  const decode = (t: string) =>
    t.replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? " ");
  const bodyText = decode(s).replace(/\s+/g, " ").trim();
  const header = [decode(title).trim(), decode(desc).trim()].filter(Boolean).join(" — ");
  return [header, bodyText].filter(Boolean).join(". ").replace(/\s+/g, " ").trim();
}

/**
 * Récupère un extrait (~maxChars) du contenu textuel d'un site. Best-effort :
 * timeout court, renvoie null sur toute erreur (HTML absent, non-HTML, réseau).
 */
export async function fetchSiteExcerpt(
  url: string | null | undefined,
  maxChars = 600
): Promise<string | null> {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const res = await fetch(withProto, {
      redirect: "follow",
      headers: { "User-Agent": "KadoProspectionBot/1.0 (+https://kado-app.fr)" },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") ?? "").includes("text/html")) return null;
    const html = (await res.text()).slice(0, 300_000);
    const text = htmlToText(html);
    if (text.length < 40) return null; // trop pauvre pour aider
    return text.slice(0, maxChars);
  } catch (err) {
    reportError(err, { where: "prospection.fetchSiteExcerpt", url: withProto });
    return null;
  }
}
