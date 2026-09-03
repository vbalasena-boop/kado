/**
 * Import rapide de comptes Instagram collés en vrac (un par ligne, séparés par
 * des virgules, ou des URLs entières). Logique PURE et testable.
 *
 * Accepte : "@nom", "nom", "instagram.com/nom", "https://instagram.com/nom/…".
 * Renvoie des handles nettoyés, dédupliqués, valides (plafonnés).
 */
import { isJunkHandle } from "@/lib/prospection/enrich";

/** Nombre max de comptes importés en un seul passage (garde-fou). */
export const MAX_INSTA_IMPORT = 100;

/** Extrait un handle propre d'un jeton (gère @, URL, ponctuation). */
export function cleanHandle(token: string): string | null {
  let h = (token || "").trim();
  if (!h) return null;
  // URL Instagram → on garde le 1er segment de chemin.
  const m = /instagram\.com\/([^/?#\s]+)/i.exec(h);
  if (m) h = m[1];
  h = h.replace(/^@+/, "").replace(/[/?#].*$/, "").trim();
  // Ne garde que les caractères autorisés d'un handle Instagram.
  h = h.replace(/[^A-Za-z0-9._]/g, "");
  h = h.replace(/^[._]+|[._]+$/g, ""); // pas de point/underscore en bord
  const low = h.toLowerCase();
  if (!low || low.length > 30) return null;
  if (isJunkHandle(low)) return null;
  return low;
}

/** Parse un collage libre en liste de handles uniques et valides. */
export function parseInstagramHandles(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of (raw || "").split(/[\s,;]+/)) {
    const h = cleanHandle(token);
    if (h && !seen.has(h)) {
      seen.add(h);
      out.push(h);
      if (out.length >= MAX_INSTA_IMPORT) break;
    }
  }
  return out;
}

/** Devine un nom lisible depuis un handle : "le.bouillon" → "Le Bouillon". */
export function handleToName(handle: string): string {
  const words = handle
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return words.join(" ") || handle;
}
