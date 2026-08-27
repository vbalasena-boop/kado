import { describe, it, expect } from "vitest";
import { recapDelta, recapDeltaLabel, parseRecapRows } from "@/lib/recap";

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

describe("parseRecapRows", () => {
  it("normalise les lignes RPC (coerce les nombres)", () => {
    const rows = parseRecapRows([
      {
        business_id: "b1",
        tours: 10,
        gagnes: "4",
        echanges: 2,
        emails: 5,
        fid: 3,
        prev_tours: 8,
        prev_emails: "6",
        prev_fid: 1,
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      business_id: "b1",
      tours: 10,
      gagnes: 4,
      echanges: 2,
      emails: 5,
      fid: 3,
      prev_tours: 8,
      prev_emails: 6,
      prev_fid: 1,
    });
  });
  it("ignore les entrées sans business_id et les non-tableaux", () => {
    expect(parseRecapRows([{ tours: 1 }]).length).toBe(0);
    expect(parseRecapRows(null).length).toBe(0);
  });
});
