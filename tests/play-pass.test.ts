import { describe, expect, it } from "vitest";
import {
  generatePlayPassCode,
  hashPlayPassCode,
  normalizePlayPassCode,
} from "@/lib/play-pass";

describe("codes de jeu à usage unique", () => {
  it("génère des codes au format lisible attendu", () => {
    const code = generatePlayPassCode();
    expect(code).toMatch(/^KDO-[23456789A-HJ-NP-Z]{5}-[23456789A-HJ-NP-Z]{5}$/);
  });

  it("normalise la casse et refuse les codes mal formés", () => {
    expect(normalizePlayPassCode(" kdo-abcde-fghjk ")).toBe("KDO-ABCDE-FGHJK");
    expect(normalizePlayPassCode("KDO-ABCDE-FGHIJ")).toBeNull();
    expect(normalizePlayPassCode("not-a-code")).toBeNull();
  });

  it("hachage stable un code sans le conserver en clair", () => {
    const code = "KDO-ABCDE-FGHJK";
    expect(hashPlayPassCode(code)).toBe(hashPlayPassCode(code));
    expect(hashPlayPassCode(code)).not.toBe(code);
  });
});
