import { describe, it, expect } from "vitest";
import { isReviewInviteEligible } from "@/lib/review-invite";

describe("isReviewInviteEligible", () => {
  it("client fidèle jamais invité → éligible", () => {
    expect(
      isReviewInviteEligible({ rewards_earned: 1, review_invite_at: null })
    ).toBe(true);
  });

  it("aucune carte complétée → non éligible", () => {
    expect(
      isReviewInviteEligible({ rewards_earned: 0, review_invite_at: null })
    ).toBe(false);
    expect(isReviewInviteEligible({ review_invite_at: null })).toBe(false);
  });

  it("déjà invité une fois → non éligible (envoi unique)", () => {
    expect(
      isReviewInviteEligible({
        rewards_earned: 3,
        review_invite_at: "2026-08-01T10:00:00Z",
      })
    ).toBe(false);
  });
});
