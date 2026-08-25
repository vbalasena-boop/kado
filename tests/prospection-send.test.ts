import { describe, it, expect } from "vitest";
import { warmupCap } from "@/lib/prospection/send-run";

describe("warmupCap (montée en charge progressive)", () => {
  it("démarre bas et monte par paliers", () => {
    const cap = 40;
    expect(warmupCap(0, cap)).toBe(5); // J0
    expect(warmupCap(2, cap)).toBe(5); // J2
    expect(warmupCap(3, cap)).toBe(10); // J3
    expect(warmupCap(6, cap)).toBe(10); // J6
    expect(warmupCap(7, cap)).toBe(20); // J7
    expect(warmupCap(13, cap)).toBe(20); // J13
    expect(warmupCap(14, cap)).toBe(40); // J14 → plafond
    expect(warmupCap(999, cap)).toBe(40);
  });

  it("ne dépasse jamais le plafond configuré", () => {
    // Plafond bas (ex. utilisateur à 10/j) : les paliers sont bornés.
    expect(warmupCap(0, 10)).toBe(5);
    expect(warmupCap(3, 10)).toBe(10);
    expect(warmupCap(7, 10)).toBe(10); // borné à 10, pas 20
    expect(warmupCap(30, 10)).toBe(10);
  });
});
