import { describe, it, expect } from "vitest";
import {
  signResubToken,
  verifyResubToken,
  encodeEmail,
  decodeEmail,
} from "@/lib/resubscribe";

const BID = "biz-123";
const EMAIL = "client@example.fr";
const NOW = 1_000_000_000_000; // instant de référence fixe (ms)

describe("verifyResubToken — matrice", () => {
  it("Valide non expiré → true", () => {
    const exp = NOW + 1000;
    const t = signResubToken(BID, EMAIL, exp);
    expect(verifyResubToken(BID, EMAIL, exp, t, NOW)).toBe(true);
  });

  it("Expiré (exp <= now) → false", () => {
    const exp = NOW; // exp === now : non strictement supérieur
    const t = signResubToken(BID, EMAIL, exp);
    expect(verifyResubToken(BID, EMAIL, exp, t, NOW)).toBe(false);

    const past = NOW - 1;
    const t2 = signResubToken(BID, EMAIL, past);
    expect(verifyResubToken(BID, EMAIL, past, t2, NOW)).toBe(false);
  });

  it("Mauvais e-mail → false", () => {
    const exp = NOW + 1000;
    const t = signResubToken(BID, EMAIL, exp);
    expect(verifyResubToken(BID, "autre@example.fr", exp, t, NOW)).toBe(false);
  });

  it("Mauvais business → false", () => {
    const exp = NOW + 1000;
    const t = signResubToken(BID, EMAIL, exp);
    expect(verifyResubToken("autre-biz", EMAIL, exp, t, NOW)).toBe(false);
  });

  it("exp altéré (rejoue une autre expiration) → false", () => {
    const exp = NOW + 1000;
    const t = signResubToken(BID, EMAIL, exp);
    // Le client tente de prolonger la validité en changeant exp.
    expect(verifyResubToken(BID, EMAIL, exp + 999999, t, NOW)).toBe(false);
  });

  it("Falsifié → false", () => {
    const exp = NOW + 1000;
    const t = signResubToken(BID, EMAIL, exp);
    const tampered = t.slice(0, -1) + (t.endsWith("a") ? "b" : "a");
    expect(verifyResubToken(BID, EMAIL, exp, tampered, NOW)).toBe(false);
  });

  it("Vide → false", () => {
    const exp = NOW + 1000;
    expect(verifyResubToken(BID, EMAIL, exp, "", NOW)).toBe(false);
  });

  it("exp non numérique (NaN) → false", () => {
    const t = signResubToken(BID, EMAIL, NOW + 1000);
    expect(verifyResubToken(BID, EMAIL, NaN, t, NOW)).toBe(false);
  });

  it("insensible à la casse de l'e-mail", () => {
    const exp = NOW + 1000;
    const t = signResubToken(BID, "Client@Example.FR", exp);
    expect(verifyResubToken(BID, EMAIL, exp, t, NOW)).toBe(true);
  });
});

describe("encodeEmail / decodeEmail — round-trip base64url", () => {
  it("round-trip conserve l'e-mail (minuscules)", () => {
    expect(decodeEmail(encodeEmail(EMAIL))).toBe(EMAIL);
  });

  it("normalise en minuscules au décodage", () => {
    expect(decodeEmail(encodeEmail("Client@Example.FR"))).toBe(EMAIL);
  });

  it("gère les caractères non-ASCII", () => {
    const mail = "prénom.nom@éxample.fr";
    expect(decodeEmail(encodeEmail(mail))).toBe(mail.toLowerCase());
  });

  it("décodage d'une entrée vide → chaîne vide", () => {
    expect(decodeEmail("")).toBe("");
  });
});
