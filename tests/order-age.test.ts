import { describe, it, expect } from "vitest";
import {
  minutesSince,
  orderAgeLevel,
  orderAgeLabel,
  orderAge,
  AGING_MIN,
  LATE_MIN,
} from "@/lib/order-age";

const T0 = Date.parse("2026-09-06T12:00:00Z");
const at = (minLater: number) => T0 + minLater * 60000;

describe("minutesSince", () => {
  it("compte les minutes entières écoulées", () => {
    expect(minutesSince("2026-09-06T12:00:00Z", at(12))).toBe(12);
  });
  it("arrondit vers le bas (59 s → 0 min)", () => {
    expect(minutesSince("2026-09-06T12:00:00Z", T0 + 59_000)).toBe(0);
  });
  it("borne à 0 si la date est dans le futur", () => {
    expect(minutesSince("2026-09-06T12:05:00Z", T0)).toBe(0);
  });
  it("date invalide → null", () => {
    expect(minutesSince("pas une date", T0)).toBeNull();
  });
});

describe("orderAgeLevel", () => {
  it("< 10 min → fresh", () => {
    expect(orderAgeLevel(0)).toBe("fresh");
    expect(orderAgeLevel(AGING_MIN - 1)).toBe("fresh");
  });
  it("10–19 min → aging", () => {
    expect(orderAgeLevel(AGING_MIN)).toBe("aging");
    expect(orderAgeLevel(LATE_MIN - 1)).toBe("aging");
  });
  it(">= 20 min → late", () => {
    expect(orderAgeLevel(LATE_MIN)).toBe("late");
    expect(orderAgeLevel(90)).toBe("late");
  });
});

describe("orderAgeLabel", () => {
  it("0 min → à l'instant", () => {
    expect(orderAgeLabel(0)).toBe("à l'instant");
  });
  it("minutes seules", () => {
    expect(orderAgeLabel(1)).toBe("1 min");
    expect(orderAgeLabel(45)).toBe("45 min");
  });
  it("heures pile", () => {
    expect(orderAgeLabel(120)).toBe("2 h");
  });
  it("heures + minutes (zéro-paddées)", () => {
    expect(orderAgeLabel(65)).toBe("1 h 05");
  });
});

describe("orderAge", () => {
  it("assemble minutes + libellé + niveau", () => {
    expect(orderAge("2026-09-06T12:00:00Z", at(25))).toEqual({
      minutes: 25,
      label: "25 min",
      level: "late",
    });
  });
  it("date invalide → null (badge masqué, jamais cassé)", () => {
    expect(orderAge("nope", T0)).toBeNull();
  });
});
