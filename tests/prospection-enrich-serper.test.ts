import { describe, it, expect } from "vitest";
import {
  instagramHandleFromResults,
  officialWebsiteFromResults,
} from "@/lib/prospection/enrich-serper";

describe("instagramHandleFromResults", () => {
  it("prend le 1ᵉ handle Instagram valide", () => {
    const r = [
      { link: "https://www.tripadvisor.fr/xyz" },
      { link: "https://www.instagram.com/le_bon_resto/" },
    ];
    expect(instagramHandleFromResults(r)).toBe("le_bon_resto");
  });
  it("ignore les liens Instagram non-profil (p/, reel/…)", () => {
    const r = [{ link: "https://instagram.com/p/ABC123/" }];
    expect(instagramHandleFromResults(r)).toBeNull();
  });
  it("renvoie null si aucun lien Instagram", () => {
    expect(instagramHandleFromResults([{ link: "https://exemple.fr" }])).toBeNull();
  });
});

describe("officialWebsiteFromResults", () => {
  it("prend le 1ᵉ site officiel (ni réseau ni plateforme)", () => {
    const r = [
      { link: "https://www.facebook.com/leresto" },
      { link: "https://www.thefork.com/le-resto" },
      { link: "https://www.le-resto-versailles.fr/menu" },
    ];
    expect(officialWebsiteFromResults(r)).toBe("https://le-resto-versailles.fr");
  });
  it("renvoie null si tout est plateforme/réseau", () => {
    const r = [
      { link: "https://instagram.com/x" },
      { link: "https://www.tripadvisor.fr/x" },
    ];
    expect(officialWebsiteFromResults(r)).toBeNull();
  });
});
