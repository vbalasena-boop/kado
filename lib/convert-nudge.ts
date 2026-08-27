/**
 * Relance de conversion « a joué mais pas de carte » — logique PURE (testable).
 *
 * Cible : un lead (e-mail laissé à la roue) assez ancien pour ne pas avoir
 * ouvert de carte spontanément, mais pas trop vieux pour rester pertinent, non
 * désinscrit et jamais encore relancé. L'absence de carte de fidélité est
 * filtrée en amont (requête), pas ici.
 */

export type ConvertLead = {
  email?: string | null;
  unsubscribed_at?: string | null;
  convert_nudge_at?: string | null;
  created_at?: string | null;
};

/** Âges (jours) entre lesquels un lead est relançable. */
export const CONVERT_MIN_AGE_DAYS = 3;
export const CONVERT_MAX_AGE_DAYS = 45;

export function isConvertNudgeEligible(
  lead: ConvertLead,
  nowMs: number,
  minAgeDays = CONVERT_MIN_AGE_DAYS,
  maxAgeDays = CONVERT_MAX_AGE_DAYS
): boolean {
  if (!lead.email) return false;
  if (lead.unsubscribed_at) return false;
  if (lead.convert_nudge_at) return false; // déjà relancé une fois
  if (!lead.created_at) return false;
  const created = Date.parse(lead.created_at);
  if (Number.isNaN(created)) return false;
  const age = nowMs - created;
  return age >= minAgeDays * 864e5 && age <= maxAgeDays * 864e5;
}
