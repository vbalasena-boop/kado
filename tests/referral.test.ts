import { describe, it, expect } from "vitest";
import { shouldReverseReferral } from "@/lib/referral";

// Récompense accordée le 20/08. "Dans les 14 j" = avant le 03/09.
const rewardedAt = "2026-08-20T00:00:00.000Z";
const withinMs = new Date("2026-08-25T00:00:00.000Z").getTime(); // J+5
const afterMs = new Date("2026-09-10T00:00:00.000Z").getTime(); // J+21

const base = {
  amount: 2900,
  amountRefunded: 2900,
  hasInvoice: true,
  referredBy: "sponsor-1",
  rewardedAt,
  nowMs: withinMs,
};

describe("shouldReverseReferral", () => {
  it("reprend : remboursement TOTAL d'un abonnement, filleul parrainé, dans les 14 j", () => {
    expect(shouldReverseReferral(base)).toBe(true);
  });

  it("ne reprend pas un remboursement PARTIEL", () => {
    expect(shouldReverseReferral({ ...base, amountRefunded: 1000 })).toBe(false);
  });

  it("ne reprend pas une charge hors abonnement (commande / installation)", () => {
    expect(shouldReverseReferral({ ...base, hasInvoice: false })).toBe(false);
  });

  it("ne reprend pas si le filleul n'a pas de parrain", () => {
    expect(shouldReverseReferral({ ...base, referredBy: null })).toBe(false);
  });

  it("ne reprend pas au-delà des 14 jours", () => {
    expect(shouldReverseReferral({ ...base, nowMs: afterMs })).toBe(false);
  });

  it("ne reprend pas si aucune récompense n'a été accordée", () => {
    expect(shouldReverseReferral({ ...base, rewardedAt: null })).toBe(false);
  });

  it("ne reprend pas un montant nul", () => {
    expect(
      shouldReverseReferral({ ...base, amount: 0, amountRefunded: 0 })
    ).toBe(false);
  });
});
