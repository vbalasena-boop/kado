import { describe, it, expect } from "vitest";
import { isValidEmail, autoSendCodeTarget, needsCollectStep } from "@/lib/optin";

describe("isValidEmail", () => {
  it("accepte une adresse valide", () => {
    expect(isValidEmail("a@b.fr")).toBe(true);
  });

  it("trie les espaces avant de valider", () => {
    expect(isValidEmail("  a@b.fr  ")).toBe(true);
  });

  it("refuse une adresse incomplète", () => {
    expect(isValidEmail("a@")).toBe(false);
  });

  it("refuse une chaîne vide", () => {
    expect(isValidEmail("")).toBe(false);
  });

  it("refuse une chaîne sans arobase ni domaine", () => {
    expect(isValidEmail("x")).toBe(false);
  });

  it("refuse null / undefined sans planter", () => {
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
  });

  it("refuse plusieurs arobases ou des espaces internes", () => {
    expect(isValidEmail("a@b@c.fr")).toBe(false);
    expect(isValidEmail("a b@c.fr")).toBe(false);
  });

  it("refuse une adresse trop longue (> 254)", () => {
    expect(isValidEmail("a".repeat(250) + "@b.fr")).toBe(false);
  });
});

describe("needsCollectStep", () => {
  it("Offres et Fidélité passent par l'étape e-mail", () => {
    expect(needsCollectStep("optin")).toBe(true);
    expect(needsCollectStep("loyalty")).toBe(true);
  });
  it("Instagram (et autres) non", () => {
    expect(needsCollectStep("instagram")).toBe(false);
    expect(needsCollectStep("review")).toBe(false);
    expect(needsCollectStep(undefined)).toBe(false);
  });
});

describe("autoSendCodeTarget", () => {
  it("renvoie l'e-mail quand gagné + e-mail valide + code", () => {
    expect(
      autoSendCodeTarget({ capturedEmail: "a@b.fr", code: "X1", isWin: true })
    ).toBe("a@b.fr");
  });

  it("trie l'e-mail renvoyé", () => {
    expect(
      autoSendCodeTarget({ capturedEmail: " a@b.fr ", code: "X1", isWin: true })
    ).toBe("a@b.fr");
  });

  it("renvoie null sans e-mail capté", () => {
    expect(
      autoSendCodeTarget({ capturedEmail: null, code: "X1", isWin: true })
    ).toBe(null);
  });

  it("renvoie null si perdu / pas de code utile", () => {
    expect(
      autoSendCodeTarget({ capturedEmail: "a@b.fr", code: "", isWin: false })
    ).toBe(null);
  });

  it("renvoie null si gagné mais code vide", () => {
    expect(
      autoSendCodeTarget({ capturedEmail: "a@b.fr", code: "", isWin: true })
    ).toBe(null);
  });

  it("renvoie null si code seulement des espaces", () => {
    expect(
      autoSendCodeTarget({ capturedEmail: "a@b.fr", code: "   ", isWin: true })
    ).toBe(null);
  });

  it("renvoie null si perdu même avec code + e-mail valides", () => {
    expect(
      autoSendCodeTarget({ capturedEmail: "a@b.fr", code: "X1", isWin: false })
    ).toBe(null);
  });

  it("renvoie null si e-mail capté invalide", () => {
    expect(
      autoSendCodeTarget({ capturedEmail: "a@", code: "X1", isWin: true })
    ).toBe(null);
  });
});
