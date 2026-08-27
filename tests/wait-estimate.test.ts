import { describe, it, expect } from "vitest";
import {
  averagePrepMs,
  friendlyMinutes,
  estimateWaitMinutes,
} from "@/lib/wait-estimate";

const at = (min: number) => new Date(min * 60000).toISOString();

describe("averagePrepMs", () => {
  it("médiane des durées de préparation (≥ 3 échantillons)", () => {
    // durées : 5, 10, 15 min → médiane 10 min
    const s = [
      { created_at: at(0), notified_ready_at: at(5) },
      { created_at: at(0), notified_ready_at: at(10) },
      { created_at: at(0), notified_ready_at: at(15) },
    ];
    expect(averagePrepMs(s)).toBe(10 * 60000);
  });
  it("null si moins de 3 échantillons fiables", () => {
    expect(
      averagePrepMs([{ created_at: at(0), notified_ready_at: at(5) }])
    ).toBeNull();
  });
  it("ignore les durées négatives / aberrantes / incomplètes", () => {
    const s = [
      { created_at: at(10), notified_ready_at: at(5) }, // négatif
      { created_at: at(0), notified_ready_at: null }, // incomplet
      { created_at: at(0), notified_ready_at: at(200) }, // > 2 h
      { created_at: at(0), notified_ready_at: at(6) },
      { created_at: at(0), notified_ready_at: at(8) },
    ];
    expect(averagePrepMs(s)).toBeNull(); // seulement 2 valides
  });
});

describe("friendlyMinutes", () => {
  it("à la minute jusqu'à 5, puis au multiple de 5", () => {
    expect(friendlyMinutes(3)).toBe(3);
    expect(friendlyMinutes(7)).toBe(5);
    expect(friendlyMinutes(13)).toBe(15);
    expect(friendlyMinutes(0)).toBe(1);
  });
});

describe("estimateWaitMinutes", () => {
  it("prépa moyenne × (ahead + 1), arrondi lisible", () => {
    // 5 min de prépa, 3 devant → 5 × 4 = 20 min
    expect(estimateWaitMinutes(5 * 60000, 3)).toBe(20);
    // 5 min, 0 devant → 5 min
    expect(estimateWaitMinutes(5 * 60000, 0)).toBe(5);
  });
  it("null sans base de calcul", () => {
    expect(estimateWaitMinutes(null, 2)).toBeNull();
  });
});
