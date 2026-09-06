import { describe, it, expect } from "vitest";
import {
  onboardingSteps,
  onboardingProgress,
  type OnboardingSignals,
} from "@/lib/onboarding";

const base: OnboardingSignals = {
  hasLogo: false,
  hasLinks: false,
  loyaltyAvailable: false,
  loyaltyActive: false,
  afficheDeployed: false,
  hasPlays: false,
  slug: "cafe",
};

describe("onboardingSteps", () => {
  it("sans fidélité → 4 étapes, aucune étape « toujours à faire »", () => {
    const steps = onboardingSteps(base);
    expect(steps.map((s) => s.key)).toEqual(["logo", "links", "affiche", "play"]);
  });

  it("formule avec fidélité → étape fidélité insérée", () => {
    const steps = onboardingSteps({ ...base, loyaltyAvailable: true });
    expect(steps.map((s) => s.key)).toContain("loyalty");
    expect(steps.length).toBe(5);
  });

  it("chaque étape reflète son signal réel", () => {
    const steps = onboardingSteps({
      ...base,
      hasLogo: true,
      hasLinks: true,
      afficheDeployed: true,
      hasPlays: true,
    });
    const done = Object.fromEntries(steps.map((s) => [s.key, s.done]));
    expect(done).toMatchObject({
      logo: true,
      links: true,
      affiche: true,
      play: true,
    });
  });

  it("affiche déployée ⟺ signal fourni (scan/jeu), indépendant du logo", () => {
    expect(
      onboardingSteps({ ...base, afficheDeployed: true }).find(
        (s) => s.key === "affiche"
      )?.done
    ).toBe(true);
  });

  it("l'étape « tester ma roue » ouvre l'aperçu dans un nouvel onglet", () => {
    const play = onboardingSteps(base).find((s) => s.key === "play")!;
    expect(play.external).toBe(true);
    expect(play.href).toBe("/cafe?preview=1");
  });
});

describe("onboardingProgress", () => {
  it("compte les étapes faites et détecte l'achèvement", () => {
    const none = onboardingProgress(onboardingSteps(base));
    expect(none).toEqual({ done: 0, total: 4, allDone: false });

    const all = onboardingProgress(
      onboardingSteps({
        ...base,
        hasLogo: true,
        hasLinks: true,
        afficheDeployed: true,
        hasPlays: true,
      })
    );
    expect(all).toEqual({ done: 4, total: 4, allDone: true });
  });
});
