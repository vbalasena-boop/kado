import { describe, it, expect } from "vitest";
import { slugify } from "@/lib/defaults";

describe("slugify", () => {
  it("retire les accents et met en minuscules", () => {
    expect(slugify("Salon Éléonore")).toBe("salon-eleonore");
  });

  it("remplace les caractères spéciaux par des tirets", () => {
    expect(slugify("  Café Crème !! ")).toBe("cafe-creme");
  });

  it("retombe sur « commerce » quand le résultat est vide", () => {
    expect(slugify("")).toBe("commerce");
    expect(slugify("###")).toBe("commerce");
  });

  it("limite la longueur à 40 caractères", () => {
    const long = "a".repeat(80);
    expect(slugify(long).length).toBeLessThanOrEqual(40);
  });
});
