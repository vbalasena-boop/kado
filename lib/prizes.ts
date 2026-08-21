import type { SupabaseClient } from "@supabase/supabase-js";
import { labelIsLosing } from "@/lib/draw";

/** Ligne de lot à insérer (au minimum un libellé). */
type PrizeRow = Record<string, unknown> & { label?: string | null };

/**
 * Insère des lots en renseignant `is_losing` (dérivé du libellé au moment de la
 * création, avant tout renommage ultérieur). Tolérant : si la colonne n'existe
 * pas encore (migration 0037 non appliquée), on retente sans elle — le
 * comportement reste alors celui, basé sur le libellé, d'avant la migration.
 */
export async function insertPrizes(db: SupabaseClient, rows: PrizeRow[]) {
  const enriched = rows.map((r) => ({ ...r, is_losing: labelIsLosing(r.label) }));
  const res = await db.from("prizes").insert(enriched);
  // 42703 = colonne inexistante (Postgres undefined_column)
  if (res.error && (res.error as { code?: string }).code === "42703") {
    return db.from("prizes").insert(rows);
  }
  return res;
}
