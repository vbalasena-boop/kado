import { describe, it, expect } from "vitest";
import { hasClickCollect } from "@/lib/auth";

/**
 * `hasClickCollect` est la règle UNIQUE du Click & Collect : elle décide à la
 * fois de l'affichage du menu « Commandes », du garde de route
 * (`requireClickCollect`), du bouton « Commander » sur la page de jeu, de la
 * page publique `/commander` et de l'API de commande.
 *
 * Ces cas verrouillent notamment la formule « Comptoir », vendue avec
 * « Commande en ligne incluse » : trois copies incomplètes de la règle
 * l'oubliaient, et le client ne pouvait pas commander.
 */
describe("hasClickCollect", () => {
  it("formule « Comptoir » → inclus (vendu avec « Commande en ligne incluse »)", () => {
    expect(
      hasClickCollect({ plan: "comptoir", subscription_status: "active" })
    ).toBe(true);
  });

  it("formule « Complet » → inclus", () => {
    expect(
      hasClickCollect({ plan: "complet", subscription_status: "active" })
    ).toBe(true);
  });

  it("essai gratuit → inclus quelle que soit la formule", () => {
    expect(hasClickCollect({ plan: "roue", subscription_status: "trial" })).toBe(
      true
    );
    expect(
      hasClickCollect({ plan: "fidelite", subscription_status: "trial" })
    ).toBe(true);
  });

  it("formule « Jeux » ou « Fidélité » payante sans option → exclu", () => {
    expect(
      hasClickCollect({ plan: "roue", subscription_status: "active" })
    ).toBe(false);
    expect(
      hasClickCollect({ plan: "fidelite", subscription_status: "active" })
    ).toBe(false);
  });

  it("option `click_collect` activée → inclus même sur une formule sans C&C", () => {
    expect(
      hasClickCollect({
        plan: "roue",
        subscription_status: "active",
        click_collect: true,
      })
    ).toBe(true);
  });

  it("option absente ou nulle → exclu (lecture tolérante)", () => {
    expect(
      hasClickCollect({
        plan: "roue",
        subscription_status: "active",
        click_collect: null,
      })
    ).toBe(false);
    expect(
      hasClickCollect({
        plan: "roue",
        subscription_status: "active",
        click_collect: undefined,
      })
    ).toBe(false);
  });
});
