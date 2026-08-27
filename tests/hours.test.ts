import { describe, it, expect } from "vitest";
import { isOpenAt, isOpenNow, sanitizeHours, type OrderHours } from "@/lib/hours";

// Lundi = 1. Créneau normal le lundi 09:00–18:00.
const normal: OrderHours = { "1": ["09:00", "18:00"] };
// Vendredi (5) ouvert 18:00–01:00 (à cheval sur minuit).
const overnight: OrderHours = { "5": ["18:00", "01:00"] };

describe("isOpenAt — créneau normal", () => {
  it("ouvert pendant la plage", () => {
    expect(isOpenAt(normal, 1, 10 * 60)).toBe(true);
  });
  it("fermé avant / après", () => {
    expect(isOpenAt(normal, 1, 8 * 60)).toBe(false);
    expect(isOpenAt(normal, 1, 18 * 60)).toBe(false); // borne haute exclue
  });
  it("fermé un autre jour", () => {
    expect(isOpenAt(normal, 2, 10 * 60)).toBe(false);
  });
});

describe("isOpenAt — à cheval sur minuit (18:00–01:00 vendredi)", () => {
  it("ouvert le vendredi soir (19:00)", () => {
    expect(isOpenAt(overnight, 5, 19 * 60)).toBe(true);
  });
  it("ouvert le samedi petit matin (00:30) via le créneau de la veille", () => {
    expect(isOpenAt(overnight, 6, 30)).toBe(true);
  });
  it("fermé le samedi après la fin du créneau (01:00)", () => {
    expect(isOpenAt(overnight, 6, 60)).toBe(false);
  });
  it("fermé le vendredi avant l'ouverture (17:00)", () => {
    expect(isOpenAt(overnight, 5, 17 * 60)).toBe(false);
  });
});

describe("isOpenNow", () => {
  it("toujours ouvert si aucun horaire configuré", () => {
    expect(isOpenNow(null)).toBe(true);
    expect(isOpenNow({})).toBe(true);
  });
});

describe("sanitizeHours", () => {
  it("accepte un créneau à cheval sur minuit (from > to)", () => {
    const out = sanitizeHours({ "5": ["18:00", "01:00"] });
    expect(out?.["5"]).toEqual(["18:00", "01:00"]);
  });
  it("rejette from == to (nul)", () => {
    const out = sanitizeHours({ "5": ["18:00", "18:00"] });
    expect(out?.["5"]).toBeNull();
  });
  it("rejette un format d'heure invalide", () => {
    const out = sanitizeHours({ "1": ["9h", "18:00"] });
    expect(out?.["1"]).toBeNull();
  });
});
