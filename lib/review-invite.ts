/**
 * Invitation à laisser un avis Google — logique PURE (testable, sans base).
 *
 * Conforme à la politique Google : on n'invite que sur un signal de
 * COMPORTEMENT (client ayant complété au moins une carte de fidélité), jamais
 * sur un signal de SATISFACTION, et sans aucune récompense liée à l'avis.
 * L'envoi est unique par client (anti-doublon via `review_invite_at`).
 */

export type ReviewInviteCard = {
  rewards_earned?: number | null;
  review_invite_at?: string | null;
};

/**
 * Un client est éligible ⟺ il a complété au moins une carte (fidèle avéré) ET
 * n'a jamais reçu d'invitation. Le consentement marketing et la désinscription
 * sont filtrés en amont (requête), comme les autres relances.
 */
export function isReviewInviteEligible(card: ReviewInviteCard): boolean {
  if (card.review_invite_at) return false; // déjà invité une fois
  return (card.rewards_earned ?? 0) >= 1;
}
