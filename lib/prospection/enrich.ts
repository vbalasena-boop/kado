/**
 * Prospection Kado — enrichissement contact (story A4).
 *
 * À partir du site web d'un commerce, tente de trouver un email de contact et
 * un compte Instagram. Inspiré d'une cascade d'enrichissement éprouvée
 * (déobfuscation, exclusions, classement par domaine) mais SANS aucun outil
 * payant : lecture directe du site (gratuite) uniquement.
 *
 * Règle d'or : **zéro devinette** — seuls les emails réellement présents sur la
 * page sont retenus. Un email du domaine du site (ou un freemail) est « sûr » ;
 * un email d'un autre domaine est ignoré (risque : prestataire, annuaire…).
 *
 * L'extraction est pure et testable ; la récupération réseau est isolée.
 */
import { reportError } from "@/lib/report";

export interface Contact {
  email: string | null;
  instagram: string | null;
}

const RE_EMAIL = /[a-z0-9][a-z0-9._%+-]*@[a-z0-9][a-z0-9.-]*\.[a-z]{2,}/gi;

// Extensions de fichiers (faux positifs type "logo@2x.png").
const RE_FICHIER = /\.(png|jpe?g|gif|webp|svg|css|js|pdf|ico)$/i;

// Préfixes techniques à exclure (jamais un contact commercial).
const RE_LOCAL_EXCLU =
  /^(noreply|no-?reply|donotreply|do-?not-?reply|postmaster|abuse|privacy|mailer-daemon|webmaster|dpo)/i;

// Préfixes de service client / SAV : files de tickets nationales, pas le
// contact d'un commerce local.
const SERVICE_CLIENT = ["serviceclient", "sav", "support", "reclamations", "contactformulaire"];

// Fournisseurs d'email grand public (un email freemail sur le site du commerce
// est très probablement le sien).
const FREEMAIL =
  /(gmail|googlemail|orange\.fr|wanadoo|yahoo|hotmail|outlook|live\.(fr|com)|laposte\.net|free\.fr|sfr\.fr|neuf\.fr|bbox\.fr|aol\.|icloud|gmx\.|protonmail|proton\.me)/i;

// Domaines à exclure (jamais le contact du commerce).
const DOMAIN_BLOCKLIST = ["example.com", "sentry.io", "wixpress.com", "domain.com", "email.com"];

// Préfixes "de contact" à privilégier quand plusieurs emails sont sûrs.
const PREFERRED_PREFIXES = ["contact", "bonjour", "hello", "info", "commercial", "reservation"];

const INSTA_RE =
  /instagram\.com\/((?!p\/|reel\/|reels\/|explore\/|stories\/|accounts\/|share)[A-Za-z0-9._]{1,30})/gi;

/** Déobfusque les emails écrits "nom [at] site [dot] fr". */
export function deobfuscate(text: string): string {
  return String(text)
    .replace(/\s*[[(]\s*(?:at|arobase)\s*[\])]\s*/gi, "@")
    .replace(/\s+arobase\s+/gi, "@")
    .replace(/\s*[[(]\s*(?:dot|point)\s*[\])]\s*/gi, ".");
}

function cleanEmail(e: string): string {
  return e.toLowerCase().replace(/^mailto:/, "").replace(/[.,;:]+$/, "");
}

function isAcceptable(email: string): boolean {
  const parts = email.split("@");
  if (parts.length !== 2 || !parts[1]) return false;
  if (RE_FICHIER.test(email)) return false;
  if (RE_LOCAL_EXCLU.test(parts[0])) return false;
  const localKey = parts[0].replace(/[^a-z]/g, "");
  if (SERVICE_CLIENT.includes(localKey)) return false;
  if (DOMAIN_BLOCKLIST.some((d) => email.includes(d))) return false;
  return true;
}

/** Liste dédupliquée des emails acceptables réellement présents dans un texte/HTML. */
export function extractEmails(html: string): string[] {
  const found = new Set<string>();
  for (const m of deobfuscate(html).matchAll(RE_EMAIL)) {
    const e = cleanEmail(m[0]);
    if (isAcceptable(e)) found.add(e);
  }
  return [...found];
}

