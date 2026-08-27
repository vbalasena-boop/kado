/**
 * Segmentation des clients fidélité — logique PURE (testable, sans base).
 *
 * Quatre segments MUTUELLEMENT EXCLUSIFS, par priorité d'action :
 *  1. dormant  « à réveiller »  — dernière activité plus ancienne que le seuil
 *  2. loyal    « fidèles »      — a déjà gagné au moins une récompense
 *  3. active   « en cours »     — a des tampons sur sa carte en cours
 *  4. new      « nouveaux »     — inscrit, pas encore de tampon
 *
 * Le « à réveiller » est prioritaire : un client fidèle qui ne revient plus est
 * d'abord quelqu'un à relancer.
 */

export type SegmentCard = {
  stamps?: number | null;
  rewards_earned?: number | null;
  last_stamp_at?: string | null;
};

export type Segment = "dormant" | "loyal" | "active" | "new";

export type SegmentSummary = {
  loyal: number;
  active: number;
  new: number;
  dormant: number;
  total: number;
};

/** Segment d'un client au regard du seuil d'inactivité (ms epoch). */
export function segmentOf(card: SegmentCard, cutoffMs: number): Segment {
  const last = card.last_stamp_at ? Date.parse(card.last_stamp_at) : NaN;
  // « À réveiller » : une activité a eu lieu, mais avant le seuil.
  if (!Number.isNaN(last) && last < cutoffMs) return "dormant";
  if ((card.rewards_earned ?? 0) >= 1) return "loyal";
  if ((card.stamps ?? 0) > 0) return "active";
  return "new";
}

/** Répartition d'un ensemble de cartes par segment. */
export function summarizeSegments(
  cards: SegmentCard[],
  cutoffMs: number
): SegmentSummary {
  const s: SegmentSummary = { loyal: 0, active: 0, new: 0, dormant: 0, total: 0 };
  for (const c of cards) {
    s[segmentOf(c, cutoffMs)]++;
    s.total++;
  }
  return s;
}

/** Normalise la sortie JSON de la RPC `dashboard_loyalty_segments`. */
export function segmentsFromRpc(data: unknown): SegmentSummary | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  return {
    loyal: n(d.loyal),
    active: n(d.active),
    new: n(d.new),
    dormant: n(d.dormant),
    total: n(d.total),
  };
}
