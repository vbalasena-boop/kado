/**
 * Ancienneté d'une commande au comptoir — logique PURE.
 *
 * Au comptoir en coup de feu, le commerçant a besoin de voir d'un coup d'œil
 * DEPUIS COMBIEN DE TEMPS chaque commande à préparer attend, pour qu'aucune ne
 * soit oubliée. On calcule l'attente en minutes, un libellé français lisible,
 * et un niveau d'urgence (fraîche → vieillit → en retard) qui pilote la couleur.
 *
 * Déterministe : l'instant de référence `now` (ms epoch) est injecté.
 */

export type OrderAgeLevel = "fresh" | "aging" | "late";

export interface OrderAge {
  minutes: number;
  label: string;
  level: OrderAgeLevel;
}

/** Au-delà, une commande « à préparer » commence à vieillir (ambre). */
export const AGING_MIN = 10;
/** Au-delà, elle est « en retard » (rouge) — à traiter en priorité. */
export const LATE_MIN = 20;

/** Minutes entières écoulées depuis `iso` (borné à 0). null si date invalide. */
export function minutesSince(iso: string, now: number = Date.now()): number | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now - t) / 60000));
}

/** Niveau d'urgence à partir des minutes d'attente. */
export function orderAgeLevel(minutes: number): OrderAgeLevel {
  if (minutes >= LATE_MIN) return "late";
  if (minutes >= AGING_MIN) return "aging";
  return "fresh";
}

/** Libellé court : « à l'instant », « 1 min », « 12 min », « 1 h 05 ». */
export function orderAgeLabel(minutes: number): string {
  if (minutes <= 0) return "à l'instant";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/**
 * Ancienneté complète d'une commande. null si la date est invalide (le badge
 * est alors simplement masqué, jamais d'affichage cassé).
 */
export function orderAge(iso: string, now: number = Date.now()): OrderAge | null {
  const minutes = minutesSince(iso, now);
  if (minutes == null) return null;
  return { minutes, label: orderAgeLabel(minutes), level: orderAgeLevel(minutes) };
}

/**
 * Une commande « prête » l'est-elle depuis trop longtemps (≥ LATE_MIN) sans
 * avoir été récupérée ? Sert l'alerte sonore/notification au comptoir. Vrai
 * uniquement pour un statut « ready » horodaté `notified_ready_at`.
 */
export function isReadyUncollectedLate(
  status: string,
  notifiedReadyAt: string | null | undefined,
  now: number = Date.now()
): boolean {
  if (status !== "ready" || !notifiedReadyAt) return false;
  const mins = minutesSince(notifiedReadyAt, now);
  return mins != null && mins >= LATE_MIN;
}
