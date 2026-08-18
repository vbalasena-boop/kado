import { describe, it, expect } from "vitest";

// ⚠️ TEST TEMPORAIRE — vérifie que l'alerte CI se déclenche bien.
// Il échoue VOLONTAIREMENT. À supprimer juste après (voir commit suivant).
describe("Auto-vérification du filet de sécurité", () => {
  it("déclenche une alerte quand quelque chose casse", () => {
    expect(1 + 1).toBe(3); // faux exprès → la CI doit passer au rouge
  });
});
