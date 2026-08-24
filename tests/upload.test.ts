import { describe, it, expect } from "vitest";
import { imageExt } from "@/lib/upload";

describe("imageExt — whitelist d'upload (correctif SVG)", () => {
  it("accepte png / jpeg / webp avec l'extension normalisée", () => {
    expect(imageExt("image/png")).toBe("png");
    expect(imageExt("image/jpeg")).toBe("jpg");
    expect(imageExt("image/webp")).toBe("webp");
  });

  it("refuse le SVG et tout type non listé", () => {
    expect(imageExt("image/svg+xml")).toBeNull(); // vecteur XSS stockée
    expect(imageExt("image/gif")).toBeNull();
    expect(imageExt("text/html")).toBeNull();
    expect(imageExt("")).toBeNull();
    expect(imageExt(undefined)).toBeNull();
    expect(imageExt(null)).toBeNull();
  });
});
