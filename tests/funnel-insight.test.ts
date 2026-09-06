import { describe, it, expect } from "vitest";
import { funnelInsight, type FunnelSignals } from "@/lib/funnel-insight";

// Base « saine » qu'on dérive dans chaque cas.
const base: FunnelSignals = {
  scans: 100,
  plays: 80,
  insta: 40,
  reviewClicks: 30,
  reviewLinkReady: true,
  instagramReady: true,
};

describe("funnelInsight", () => {
  it("scans nombreux mais 0 partie → alerte fuite à l'entrée", () => {
    const r = funnelInsight({ ...base, scans: 50, plays: 0 });
    expect(r.tone).toBe("warn");
    expect(r.message).toMatch(/scannent/i);
  });

  it("0 partie et peu de scans → encourage, pas d'alarme", () => {
    const r = funnelInsight({ ...base, scans: 3, plays: 0 });
    expect(r.tone).toBe("good");
    expect(r.message).toMatch(/démarre/i);
  });

  it("lien avis absent → conseille de l'ajouter (prioritaire)", () => {
    const r = funnelInsight({ ...base, reviewLinkReady: false });
    expect(r.tone).toBe("tip");
    expect(r.message).toMatch(/lien d'avis Google/i);
  });

  it("lien avis absent l'emporte même sur un bon taux Instagram", () => {
    const r = funnelInsight({
      ...base,
      reviewLinkReady: false,
      insta: 80,
      reviewClicks: 0,
    });
    expect(r.message).toMatch(/Ajoutez votre lien/i);
  });

  it("échantillon trop faible (< 10 parties) → encourage sans diagnostic de taux", () => {
    const r = funnelInsight({ ...base, plays: 5, reviewClicks: 0 });
    expect(r.tone).toBe("good");
    expect(r.message).toMatch(/Bon démarrage/i);
  });

  it("taux de clics avis faible → conseille de mettre le lien en avant + %", () => {
    const r = funnelInsight({ ...base, plays: 100, reviewClicks: 5 });
    expect(r.tone).toBe("tip");
    expect(r.message).toMatch(/5% de vos joueurs cliquent/);
  });

  it("avis OK mais Instagram sous-exploité → coup de pouce Instagram", () => {
    const r = funnelInsight({
      ...base,
      plays: 100,
      reviewClicks: 40,
      insta: 10,
    });
    expect(r.tone).toBe("tip");
    expect(r.message).toMatch(/Instagram/);
    expect(r.message).toMatch(/10%/);
  });

  it("Instagram non relié → ne déclenche pas le conseil Instagram", () => {
    const r = funnelInsight({
      ...base,
      plays: 100,
      reviewClicks: 40,
      insta: 0,
      instagramReady: false,
    });
    expect(r.tone).toBe("good");
    expect(r.message).toMatch(/Beau parcours/);
  });

  it("tout sain → félicite et chiffre le taux d'avis", () => {
    const r = funnelInsight({
      ...base,
      plays: 100,
      reviewClicks: 40,
      insta: 60,
    });
    expect(r.tone).toBe("good");
    expect(r.message).toMatch(/40%/);
  });

  it("le seuil avis prime sur le seuil Instagram quand les deux sont bas", () => {
    const r = funnelInsight({
      ...base,
      plays: 100,
      reviewClicks: 2,
      insta: 2,
    });
    // On adresse d'abord l'objectif n°1 (avis Google), pas Instagram.
    expect(r.message).toMatch(/avis Google/);
  });
});
