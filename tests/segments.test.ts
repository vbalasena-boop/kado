import { describe, it, expect } from "vitest";
import {
  segmentOf,
  summarizeSegments,
  segmentsFromRpc,
} from "@/lib/segments";

// Seuil « à réveiller » fixé au 2026-08-01 pour des dates déterministes.
const CUTOFF = Date.parse("2026-08-01T00:00:00Z");

describe("segmentOf", () => {
  it("dormant : dernière activité avant le seuil (prioritaire)", () => {
    expect(
      segmentOf(
        { stamps: 3, rewards_earned: 2, last_stamp_at: "2026-06-01T00:00:00Z" },
        CUTOFF
      )
    ).toBe("dormant");
  });
  it("loyal : récompense déjà gagnée, encore actif", () => {
    expect(
      segmentOf(
        { stamps: 1, rewards_earned: 1, last_stamp_at: "2026-08-20T00:00:00Z" },
        CUTOFF
      )
    ).toBe("loyal");
  });
  it("active : tampons en cours, pas encore de récompense", () => {
    expect(
      segmentOf(
        { stamps: 2, rewards_earned: 0, last_stamp_at: "2026-08-20T00:00:00Z" },
        CUTOFF
      )
    ).toBe("active");
  });
  it("new : inscrit sans tampon (last_stamp_at null → jamais dormant)", () => {
    expect(
      segmentOf({ stamps: 0, rewards_earned: 0, last_stamp_at: null }, CUTOFF)
    ).toBe("new");
  });
});

describe("summarizeSegments", () => {
  it("compte chaque segment et le total", () => {
    const s = summarizeSegments(
      [
        { stamps: 1, rewards_earned: 1, last_stamp_at: "2026-08-20T00:00:00Z" }, // loyal
        { stamps: 2, rewards_earned: 0, last_stamp_at: "2026-08-15T00:00:00Z" }, // active
        { stamps: 0, rewards_earned: 0, last_stamp_at: null }, // new
        { stamps: 5, rewards_earned: 3, last_stamp_at: "2026-05-01T00:00:00Z" }, // dormant
      ],
      CUTOFF
    );
    expect(s).toEqual({ loyal: 1, active: 1, new: 1, dormant: 1, total: 4 });
  });
});

describe("segmentsFromRpc", () => {
  it("normalise la sortie JSON (coerce les nombres)", () => {
    expect(
      segmentsFromRpc({ loyal: 2, active: "3", new: 1, dormant: 0, total: 6 })
    ).toEqual({ loyal: 2, active: 3, new: 1, dormant: 0, total: 6 });
  });
  it("null si entrée invalide", () => {
    expect(segmentsFromRpc(null)).toBeNull();
  });
});
