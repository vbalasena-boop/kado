import { describe, it, expect } from "vitest";
import {
  bucketDailyFunnel,
  funnelDailyToCsv,
  type FunnelEvent,
} from "@/lib/funnel-csv";

describe("bucketDailyFunnel", () => {
  it("agrège par jour et par type (UTC)", () => {
    const events: FunnelEvent[] = [
      { kind: "scan", at: "2026-09-06T08:00:00Z" },
      { kind: "scan", at: "2026-09-06T09:00:00Z" },
      { kind: "play", at: "2026-09-06T09:05:00Z" },
      { kind: "insta", at: "2026-09-06T09:06:00Z" },
      { kind: "review", at: "2026-09-06T10:00:00Z" },
    ];
    expect(bucketDailyFunnel(events, "UTC")).toEqual([
      { date: "2026-09-06", scans: 2, plays: 1, insta: 1, reviewClicks: 1 },
    ]);
  });

  it("trie par date décroissante (plus récent en haut)", () => {
    const events: FunnelEvent[] = [
      { kind: "scan", at: "2026-09-04T08:00:00Z" },
      { kind: "scan", at: "2026-09-06T08:00:00Z" },
      { kind: "scan", at: "2026-09-05T08:00:00Z" },
    ];
    expect(bucketDailyFunnel(events, "UTC").map((d) => d.date)).toEqual([
      "2026-09-06",
      "2026-09-05",
      "2026-09-04",
    ]);
  });

  it("découpe les jours dans le fuseau demandé (minuit local, heure d'été)", () => {
    // 2026-09-07T00:30 à Paris (UTC+2 en été) = 2026-09-06T22:30Z.
    const events: FunnelEvent[] = [{ kind: "play", at: "2026-09-06T22:30:00Z" }];
    // En UTC : le 6. À Paris : le 7 (le bon jour pour le commerçant).
    expect(bucketDailyFunnel(events, "UTC")[0].date).toBe("2026-09-06");
    expect(bucketDailyFunnel(events, "Europe/Paris")[0].date).toBe("2026-09-07");
  });

  it("ignore les dates invalides", () => {
    const events: FunnelEvent[] = [
      { kind: "scan", at: "pas une date" },
      { kind: "play", at: "2026-09-06T08:00:00Z" },
    ];
    expect(bucketDailyFunnel(events, "UTC")).toEqual([
      { date: "2026-09-06", scans: 0, plays: 1, insta: 0, reviewClicks: 0 },
    ]);
  });

  it("n'invente pas de jours à zéro", () => {
    const events: FunnelEvent[] = [
      { kind: "scan", at: "2026-09-01T08:00:00Z" },
      { kind: "scan", at: "2026-09-06T08:00:00Z" },
    ];
    expect(bucketDailyFunnel(events, "UTC")).toHaveLength(2);
  });

  it("liste vide → aucune ligne", () => {
    expect(bucketDailyFunnel([], "UTC")).toEqual([]);
  });
});

describe("funnelDailyToCsv", () => {
  it("en-tête + lignes, tout entre guillemets", () => {
    const csv = funnelDailyToCsv([
      { date: "2026-09-06", scans: 2, plays: 1, insta: 1, reviewClicks: 1 },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe('"date","scans","tours","instagram","clics_avis"');
    expect(lines[1]).toBe('"2026-09-06","2","1","1","1"');
  });

  it("aucune donnée → en-tête seul", () => {
    expect(funnelDailyToCsv([])).toBe('"date","scans","tours","instagram","clics_avis"');
  });
});
