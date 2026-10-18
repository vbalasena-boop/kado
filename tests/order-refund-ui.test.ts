import { describe, expect, it } from "vitest";
import { cancellationRefundMessages } from "@/lib/order-refund-ui";

describe("cancellationRefundMessages", () => {
  it("warns when an online payment was not attempted", () => {
    expect(cancellationRefundMessages(null, true)[0]).toContain(
      "remboursement non tenté"
    );
    expect(cancellationRefundMessages(null, false)).toEqual([]);
  });

  it.each([
    [{ status: "refunded", stripeRefundId: "re_1" }, "remboursement déclenché"],
    [{ status: "failed", detail: "Stripe indisponible" }, "remboursement échoué"],
    [{ status: "record_failed", stripeRefundId: "re_1" }, "état non enregistré"],
    [{ status: "no_payment_intent" }, "paiement Stripe introuvable"],
    [{ status: "skipped", code: "already_refunded" }, "déjà remboursée"],
  ] as const)("describes the %s outcome", (outcome, expected) => {
    expect(cancellationRefundMessages(outcome, true)[0]).toContain(expected);
  });

  it("does not show an error when the order was not eligible for a refund", () => {
    expect(
      cancellationRefundMessages(
        { status: "skipped", code: "not_online_paid" },
        false
      )
    ).toEqual([]);
  });
});
