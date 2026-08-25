import { describe, it, expect } from "vitest";
import {
  sanitizeTriggerActions,
  isTriggerActionAllowed,
  TRIGGER_ACTIONS,
} from "@/lib/wheel";

describe("sanitizeTriggerActions", () => {
  it("conserve une liste valide", () => {
    expect(sanitizeTriggerActions(["instagram", "optin"])).toEqual([
      "instagram",
      "optin",
    ]);
  });

  it("filtre les valeurs inconnues (dont l'avis)", () => {
    expect(sanitizeTriggerActions(["instagram", "review", "x"])).toEqual([
      "instagram",
    ]);
  });

  it("garde-fou : liste vide → repli instagram", () => {
    expect(sanitizeTriggerActions([])).toEqual(["instagram"]);
  });

  it("non-tableau → repli instagram", () => {
    expect(sanitizeTriggerActions(null)).toEqual(["instagram"]);
    expect(sanitizeTriggerActions(undefined)).toEqual(["instagram"]);
    expect(sanitizeTriggerActions("x")).toEqual(["instagram"]);
  });

  it("déduplique en conservant l'ordre", () => {
    expect(sanitizeTriggerActions(["optin", "optin"])).toEqual(["optin"]);
  });

  it("conserve une seule action non-instagram", () => {
    expect(sanitizeTriggerActions(["loyalty"])).toEqual(["loyalty"]);
  });

  it("dédup + valeurs inconnues mêlées → ordre de première apparition", () => {
    expect(
      sanitizeTriggerActions(["optin", "review", "instagram", "optin"])
    ).toEqual(["optin", "instagram"]);
  });

  it("filtre les entrées non-string (nombres, objets, null)", () => {
    expect(
      sanitizeTriggerActions([1, "instagram", {}, null, "optin"])
    ).toEqual(["instagram", "optin"]);
  });

  it("accepte les trois actions autorisées", () => {
    expect(sanitizeTriggerActions(["instagram", "loyalty", "optin"])).toEqual([
      "instagram",
      "loyalty",
      "optin",
    ]);
    expect(TRIGGER_ACTIONS).toEqual(["instagram", "loyalty", "optin"]);
  });

  it("l'avis n'est jamais une action déclenchante", () => {
    expect(sanitizeTriggerActions(["review"])).toEqual(["instagram"]);
    expect(TRIGGER_ACTIONS).not.toContain("review");
  });
});

describe("isTriggerActionAllowed", () => {
  it("action configurée → true", () => {
    expect(isTriggerActionAllowed("instagram", ["instagram", "loyalty"])).toBe(
      true
    );
    expect(isTriggerActionAllowed("loyalty", ["instagram", "loyalty"])).toBe(
      true
    );
  });

  it("action non configurée → false", () => {
    expect(isTriggerActionAllowed("optin", ["instagram"])).toBe(false);
  });

  it("avis toujours refusé, même avec toutes les actions", () => {
    expect(
      isTriggerActionAllowed("review", ["instagram", "loyalty", "optin"])
    ).toBe(false);
  });

  it("colonne absente (tolérant) → repli instagram autorisé", () => {
    expect(isTriggerActionAllowed("instagram", undefined)).toBe(true);
    expect(isTriggerActionAllowed("instagram", null)).toBe(true);
    // mais une autre action reste refusée sous le repli
    expect(isTriggerActionAllowed("loyalty", undefined)).toBe(false);
  });

  it("liste vide (garde-fou) → repli instagram", () => {
    expect(isTriggerActionAllowed("loyalty", [])).toBe(false);
    expect(isTriggerActionAllowed("instagram", [])).toBe(true);
  });

  it("playType non-string → false", () => {
    expect(isTriggerActionAllowed(undefined, ["instagram"])).toBe(false);
    expect(isTriggerActionAllowed(42, ["instagram"])).toBe(false);
  });

  it("valeur inconnue → false (jamais dans TRIGGER_ACTIONS)", () => {
    expect(isTriggerActionAllowed("banana", ["instagram", "loyalty"])).toBe(
      false
    );
  });
});
