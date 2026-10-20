import { describe, expect, it } from "vitest";
import { DEFAULT_PRIZES } from "@/lib/defaults";
import { wheelTextColor } from "@/lib/wheel-face";

function luminance(hex: string): number {
  return [1, 3, 5].map((i) => {
    const value = parseInt(hex.slice(i, i + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
}

describe("default wheel palette", () => {
  it("uses site colors with readable text on every segment", () => {
    const allowed = new Set(["#e85b3d", "#efc64f", "#6d9273", "#33204d", "#ddd2bf"]);
    for (const prize of DEFAULT_PRIZES) {
      expect(allowed.has(prize.color)).toBe(true);
      const background = luminance(prize.color);
      const foreground = luminance(wheelTextColor(prize.color));
      expect((Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
    expect(new Set(DEFAULT_PRIZES.map((prize) => prize.color)).size).toBe(5);
  });
});
