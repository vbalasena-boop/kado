import { describe, it, expect } from "vitest";
import {
  averagePrepMs,
  friendlyMinutes,
  estimateWaitMinutes,
  readyClockLabel,
  shouldAlertNext,
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

describe("readyClockLabel", () => {
  it("ajoute waitMin à l'heure de référence, format « 12h35 »", () => {
    const now = new Date("2026-09-06T12:20:00");
    expect(readyClockLabel(15, now)).toBe("12h35");
  });
  it("minutes zéro-paddées et passage d'heure", () => {
    const now = new Date("2026-09-06T12:55:00");
    expect(readyClockLabel(10, now)).toBe("13h05");
  });
  it("null si pas d'estimation", () => {
    expect(readyClockLabel(null, new Date("2026-09-06T12:00:00"))).toBeNull();
    expect(readyClockLabel(0, new Date("2026-09-06T12:00:00"))).toBeNull();
  });
});

describe("shouldAlertNext", () => {
  it("passe le prochain (>0 → 0) en file → alerte", () => {
    expect(shouldAlertNext(2, 0, "new", false)).toBe(true);
    expect(shouldAlertNext(null, 0, "new", false)).toBe(true);
  });
  it("déjà à 0, ou déjà alerté, ou pas en file → pas d'alerte", () => {
    expect(shouldAlertNext(0, 0, "new", false)).toBe(false); // déjà prochain
    expect(shouldAlertNext(2, 0, "new", true)).toBe(false); // déjà alerté
    expect(shouldAlertNext(2, 0, "ready", false)).toBe(false); // plus en file
  });
  it("position non nulle ou inconnue → pas d'alerte", () => {
    expect(shouldAlertNext(3, 1, "new", false)).toBe(false);
    expect(shouldAlertNext(3, null, "new", false)).toBe(false);
  });
});
