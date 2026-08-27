import { describe, it, expect } from "vitest";
import { isConvertNudgeEligible } from "@/lib/convert-nudge";

const NOW = Date.parse("2026-08-27T00:00:00Z");
const daysAgo = (n: number) =>
  new Date(NOW - n * 864e5).toISOString();

describe("isConvertNudgeEligible", () => {
  it("lead de 10 jours, non désinscrit, jamais relancé → éligible", () => {
    expect(
      isConvertNudgeEligible(
        { email: "a@b.fr", created_at: daysAgo(10) },
        NOW
      )
    ).toBe(true);
  });

  it("trop récent (< 3 j) → non éligible", () => {
    expect(
      isConvertNudgeEligible({ email: "a@b.fr", created_at: daysAgo(1) }, NOW)
    ).toBe(false);
  });

  it("trop ancien (> 45 j) → non éligible", () => {
    expect(
      isConvertNudgeEligible({ email: "a@b.fr", created_at: daysAgo(60) }, NOW)
    ).toBe(false);
  });

  it("désinscrit → non éligible", () => {
    expect(
      isConvertNudgeEligible(
        {
          email: "a@b.fr",
          created_at: daysAgo(10),
          unsubscribed_at: daysAgo(2),
        },
        NOW
      )
    ).toBe(false);
  });

  it("déjà relancé → non éligible", () => {
    expect(
      isConvertNudgeEligible(
        {
          email: "a@b.fr",
          created_at: daysAgo(10),
          convert_nudge_at: daysAgo(1),
        },
        NOW
      )
    ).toBe(false);
  });

  it("sans e-mail (lead téléphone) → non éligible", () => {
    expect(
      isConvertNudgeEligible({ email: null, created_at: daysAgo(10) }, NOW)
    ).toBe(false);
  });
});
