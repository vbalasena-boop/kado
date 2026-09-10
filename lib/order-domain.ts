/**
 * Commande en ligne sur le domaine du commerçant (ex. commander.qustos.fr).
 *
 * Le commerçant pointe un sous-domaine (CNAME) vers Kado ; le middleware
 * reconnaît l'hôte, retrouve le commerce et RÉÉCRIT l'URL vers ses pages
 * publiques sans que le client ne voie jamais « kado-app.fr » :
 *
 *   commander.qustos.fr/            → /qustos/commander
 *   commander.qustos.fr/suivi/ABCD  → /qustos/suivi/ABCD
 *
 * Ce module ne contient que de la logique pure (testable sans réseau) : la
 * résolution hôte → slug est injectée par le middleware.
 */

/** Hôtes qui appartiennent à Kado (jamais réécrits). */
const KADO_HOST_SUFFIXES = ["kado-app.fr", "vercel.app", "localhost"];

const DOMAIN_RE =
  /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

/**
 * Nettoie une saisie de domaine : minuscules, sans protocole, sans chemin,
 * sans port, sans point final. Renvoie `null` si ce n'est pas un nom de
 * domaine valide ou s'il appartient à Kado.
 */
export function normalizeOrderDomain(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z]+:\/\//, ""); // https://
  s = s.split(/[/?#]/)[0] ?? ""; // chemin
  s = s.replace(/:\d+$/, ""); // port
  s = s.replace(/\.$/, "");
  if (!DOMAIN_RE.test(s)) return null;
  if (isKadoHost(s)) return null;
  return s;
}

/** L'hôte fait-il partie de l'infrastructure Kado ? */
export function isKadoHost(host: string): boolean {
  const h = host.toLowerCase().replace(/:\d+$/, "");
  return KADO_HOST_SUFFIXES.some((s) => h === s || h.endsWith("." + s));
}

/** Extrait l'hôte « propre » d'une requête (minuscules, sans port). */
export function cleanHost(host: string | null | undefined): string {
  return (host ?? "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

/**
 * Chemin réécrit pour un hôte commerçant, ou `null` si l'URL doit passer
 * telle quelle (fichiers, API, chemin déjà préfixé par le slug).
 */
export function rewritePathForOrderHost(
  pathname: string,
  slug: string
): string | null {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p.startsWith("/api/") || p.startsWith("/_next/")) return null;
  if (/\.[a-z0-9]{1,5}$/i.test(p)) return null; // /sw.js, /icon-192.png…
  if (p === "/" || p === "/commander") return `/${slug}/commander`;
  if (p === "/suivi" || p.startsWith("/suivi/")) return `/${slug}${p}`;
  if (p === `/${slug}` || p.startsWith(`/${slug}/`)) return null; // déjà bon
  return `/${slug}/commander`; // tout le reste → la page de commande
}

/**
 * Nettoie l'URL du site du commerçant (lien « Retour au site »).
 * N'accepte que http(s) ; renvoie `null` si invalide.
 */
export function normalizeWebsiteUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".")) return null;
    if (s.length > 300) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Libellé court d'un lien de site (« qustos.fr »), pour l'affichage. */
export function websiteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
