import { describe, it, expect } from "vitest";
import { weightedIndex, generateCode } from "@/lib/draw";

describe("weightedIndex", () => {
  it("renvoie toujours un index valide", () => {
    const prizes = [{ weight: 3 }, { weight: 1 }, { weight: 6 }];
    for (let i = 0; i < 200; i++) {
      const idx = weightedIndex(prizes);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(prizes.length);
    }
  });

  it("ne tire que le lot au poids exclusif", () => {
    const prizes = [{ weight: 100 }, { weight: 0 }, { weight: 0 }];
    for (let i = 0; i < 100; i++) {
      expect(weightedIndex(prizes)).toBe(0);
    }
  });

  it("gère des poids tous nuls sans planter", () => {
    const prizes = [{ weight: 0 }, { weight: 0 }];
    const idx = weightedIndex(prizes);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(2);
  });

  it("respecte grossièrement la distribution des poids", () => {
    const prizes = [{ weight: 9 }, { weight: 1 }];
    let zero = 0;
    const N = 5000;
    for (let i = 0; i < N; i++) if (weightedIndex(prizes) === 0) zero++;
    // ~90 % attendu ; on tolère large pour éviter la flakiness
    expect(zero / N).toBeGreaterThan(0.8);
  });
});

describe("generateCode", () => {
  it("respecte le format KD-XXXXX par défaut", () => {
    expect(generateCode()).toMatch(/^KD-[A-Z0-9]{5}$/);
  });

  it("applique le préfixe demandé", () => {
    expect(generateCode("FID")).toMatch(/^FID-[A-Z0-9]{5}$/);
  });
});
