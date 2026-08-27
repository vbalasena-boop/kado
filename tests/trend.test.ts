import { describe, it, expect } from "vitest";
import {
  parseTrendRpc,
  fillDailySeries,
  fillMonthlySeries,
  aggregateByMonth,
  monthToDateComparison,
} from "@/lib/trend";

describe("parseTrendRpc", () => {
  it("construit une Map jour→nombre, coerce les nombres", () => {
    const m = parseTrendRpc([
      ["2026-08-01", 3],
      ["2026-08-02", "5"],
    ]);
    expect(m.get("2026-08-01")).toBe(3);
    expect(m.get("2026-08-02")).toBe(5);
  });
  it("tolère une entrée non-tableau", () => {
    expect(parseTrendRpc(null).size).toBe(0);
    expect(parseTrendRpc("x").size).toBe(0);
  });
});

describe("fillDailySeries", () => {
  it("série continue, jours manquants à 0, se termine à endIso", () => {
    const m = new Map([
      ["2026-08-24", 2],
      ["2026-08-26", 5],
    ]);
    const s = fillDailySeries(m, "2026-08-26", 3);
    expect(s).toEqual([
      { date: "2026-08-24", count: 2 },
      { date: "2026-08-25", count: 0 },
      { date: "2026-08-26", count: 5 },
    ]);
  });

  it("gère un passage de mois", () => {
    const s = fillDailySeries(new Map(), "2026-09-01", 2);
    expect(s.map((d) => d.date)).toEqual(["2026-08-31", "2026-09-01"]);
  });
});

describe("aggregateByMonth", () => {
  it("regroupe les comptes journaliers par mois", () => {
    const m = aggregateByMonth(
      new Map([
        ["2026-08-01", 2],
        ["2026-08-31", 3],
        ["2026-07-15", 4],
      ])
    );
    expect(m.get("2026-08")).toBe(5);
    expect(m.get("2026-07")).toBe(4);
  });
});

describe("fillMonthlySeries", () => {
  it("série mensuelle continue, mois manquants à 0, finit à endMonth", () => {
    const s = fillMonthlySeries(new Map([["2026-08", 5]]), "2026-09", 3);
    expect(s).toEqual([
      { date: "2026-07", count: 0 },
      { date: "2026-08", count: 5 },
      { date: "2026-09", count: 0 },
    ]);
  });

  it("gère un passage d'année", () => {
    const s = fillMonthlySeries(new Map(), "2027-01", 2);
    expect(s.map((d) => d.date)).toEqual(["2026-12", "2027-01"]);
  });
});

describe("monthToDateComparison", () => {
  const today = "2026-08-15";
  const counts = new Map<string, number>([
    ["2026-08-05", 4], // ce mois, avant le 15 → compté
    ["2026-08-15", 2], // ce mois, le 15 → compté
    ["2026-08-20", 9], // ce mois, APRÈS le 15 → ignoré (période égale)
    ["2026-07-05", 3], // mois dernier, avant le 15 → compté
    ["2026-07-25", 7], // mois dernier, APRÈS le 15 → ignoré
    ["2026-06-10", 5], // mois-2 → ignoré
  ]);

  it("compare à période égale (1 → même quantième)", () => {
    const c = monthToDateComparison(counts, today);
    expect(c.current).toBe(6); // 4 + 2
    expect(c.previous).toBe(3); // 3 (le 25/07 ignoré)
    expect(c.deltaPct).toBe(100); // (6-3)/3
  });

  it("deltaPct null si le mois précédent est à 0", () => {
    const c = monthToDateComparison(new Map([["2026-08-05", 4]]), today);
    expect(c.current).toBe(4);
    expect(c.previous).toBe(0);
    expect(c.deltaPct).toBeNull();
  });
});
