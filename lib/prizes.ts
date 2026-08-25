import type { SupabaseClient } from "@supabase/supabase-js";
import { labelIsLosing } from "@/lib/draw";

/** Ligne de lot à insérer (au minimum un libellé). */
type PrizeRow = Record<string, unknown> & { label?: string | null };

/**
 * Insère des lots en renseignant `is_losing` (dérivé du libellé au moment de la
 * création, avant tout renommage ultérieur du lot).
 */
export async function insertPrizes(db: SupabaseClient, rows: PrizeRow[]) {
  const enriched = rows.map((r) => ({ ...r, is_losing: labelIsLosing(r.label) }));
  return db.from("prizes").insert(enriched);
}
