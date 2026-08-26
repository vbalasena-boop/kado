import { describe, it, expect } from "vitest";
import {
  computeAdminPlayStats,
  computeBusinessPlayCounts,
  adminPlayStatsFromRpc,
  businessPlayCountsFromRpc,
  type AdminPlayRow,
} from "@/lib/admin-stats";

const MONTH = "2026-08-01T00:00:00.000Z";
const DAY = "2026-08-26T00:00:00.000Z";

const rows: AdminPlayRow[] = [
  // aujourd'hui, instagram, gagné, récupéré
  { business_id: "b1", play_type: "instagram", prize_label: "Café", created_at: "2026-08-26T09:00:00Z", redeemed_at: "2026-08-26T10:00:00Z" },
  // ce mois mais pas aujourd'hui, review, perdant
  { business_id: "b1", play_type: "review", prize_label: "Rien", created_at: "2026-08-10T09:00:00Z", redeemed_at: null },
  // mois précédent, gagné (libellé nul → gagné)
  { business_id: "b2", play_type: "instagram", prize_label: null, created_at: "2026-07-15T09:00:00Z", redeemed_at: null },
];

describe("computeAdminPlayStats", () => {
  it("agrège total / mois / jour / canaux / won / redeemed", () => {
    const s = computeAdminPlayStats(rows, MONTH, DAY);
    expect(s.playsTotal).toBe(3);
    expect(s.playsMonth).toBe(2); // les deux d'août
    expect(s.playsToday).toBe(1); // seul le 26/08
    expect(s.insta).toBe(2);
    expect(s.review).toBe(1);
    expect(s.won).toBe(2); // Café + libellé nul ; « Rien » exclu
    expect(s.redeemed).toBe(1);
  });

  it("jeu vide → zéros", () => {
    expect(computeAdminPlayStats([], MONTH, DAY)).toEqual({
      playsTotal: 0, playsMonth: 0, playsToday: 0,
      insta: 0, review: 0, won: 0, redeemed: 0,
    });
  });
});

describe("computeBusinessPlayCounts", () => {
  it("compte par business_id, ignore les nuls", () => {
    const m = computeBusinessPlayCounts([
      ...rows,
      { business_id: null, play_type: "instagram" },
    ]);
    expect(m.get("b1")).toBe(2);
    expect(m.get("b2")).toBe(1);
    expect(m.size).toBe(2);
  });
});

describe("adminPlayStatsFromRpc", () => {
  it("normalise et coerce (bigint en chaîne)", () => {
    const s = adminPlayStatsFromRpc({
      playsTotal: "3", playsMonth: 2, playsToday: 1,
      insta: 2, review: 1, won: "2", redeemed: 1,
    });
    expect(s).toEqual({
      playsTotal: 3, playsMonth: 2, playsToday: 1,
      insta: 2, review: 1, won: 2, redeemed: 1,
    });
  });
  it("null sur entrée invalide", () => {
    expect(adminPlayStatsFromRpc(null)).toBeNull();
    expect(adminPlayStatsFromRpc("x")).toBeNull();
  });
  it("équivaut au repli JS pour des lignes équivalentes", () => {
    const js = computeAdminPlayStats(rows, MONTH, DAY);
    expect(adminPlayStatsFromRpc(js)).toEqual(js);
  });
});

describe("businessPlayCountsFromRpc", () => {
  it("reconstruit la Map depuis un array [id, n]", () => {
    const m = businessPlayCountsFromRpc([
      ["b1", 2],
      ["b2", "1"],
    ]);
    expect(m?.get("b1")).toBe(2);
    expect(m?.get("b2")).toBe(1);
  });
  it("null si ce n'est pas un tableau", () => {
    expect(businessPlayCountsFromRpc({})).toBeNull();
  });
  it("ignore les entrées mal formées", () => {
    const m = businessPlayCountsFromRpc([["b1", 5], ["ignoré"], [null, 9]]);
    expect(m?.size).toBe(1);
    expect(m?.get("b1")).toBe(5);
  });
});
