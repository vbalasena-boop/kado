import * as cheerio from 'cheerio';

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// On ne veut que des adresses PROFESSIONNELLES / génériques (RGPD B2B),
// pas des adresses personnelles ni des adresses techniques parasites.
const PREFERRED = ['contact', 'bonjour', 'hello', 'info', 'accueil', 'reservation', 'resa'];
const BLOCKLIST = [
  'noreply',
  'no-reply',
  'donotreply',
  'example',
  'sentry',
  'wixpress',
  'wordpress',
  'godaddy',
  'domain',
  'privacy',
  'abuse',
  'postmaster',
];
const BAD_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.css', '.js'];

function isPlausible(email: string): boolean {
  const e = email.toLowerCase();
  if (BAD_EXT.some((ext) => e.endsWith(ext))) return false;
  if (BLOCKLIST.some((b) => e.includes(b))) return false;
  return true;
}

/** Trie : les boîtes génériques préférées d'abord. */
function rank(email: string): number {
  const local = email.toLowerCase().split('@')[0];
  const idx = PREFERRED.findIndex((p) => local.includes(p));
  return idx === -1 ? PREFERRED.length : idx;
}

async function fetchText(url: string, timeoutMs = 8000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; KadoProspection/0.1; +https://kado.app)',
      },
    });
    if (!res.ok) return null;
    const ctype = res.headers.get('content-type') ?? '';
    if (!ctype.includes('text/html')) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractFromHtml(html: string): string[] {
  const found = new Set<string>();
  const $ = cheerio.load(html);

  // 1. Liens mailto: (les plus fiables)
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const addr = href.replace(/^mailto:/i, '').split('?')[0].trim();
    if (addr) found.add(addr);
  });

  // 2. Adresses présentes dans le texte brut
  const matches = $.root().text().match(EMAIL_RE) ?? [];
  for (const m of matches) found.add(m);

  return [...found].filter(isPlausible);
}

function contactUrls(base: string): string[] {
  try {
    const u = new URL(base);
    const root = `${u.protocol}//${u.host}`;
    return [
      base,
      `${root}/contact`,
      `${root}/contact-us`,
      `${root}/nous-contacter`,
      `${root}/mentions-legales`,
    ];
  } catch {
    return [base];
  }
}

/**
 * Tente de trouver l'e-mail de contact d'un commerce à partir de son site web.
 * Renvoie la meilleure adresse générique trouvée, ou null.
 */
export async function findEmail(website: string): Promise<string | null> {
  const urls = contactUrls(website);
  const all = new Set<string>();

  for (const url of urls) {
    const html = await fetchText(url);
    if (!html) continue;
    for (const e of extractFromHtml(html)) all.add(e);
    // Si on a déjà une boîte préférée, inutile de continuer.
    if ([...all].some((e) => rank(e) < PREFERRED.length)) break;
  }

  if (all.size === 0) return null;
  return [...all].sort((a, b) => rank(a) - rank(b))[0];
}
