import { describe, it, expect } from "vitest";

process.env.PLAYER_COOKIE_SECRET = "test-secret-unsub-token";

// Import APRÈS avoir fixé le secret (le module le lit à l'appel, mais on reste
// prudent sur l'ordre pour la lisibilité).
import { unsubToken, verifyUnsubToken } from "@/lib/unsub";

describe("verifyUnsubToken (comparaison à temps constant)", () => {
  const biz = "biz-42";
  const email = "client@example.com";

  it("accepte le jeton légitime", () => {
    const t = unsubToken(biz, email);
    expect(verifyUnsubToken(biz, email, t)).toBe(true);
  });

  it("rejette un jeton falsifié de même longueur", () => {
    const t = unsubToken(biz, email);
    const tampered = (t[0] === "a" ? "b" : "a") + t.slice(1);
    expect(verifyUnsubToken(biz, email, tampered)).toBe(false);
  });

  it("rejette un jeton d'une autre paire (b, email)", () => {
    const t = unsubToken(biz, email);
    expect(verifyUnsubToken(biz, "autre@example.com", t)).toBe(false);
    expect(verifyUnsubToken("autre-biz", email, t)).toBe(false);
  });

  it("rejette les entrées vides ou de mauvaise longueur", () => {
    const t = unsubToken(biz, email);
    expect(verifyUnsubToken("", email, t)).toBe(false);
    expect(verifyUnsubToken(biz, "", t)).toBe(false);
    expect(verifyUnsubToken(biz, email, "")).toBe(false);
    expect(verifyUnsubToken(biz, email, t.slice(0, 10))).toBe(false);
  });
});
