/**
 * Relances automatiques de fidélité. Logique PURE de décision « faut-il
 * relancer cette carte ? », isolée pour être testable (l'envoi vit dans le
 * cron quotidien).
 */

export type LoyaltyCardNudge = {
  id: string;
  email: string | null;
  stamps: number;
  reward_ready?: boolean | null;
  marketing_ok?: boolean | null;
  unsubscribed_at?: string | null;
  last_stamp_at?: string | null;
  nudge_almost_at?: string | null;
  nudge_inactive_at?: string | null;
};

/**
 * Éligible à la relance « plus qu'un tampon » ?
 *  - carte exactement à `goal - 1` tampons, récompense pas déjà prête ;
 *  - consentement marketing donné, non désinscrit, e-mail présent ;
 *  - anti-doublon : pas déjà relancé POUR CE CYCLE — une relance postérieure au
 *    dernier tampon signifie « même cycle », on ne renvoie pas. Après un nouveau
 *    passage (last_stamp_at plus récent), la carte redevient éligible.
 */
export function isAlmostNudgeEligible(
  card: LoyaltyCardNudge,
  goal: number
): boolean {
  if (!Number.isFinite(goal) || goal < 2) return false;
  if (card.stamps !== goal - 1) return false;
  if (card.reward_ready) return false;
  if (!card.marketing_ok) return false;
  if (card.unsubscribed_at) return false;
  if (!card.email) return false;

  const nudged = card.nudge_almost_at ? Date.parse(card.nudge_almost_at) : NaN;
  if (!Number.isNaN(nudged)) {
    const stamped = card.last_stamp_at ? Date.parse(card.last_stamp_at) : NaN;
    // Relance déjà envoyée après (ou en même temps que) le dernier tampon →
    // cycle déjà couvert → on ne relance pas.
    if (Number.isNaN(stamped) || nudged >= stamped) return false;
  }
  return true;
}

/**
 * Éligible à la relance « client inactif » ?
 *  - a commencé à cumuler (stamps > 0), consentement OK, non désinscrit ;
 *  - dernier tampon plus ancien que le seuil (`cutoffMs` = maintenant − délai) ;
 *  - anti-doublon : une relance postérieure au dernier tampon = période déjà
 *    couverte. Un nouveau passage (last_stamp_at plus récent) rouvre le droit.
 */
export function isInactiveNudgeEligible(
  card: LoyaltyCardNudge,
  cutoffMs: number
): boolean {
  if (!card.email) return false;
  if (!card.marketing_ok) return false;
  if (card.unsubscribed_at) return false;
  if ((card.stamps ?? 0) <= 0) return false;

  const stamped = card.last_stamp_at ? Date.parse(card.last_stamp_at) : NaN;
  if (Number.isNaN(stamped)) return false; // dernier passage inconnu
  if (stamped >= cutoffMs) return false; // encore actif

  const nudged = card.nudge_inactive_at ? Date.parse(card.nudge_inactive_at) : NaN;
  if (!Number.isNaN(nudged) && nudged >= stamped) return false;
  return true;
}