/**
 * Choisit le meilleur email selon la règle "zéro devinette" :
 * 1) domaine du site, 2) freemail, 3) préfixe de contact ; sinon rien de "sûr".
 * `siteDomain` = domaine du site (ex. "restaurant.fr"), sans www.
 */
export function pickBestEmail(emails: string[], siteDomain: string | null): string | null {
  if (emails.length === 0) return null;

  const sameDomain = emails.filter((e) => {
    const dom = e.split("@")[1];
    return siteDomain && (dom === siteDomain || dom.endsWith(`.${siteDomain}`));
  });
  const pool = sameDomain.length > 0 ? sameDomain : emails.filter((e) => FREEMAIL.test(e.split("@")[1]));

  const candidates = pool.length > 0 ? pool : [];
  if (candidates.length === 0) return null; // autre domaine → ambigu, on ne devine pas

  const preferred = candidates.find((e) =>
    PREFERRED_PREFIXES.some((p) => e.startsWith(`${p}@`))
  );
  return preferred ?? candidates[0];
}

export function extractInstagram(html: string): string | null {
  for (const m of html.matchAll(INSTA_RE)) {
    const handle = m[1];
    if (handle) return handle;
  }
  return null;
}

/** Extrait un email (classé par domaine) + un handle Instagram d'un HTML. */
export function extractContact(html: string, siteDomain: string | null = null): Contact {
  return {
    email: pickBestEmail(extractEmails(html), siteDomain),
    instagram: extractInstagram(html),
  };
}

// Liens "contact / mentions légales / nous joindre" à suivre en priorité.
const RE_CONTACT_LINK =
  /(contact|mentions[-_]?legales|nous[-_]?joindre|a[-_]?propos|apropos|infos?[-_]?pratiques?)/i;

/** Trouve les URLs de pages de contact citées dans le HTML (même hôte). */
export function contactLinks(html: string, origin: string): string[] {
  const out = new Set<string>();
  const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
  for (const m of html.matchAll(hrefRe)) {
    const href = m[1];
    if (!RE_CONTACT_LINK.test(href)) continue;
    try {
      const abs = new URL(href, origin);
      if (abs.origin === origin) out.add(abs.href.split("#")[0]);
    } catch {
      /* lien invalide ignoré */
    }
  }
  return [...out].slice(0, 2);
}

/**
 * Récupère le site (accueil + pages contact trouvées) et en extrait le contact.
 * Best-effort : ne lève jamais, renvoie {null,null} en cas d'échec.
 */
export async function enrichWebsite(website: string | null): Promise<Contact> {
  if (!website) return { email: null, instagram: null };
  const origin = normalizeOrigin(website);
  if (!origin) return { email: null, instagram: null };
  const siteDomain = origin.replace(/^https?:\/\//, "").replace(/^www\./, "");

  const homeHtml = await fetchHtml(origin);
  const acc: Contact = { email: null, instagram: null };
  const allEmails = new Set<string>();

  if (homeHtml) {
    extractEmails(homeHtml).forEach((e) => allEmails.add(e));
    acc.instagram = extractInstagram(homeHtml);

    // Suit les pages de contact citées sur l'accueil (au lieu de deviner /contact).
    for (const link of contactLinks(homeHtml, origin)) {
      if (acc.instagram && allEmails.size > 0) break;
      const html = await fetchHtml(link);
      if (!html) continue;
      extractEmails(html).forEach((e) => allEmails.add(e));
      acc.instagram = acc.instagram ?? extractInstagram(html);
    }
  }

  acc.email = pickBestEmail([...allEmails], siteDomain);
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
    return (await res.text()).slice(0, 500_000);
  } catch (err) {
    reportError(err, { where: "prospection.enrichWebsite", url });
    return null;
  }
}

function normalizeOrigin(raw: string): string | null {
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProto).origin;
  } catch {
    return null;
  }
}
