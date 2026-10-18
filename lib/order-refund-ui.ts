import type { RefundOutcome } from "@/lib/order-refund";

/** Messages displayed to the merchant after a best-effort refund on cancellation. */
export function cancellationRefundMessages(
  outcome: RefundOutcome | null,
  paid: boolean | null | undefined
): string[] {
  if (!outcome) {
    return paid
      ? ["⚠️ remboursement non tenté — vérifiez via « ↩️ Rembourser »"]
      : [];
  }

  switch (outcome.status) {
    case "refunded":
      return ["remboursement déclenché ↩️"];
    case "failed":
      return ["remboursement échoué — réessayez via « ↩️ Rembourser »"];
    case "record_failed":
      return ["remboursement Stripe effectué (état non enregistré)"];
    case "no_payment_intent":
      return ["remboursement impossible (paiement Stripe introuvable)"];
    case "skipped":
      return outcome.code === "already_refunded" ? ["déjà remboursée"] : [];
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}
