import { describe, it, expect } from "vitest";
import { hasFeature, normalizeFeatures } from "@/lib/features";

describe("hasFeature", () => {
  it("clef active → true", () => {
    expect(hasFeature({ beta: true }, "beta")).toBe(true);
  });
  it("clef absente → false", () => {
    expect(hasFeature({ beta: true }, "priority_support")).toBe(false);
  });
  it("valeur non-true → false", () => {
    expect(hasFeature({ beta: false as unknown as true }, "beta")).toBe(false);
  });
  it("features null/undefined → false (tolérant)", () => {
    expect(hasFeature(null, "beta")).toBe(false);
    expect(hasFeature(undefined, "beta")).toBe(false);
  });
});

describe("normalizeFeatures", () => {
  it("ne garde que les clefs connues et actives", () => {
    expect(
      normalizeFeatures({ beta: true, priority_support: false, inconnue: true })
    ).toEqual({ beta: true });
  });
  it("valeurs non booléennes ignorées", () => {
    expect(normalizeFeatures({ beta: "oui", hide_branding: 1 })).toEqual({});
  });
  it("entrée invalide → objet vide", () => {
    expect(normalizeFeatures(null)).toEqual({});
    expect(normalizeFeatures([1, 2])).toEqual({});
    expect(normalizeFeatures("x")).toEqual({});
  });
});
