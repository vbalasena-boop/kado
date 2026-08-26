import { describe, it, expect } from "vitest";
import {
  isAlmostNudgeEligible,
  isInactiveNudgeEligible,
  type LoyaltyCardNudge,
} from "@/lib/reengage";

const GOAL = 10;
const base: LoyaltyCardNudge = {
  id: "c1",
  email: "x@y.z",
  stamps: 9, // goal - 1
  reward_ready: false,
  marketing_ok: true,
  unsubscribed_at: null,
  last_stamp_at: "2026-08-20T10:00:00Z",
  nudge_almost_at: null,
};

describe("isAlmostNudgeEligible", () => {
  it("éligible : à goal-1, consentement OK, jamais relancé", () => {
    expect(isAlmostNudgeEligible(base, GOAL)).toBe(true);
  });

  it("pas à goal-1 → non", () => {
    expect(isAlmostNudgeEligible({ ...base, stamps: 8 }, GOAL)).toBe(false);
    expect(isAlmostNudgeEligible({ ...base, stamps: 10 }, GOAL)).toBe(false);
  });

  it("récompense déjà prête → non", () => {
    expect(isAlmostNudgeEligible({ ...base, reward_ready: true }, GOAL)).toBe(false);
  });

  it("consentement absent / désinscrit / sans e-mail → non", () => {
    expect(isAlmostNudgeEligible({ ...base, marketing_ok: false }, GOAL)).toBe(false);
    expect(
      isAlmostNudgeEligible({ ...base, unsubscribed_at: "2026-08-01T00:00:00Z" }, GOAL)
    ).toBe(false);
    expect(isAlmostNudgeEligible({ ...base, email: null }, GOAL)).toBe(false);
  });

  it("objectif < 2 → non (garde-fou)", () => {
    expect(isAlmostNudgeEligible({ ...base, stamps: 0 }, 1)).toBe(false);
  });

  it("anti-doublon : déjà relancé après le dernier tampon → non", () => {
    expect(
      isAlmostNudgeEligible(
        { ...base, nudge_almost_at: "2026-08-20T12:00:00Z" }, // après le tampon
        GOAL
      )
    ).toBe(false);
  });

  it("nouveau cycle : dernier tampon POSTÉRIEUR à la dernière relance → éligible", () => {
    expect(
      isAlmostNudgeEligible(
        {
          ...base,
          nudge_almost_at: "2026-07-01T10:00:00Z", // ancienne relance
          last_stamp_at: "2026-08-20T10:00:00Z", // tampon plus récent
        },
        GOAL
      )
    ).toBe(true);
  });
});

describe("isInactiveNudgeEligible", () => {
  const NOW = Date.parse("2026-08-26T00:00:00Z");
  const cutoff = NOW - 30 * 86_400_000; // inactif depuis > 30 j
  const card: LoyaltyCardNudge = {
    id: "c1",
    email: "x@y.z",
    stamps: 3,
    marketing_ok: true,
    unsubscribed_at: null,
    last_stamp_at: "2026-07-01T10:00:00Z", // il y a ~56 j → inactif
    nudge_inactive_at: null,
  };

  it("éligible : inactif au-delà du seuil, consentement OK, jamais relancé", () => {
    expect(isInactiveNudgeEligible(card, cutoff)).toBe(true);
  });

  it("encore actif (dernier tampon récent) → non", () => {
    expect(
      isInactiveNudgeEligible(
        { ...card, last_stamp_at: "2026-08-20T10:00:00Z" },
        cutoff
      )
    ).toBe(false);
  });

  it("n'a jamais commencé (0 tampon) → non", () => {
    expect(isInactiveNudgeEligible({ ...card, stamps: 0 }, cutoff)).toBe(false);
  });

  it("consentement absent / désinscrit / sans e-mail / sans dernier passage → non", () => {
    expect(isInactiveNudgeEligible({ ...card, marketing_ok: false }, cutoff)).toBe(false);
    expect(
      isInactiveNudgeEligible({ ...card, unsubscribed_at: "2026-08-01T00:00:00Z" }, cutoff)
    ).toBe(false);
    expect(isInactiveNudgeEligible({ ...card, email: null }, cutoff)).toBe(false);
    expect(isInactiveNudgeEligible({ ...card, last_stamp_at: null }, cutoff)).toBe(false);
  });

  it("anti-doublon : déjà relancé pour cette inactivité → non", () => {
    expect(
      isInactiveNudgeEligible(
        { ...card, nudge_inactive_at: "2026-07-10T10:00:00Z" }, // après le tampon
        cutoff
      )
    ).toBe(false);
  });

  it("revenu puis re-inactif : dernier tampon > dernière relance → éligible", () => {
    expect(
      isInactiveNudgeEligible(
        {
          ...card,
          nudge_inactive_at: "2026-05-01T10:00:00Z", // vieille relance
          last_stamp_at: "2026-07-01T10:00:00Z", // repassé depuis, puis re-inactif
        },
        cutoff
      )
    ).toBe(true);
  });
});
