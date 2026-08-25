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
// `unsubscribed_at` courant de la carte, lié à la signature (usage unique).
const UNSUB = "2020-01-01T00:00:00.000Z";

describe("verifyResubToken — matrice", () => {
  it("Valide non expiré → true", () => {
    const exp = NOW + 1000;
    const t = signResubToken(BID, EMAIL, exp, UNSUB);
    expect(verifyResubToken(BID, EMAIL, exp, UNSUB, t, NOW)).toBe(true);
  });

  it("Expiré (exp <= now) → false", () => {
    const exp = NOW; // exp === now : non strictement supérieur
    const t = signResubToken(BID, EMAIL, exp, UNSUB);
    expect(verifyResubToken(BID, EMAIL, exp, UNSUB, t, NOW)).toBe(false);

    const past = NOW - 1;
    const t2 = signResubToken(BID, EMAIL, past, UNSUB);
    expect(verifyResubToken(BID, EMAIL, past, UNSUB, t2, NOW)).toBe(false);
  });

  it("Mauvais e-mail → false", () => {
    const exp = NOW + 1000;
    const t = signResubToken(BID, EMAIL, exp, UNSUB);
    expect(verifyResubToken(BID, "autre@example.fr", exp, UNSUB, t, NOW)).toBe(
      false
    );
  });

  it("Mauvais business → false", () => {
    const exp = NOW + 1000;
    const t = signResubToken(BID, EMAIL, exp, UNSUB);
    expect(verifyResubToken("autre-biz", EMAIL, exp, UNSUB, t, NOW)).toBe(false);
  });

  it("usage unique : unsubAt différent (re-désinscrit) → false", () => {
    const exp = NOW + 1000;
    const t = signResubToken(BID, EMAIL, exp, UNSUB);
    // La carte a été re-désinscrite depuis → nouveau timestamp courant.
    expect(
      verifyResubToken(BID, EMAIL, exp, "2021-06-06T00:00:00.000Z", t, NOW)
    ).toBe(false);
  });

  it("usage unique : ré-abonné entre-temps (unsubAt null → \"\") → false", () => {
    const exp = NOW + 1000;
    const t = signResubToken(BID, EMAIL, exp, UNSUB);
    // Carte ré-abonnée : unsubscribed_at=null → unsubAt re-dérivé "".
    expect(verifyResubToken(BID, EMAIL, exp, null, t, NOW)).toBe(false);
    expect(verifyResubToken(BID, EMAIL, exp, "", t, NOW)).toBe(false);
  });

  it("exp altéré (rejoue une autre expiration) → false", () => {
    const exp = NOW + 1000;
    const t = signResubToken(BID, EMAIL, exp, UNSUB);
    // Le client tente de prolonger la validité en changeant exp.
    expect(verifyResubToken(BID, EMAIL, exp + 999999, UNSUB, t, NOW)).toBe(
      false
    );
  });

  it("Falsifié → false", () => {
    const exp = NOW + 1000;
    const t = signResubToken(BID, EMAIL, exp, UNSUB);
    const tampered = t.slice(0, -1) + (t.endsWith("a") ? "b" : "a");
    expect(verifyResubToken(BID, EMAIL, exp, UNSUB, tampered, NOW)).toBe(false);
  });

  it("Vide → false", () => {
    const exp = NOW + 1000;
    expect(verifyResubToken(BID, EMAIL, exp, UNSUB, "", NOW)).toBe(false);
  });

  it("exp non numérique (NaN) → false", () => {
    const t = signResubToken(BID, EMAIL, NOW + 1000, UNSUB);
    expect(verifyResubToken(BID, EMAIL, NaN, UNSUB, t, NOW)).toBe(false);
  });

  it("insensible à la casse de l'e-mail", () => {
    const exp = NOW + 1000;
    const t = signResubToken(BID, "Client@Example.FR", exp, UNSUB);
    expect(verifyResubToken(BID, EMAIL, exp, UNSUB, t, NOW)).toBe(true);
  });

  it("null et \"\" produisent la même signature (normalisation)", () => {
    const exp = NOW + 1000;
    const tNull = signResubToken(BID, EMAIL, exp, null);
    expect(verifyResubToken(BID, EMAIL, exp, "", tNull, NOW)).toBe(true);
  });

  it("canonisation epoch : deux représentations du même instant → true", () => {
    const exp = NOW + 1000;
    // Signé avec un ISO sans millisecondes, vérifié avec l'ISO à millisecondes.
    const t = signResubToken(BID, EMAIL, exp, "2020-01-01T00:00:00Z");
    expect(
      verifyResubToken(BID, EMAIL, exp, "2020-01-01T00:00:00.000Z", t, NOW)
    ).toBe(true);
    // …et l'inverse (l'ordre de sérialisation ne doit rien changer).
    const t2 = signResubToken(BID, EMAIL, exp, "2020-01-01T00:00:00.000Z");
    expect(verifyResubToken(BID, EMAIL, exp, "2020-01-01T00:00:00Z", t2, NOW)).toBe(
      true
    );
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
