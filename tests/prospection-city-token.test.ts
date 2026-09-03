import { describe, it, expect } from "vitest";
import { splitActiveToken, applyPickedCity } from "@/lib/prospection/city-token";

describe("splitActiveToken", () => {
  it("sans séparateur, tout est le jeton courant", () => {
    expect(splitActiveToken("Versa")).toEqual(["", "Versa"]);
  });

  it("isole le jeton après la dernière virgule", () => {
    expect(splitActiveToken("Versailles, Le Chesn")).toEqual([
      "Versailles,",
      " Le Chesn",
    ]);
  });

  it("gère point-virgule et retour ligne", () => {
    expect(splitActiveToken("Paris;Lyo")[1]).toBe("Lyo");
    expect(splitActiveToken("Paris\nMars")[1]).toBe("Mars");
  });

  it("jeton vide juste après un séparateur", () => {
    expect(splitActiveToken("Versailles,")).toEqual(["Versailles,", ""]);
  });
});

describe("applyPickedCity", () => {
  it("complète une saisie simple (une seule ville)", () => {
    expect(applyPickedCity("Versa", "Versailles")).toBe("Versailles");
  });

  it("conserve les villes déjà saisies et normalise l'espace", () => {
    expect(applyPickedCity("Versailles, Le Chesn", "Le Chesnay")).toBe(
      "Versailles, Le Chesnay"
    );
  });

  it("ajoute une espace manquante après la virgule du préfixe", () => {
    expect(applyPickedCity("Versailles,Le Chesn", "Le Chesnay")).toBe(
      "Versailles, Le Chesnay"
    );
  });

  it("remplace un jeton vide après séparateur", () => {
    expect(applyPickedCity("Versailles, ", "Paris")).toBe("Versailles, Paris");
  });
});
