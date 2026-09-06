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

/** Résultat d'un SELECT supabase-js (jamais un `throw` : l'erreur est dans `error`). */
type SelectResult = { data: unknown; error: unknown };

/**
 * Lecture SELECT tolérante à une migration en retard.
 *
 * Plusieurs blocs recopiaient à la main le même échafaudage : essayer un SELECT
 * avec les colonnes récentes, et si la colonne n'existe pas encore, retenter
 * avec un jeu de colonnes plus étroit. Recopié, ce motif a fini par diverger
 * (une copie oubliait une colonne). Ce helper le centralise.
 *
 * `build(cols)` construit la requête pour un jeu de colonnes donné ; on lui passe
 * les paliers du plus large au plus étroit. On ne rétrograde vers le palier
 * suivant QUE si l'erreur est « colonne/table absente » (via isMissingColumnError) :
 * toute autre erreur (RLS, contrainte, connectivité) est renvoyée telle quelle,
 * sans masquer la panne en retentant avec moins de colonnes.
 *
 * @returns `{ data, error: null }` au premier palier qui passe ; sinon
 *          `{ data: null, error }` avec la dernière erreur rencontrée.
 */
export async function selectTolerant<T = unknown>(
  build: (cols: string) => PromiseLike<SelectResult>,
  colsTiers: readonly string[]
): Promise<{ data: T[] | null; error: unknown }> {
  let result: SelectResult = { data: null, error: null };
  for (const cols of colsTiers) {
    result = await build(cols);
    if (!result.error) return { data: (result.data as T[] | null) ?? null, error: null };
    // Erreur non « colonne absente » → on s'arrête, inutile de tenter plus étroit.
    if (!isMissingColumnError(result.error)) break;
  }
  return { data: null, error: result.error };
}
