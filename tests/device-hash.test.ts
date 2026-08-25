import { describe, it, expect } from "vitest";
import { isValidDeviceHash } from "@/lib/device-hash";

describe("isValidDeviceHash", () => {
  const valid = "a".repeat(64);

  it("accepte un hex SHA-256 (64 caractères 0-9a-f)", () => {
    expect(isValidDeviceHash(valid)).toBe(true);
    expect(
      isValidDeviceHash(
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
      )
    ).toBe(true);
  });

  it("rejette une mauvaise longueur", () => {
    expect(isValidDeviceHash("a".repeat(63))).toBe(false);
    expect(isValidDeviceHash("a".repeat(65))).toBe(false);
    expect(isValidDeviceHash("")).toBe(false);
  });

  it("rejette les caractères hors [0-9a-f] (majuscules, injection…)", () => {
    expect(isValidDeviceHash("A".repeat(64))).toBe(false);
    expect(isValidDeviceHash("g".repeat(64))).toBe(false);
    expect(isValidDeviceHash("../".padEnd(64, "0"))).toBe(false);
  });

  it("rejette les types non-string", () => {
    expect(isValidDeviceHash(null)).toBe(false);
    expect(isValidDeviceHash(undefined)).toBe(false);
    expect(isValidDeviceHash(123)).toBe(false);
    expect(isValidDeviceHash({})).toBe(false);
  });
});
