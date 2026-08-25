/**
 * Décision de reprise de récompense de parrainage.
 *
 * Pure et sans effet de bord → testable et réutilisée par le webhook Stripe
 * (charge.refunded). On ne reprend le mois offert au parrain QUE si :
 *  - le remboursement est TOTAL (amount_refunded couvre amount) ;
 *  - la charge remboursée est bien une facture d'ABONNEMENT (pas une commande,
 *    une installation, ni un remboursement partiel) ;
 *  - le filleul a bien un parrain ;
 *  - le remboursement survient dans les 14 jours suivant la récompense.
 */
export interface ReferralReversalInput {
  /** Montant total de la charge (centimes). */
  amount: number;
  /** Montant remboursé (centimes). */
  amountRefunded: number;
  /** La charge est-elle rattachée à une facture d'abonnement ? */
  hasInvoice: boolean;
  /** L'id du parrain du filleul (null si pas de parrain). */
  referredBy: string | null | undefined;
  /** Date (ISO) à laquelle la récompense a été accordée, ou null. */
  rewardedAt: string | null | undefined;
  /** Horodatage courant (ms). */
  nowMs: number;
}

export const REWARD_REVERSAL_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export function shouldReverseReferral(input: ReferralReversalInput): boolean {
  const fullRefund = input.amount > 0 && input.amountRefunded >= input.amount;
  if (!fullRefund || !input.hasInvoice || !input.referredBy) return false;
  const rewardedMs = input.rewardedAt ? new Date(input.rewardedAt).getTime() : 0;
  if (!(rewardedMs > 0)) return false;
  return input.nowMs - rewardedMs < REWARD_REVERSAL_WINDOW_MS;
}
