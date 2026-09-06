import { describe, it, expect } from "vitest";
import {
  isReviewInviteEligible,
  isLeadReviewInviteEligible,
} from "@/lib/review-invite";

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

describe("isLeadReviewInviteEligible", () => {
  it("lead avec e-mail, non désinscrit, jamais invité → éligible", () => {
    expect(
      isLeadReviewInviteEligible({
        email: "a@b.fr",
        unsubscribed_at: null,
        review_invite_leads_at: null,
      })
    ).toBe(true);
  });

  it("sans e-mail → non éligible", () => {
    expect(isLeadReviewInviteEligible({ email: "", unsubscribed_at: null })).toBe(false);
    expect(isLeadReviewInviteEligible({ email: "   ", unsubscribed_at: null })).toBe(false);
    expect(isLeadReviewInviteEligible({ email: null })).toBe(false);
  });

  it("désinscrit → non éligible", () => {
    expect(
      isLeadReviewInviteEligible({
        email: "a@b.fr",
        unsubscribed_at: "2026-08-01T10:00:00Z",
      })
    ).toBe(false);
  });

  it("déjà invité une fois → non éligible (envoi unique)", () => {
    expect(
      isLeadReviewInviteEligible({
        email: "a@b.fr",
        review_invite_leads_at: "2026-08-01T10:00:00Z",
      })
    ).toBe(false);
  });
});
