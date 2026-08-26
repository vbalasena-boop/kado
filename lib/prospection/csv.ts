/**
 * Parseur CSV minimal pour l'import de prospects (côté client & tests).
 *
 * - Détecte automatiquement le séparateur (`;`, `,` ou tabulation).
 * - Gère les champs entre guillemets (avec `""` échappé) et les retours à la
 *   ligne dans un champ quoté.
 * - Mappe des en-têtes FR/EN courants vers les champs d'un prospect.
 *
 * Ne devine jamais d'email : seules les valeurs présentes sont conservées.
 */

export type ImportRow = {
  name: string;
  city?: string;
  category?: string;
  email?: string;
  instagram_handle?: string;
  website?: string;
  google_rating?: number | null;
  google_reviews_count?: number | null;
};

/** Découpe un texte CSV en tableau de lignes (chaque ligne = tableau de champs). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, ""); // enlève le BOM éventuel
  const delimiter = detectDelimiter(src);
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      // Fin de ligne (gère \r\n en avalant le \n suivant).
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      // Ignore les lignes entièrement vides.
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  // Dernier champ / dernière ligne (pas de saut final).
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.trim() !== "")) rows.push(row);
  }
  return rows;
}

/** Devine le séparateur en comparant les fréquences sur la 1ʳᵉ ligne. */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts: Record<string, number> = {
    ";": (firstLine.match(/;/g) || []).length,
    ",": (firstLine.match(/,/g) || []).length,
    "\t": (firstLine.match(/\t/g) || []).length,
  };
  let best = ";";
  let bestN = -1;
  for (const [d, n] of Object.entries(counts)) {
    if (n > bestN) {
      best = d;
      bestN = n;
    }
  }
  return best;
}

// Synonymes d'en-têtes → champ interne.
const HEADER_MAP: { field: keyof ImportRow; aliases: string[] }[] = [
  { field: "name", aliases: ["name", "nom", "commerce", "etablissement", "établissement", "entreprise", "raison sociale"] },
  { field: "city", aliases: ["city", "ville", "commune", "localite", "localité"] },
  { field: "category", aliases: ["category", "categorie", "catégorie", "segment", "type"] },
  { field: "email", aliases: ["email", "e-mail", "mail", "courriel", "adresse email"] },
  { field: "instagram_handle", aliases: ["instagram", "insta", "instagram_handle", "compte instagram", "ig"] },
  { field: "website", aliases: ["website", "site", "site web", "url", "web", "site internet"] },
  { field: "google_rating", aliases: ["rating", "note", "note google", "google_rating"] },
  { field: "google_reviews_count", aliases: ["reviews", "avis", "nb avis", "nombre d'avis", "google_reviews_count", "avis google"] },
];

function normHeader(h: string): string {
  return h.trim().toLowerCase();
}

/** Associe chaque colonne d'en-tête à un champ interne (ou null si inconnue). */
function mapHeaders(headers: string[]): (keyof ImportRow | null)[] {
  return headers.map((h) => {
    const key = normHeader(h);
    for (const { field, aliases } of HEADER_MAP) {
      if (aliases.includes(key)) return field;
    }
    return null;
  });
}

function toNumber(v: string): number | null {
  const t = v.trim().replace(",", ".").replace(/[^0-9.]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Transforme un CSV en lignes d'import prêtes à envoyer à l'API.
 * La 1ʳᵉ ligne DOIT être un en-tête. Les lignes sans nom sont ignorées.
 * Renvoie aussi les colonnes non reconnues (pour information).
 */
export function mapCsv(text: string): { rows: ImportRow[]; unknownHeaders: string[] } {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], unknownHeaders: [] };

  const headers = table[0];
  const mapping = mapHeaders(headers);
  const unknownHeaders = headers.filter((h, i) => mapping[i] === null && h.trim() !== "");

  const rows: ImportRow[] = [];
  for (let r = 1; r < table.length; r++) {
    const cells = table[r];
    const row: ImportRow = { name: "" };
    for (let c = 0; c < mapping.length; c++) {
      const field = mapping[c];
      if (!field) continue;
      const raw = (cells[c] ?? "").trim();
      if (raw === "") continue;
      if (field === "google_rating" || field === "google_reviews_count") {
        row[field] = toNumber(raw);
      } else {
        (row[field] as string) = raw;
      }
    }
    if (row.name.trim() !== "") rows.push(row);
  }
  return { rows, unknownHeaders };
}
