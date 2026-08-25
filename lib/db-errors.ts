/**
 * Détection « colonne / table absente » sur une erreur Supabase/PostgREST.
 *
 * Le client supabase-js ne « throw » pas : il résout avec `{ error }`. Certains
 * blocs veulent SURVIVRE à une migration non appliquée (colonne récente absente)
 * en ignorant ce cas précis — mais SANS avaler une vraie panne (RLS, contrainte,
 * connectivité). Ce helper isole exactement le cas tolérable.
 *
 * On lit UNIQUEMENT `error.code` (stable), jamais le message (localisé/fragile) :
 *  - `42703` undefined_column (Postgres)
 *  - `42P01` undefined_table  (Postgres)
 *  - `PGRST204` colonne absente du cache de schéma PostgREST
 *
 * Défensif : toute entrée inconnue (null, undefined, sans `code`) → `false`.
 */
const MISSING_COLUMN_CODES = new Set(["42703", "42P01", "PGRST204"]);

export function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && MISSING_COLUMN_CODES.has(code);
}
