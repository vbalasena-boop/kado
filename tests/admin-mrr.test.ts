import { describe, it, expect } from "vitest";
import { businessMrrEur, summarizeMrr } from "@/lib/admin-mrr";

describe("businessMrrEur", () => {
  it("formule de base d'un abonné actif", () => {
    expect(
      businessMrrEur({ subscription_status: "active", plan: "complet" })
    ).toBe(44);
  });
  it("ajoute les options campagnes (+15) et comptoir (+12)", () => {
    expect(
      businessMrrEur({
        subscription_status: "active",
        plan: "roue",
        campaigns_addon: true,
        order_tracking: true,
      })
    ).toBe(29 + 15 + 12);
  });
  it("essai = 0 (pas encore payant)", () => {
    expect(
      businessMrrEur({ subscription_status: "trial", plan: "complet" })
    ).toBe(0);
  });
  it("suspendu = 0 même si abonnement actif", () => {
    expect(
      businessMrrEur({
        status: "suspended",
        subscription_status: "active",
        plan: "complet",
      })
    ).toBe(0);
  });
  it("formule inconnue/nulle = 0 de base", () => {
    expect(businessMrrEur({ subscription_status: "active", plan: null })).toBe(0);
  });
});

describe("summarizeMrr", () => {
  it("agrège MRR, ARR, nombre de payants et répartition", () => {
    const s = summarizeMrr([
      { subscription_status: "active", plan: "complet" }, // 44
      { subscription_status: "active", plan: "fidelite", campaigns_addon: true }, // 19+15
      { subscription_status: "trial", plan: "complet" }, // 0
    ]);
    expect(s.mrrEur).toBe(44 + 34);
    expect(s.arrEur).toBe((44 + 34) * 12);
    expect(s.payingCount).toBe(2);
    expect(s.byPlan).toEqual({ complet: 44, fidelite: 34 });
  });
});
