import { describe, it, expect } from "vitest";
import { recapDelta, recapDeltaLabel } from "@/lib/recap";

describe("recapDelta", () => {
  it("hausse : pourcentage positif, direction up", () => {
    expect(recapDelta(12, 10)).toEqual({ pct: 20, dir: "up" });
  });
  it("baisse : pourcentage négatif, direction down", () => {
    expect(recapDelta(8, 10)).toEqual({ pct: -20, dir: "down" });
  });
  it("stable : 0 %, direction flat", () => {
    expect(recapDelta(10, 10)).toEqual({ pct: 0, dir: "flat" });
  });
  it("semaine précédente à 0 : pas de pourcentage", () => {
    expect(recapDelta(5, 0)).toEqual({ pct: null, dir: "up" });
    expect(recapDelta(0, 0)).toEqual({ pct: null, dir: "flat" });
  });
});

describe("recapDeltaLabel", () => {
  it("formate hausse / baisse / stable", () => {
    expect(recapDeltaLabel(12, 10)).toBe("▲ +20 %");
    expect(recapDeltaLabel(8, 10)).toBe("▼ -20 %");
    expect(recapDeltaLabel(10, 10)).toBe("=");
  });
  it("« nouveau » quand activité sans base précédente", () => {
    expect(recapDeltaLabel(5, 0)).toBe("nouveau");
  });
  it("null quand rien des deux côtés", () => {
    expect(recapDeltaLabel(0, 0)).toBeNull();
  });
});
