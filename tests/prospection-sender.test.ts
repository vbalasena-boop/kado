import { describe, it, expect } from "vitest";
import { unsubToken, verifyUnsubToken, unsubUrl } from "@/lib/prospection/unsub";
import { finalizeBody } from "@/lib/prospection/sender";
import { UNSUBSCRIBE_MARKER } from "@/lib/prospection/templates";

describe("jetons de désinscription", () => {
  it("génère un jeton stable et vérifiable", () => {
    const t = unsubToken("Contact@Resto.FR");
    expect(t).toHaveLength(32);
    // insensible à la casse / aux espaces
    expect(unsubToken(" contact@resto.fr ")).toBe(t);
    expect(verifyUnsubToken("contact@resto.fr", t)).toBe(true);
  });

  it("rejette un jeton invalide", () => {
    expect(verifyUnsubToken("contact@resto.fr", "mauvais")).toBe(false);
    expect(verifyUnsubToken("autre@resto.fr", unsubToken("contact@resto.fr"))).toBe(false);
  });

  it("construit une URL de désinscription", () => {
    const url = unsubUrl("contact@resto.fr", "https://kado-app.fr/");
    expect(url).toContain("/api/prospection/unsubscribe?");
    expect(url).toContain("e=contact%40resto.fr");
    expect(url).toContain("t=");
  });
});

describe("finalizeBody", () => {
  it("remplace le marqueur par le vrai lien de désinscription", () => {
    const body = `Bonjour\nDésinscription : ${UNSUBSCRIBE_MARKER}`;
    const out = finalizeBody(body, "contact@resto.fr", "https://kado-app.fr");
    expect(out).not.toContain(UNSUBSCRIBE_MARKER);
    expect(out).toContain("/api/prospection/unsubscribe?");
  });
});
