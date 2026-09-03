import { describe, it, expect } from "vitest";
import {
  cleanHandle,
  parseInstagramHandles,
  handleToName,
  MAX_INSTA_IMPORT,
} from "@/lib/prospection/insta-import";

describe("cleanHandle", () => {
  it("retire @, met en minuscule", () => {
    expect(cleanHandle("@Le.Bouillon")).toBe("le.bouillon");
  });
  it("extrait le handle d'une URL Instagram", () => {
    expect(cleanHandle("https://instagram.com/cafe.des.amis/")).toBe("cafe.des.amis");
    expect(cleanHandle("instagram.com/salon_marie?hl=fr")).toBe("salon_marie");
  });
  it("rejette les handles réservés / invalides", () => {
    expect(cleanHandle("@reel")).toBeNull();
    expect(cleanHandle("@")).toBeNull();
    expect(cleanHandle("12345")).toBeNull(); // que des chiffres
  });
});

describe("parseInstagramHandles", () => {
  it("parse un collage multi-lignes, déduplique", () => {
    const raw = "@a.shop\nb_shop\ninstagram.com/a.shop\n  c.shop , d.shop ";
    expect(parseInstagramHandles(raw)).toEqual(["a.shop", "b_shop", "c.shop", "d.shop"]);
  });
  it("plafonne à MAX_INSTA_IMPORT", () => {
    const raw = Array.from({ length: 150 }, (_, i) => "shop" + i).join("\n");
    expect(parseInstagramHandles(raw).length).toBe(MAX_INSTA_IMPORT);
  });
  it("renvoie [] pour un texte vide ou sans handle valide", () => {
    expect(parseInstagramHandles("   \n , ; ")).toEqual([]);
  });
});

describe("handleToName", () => {
  it("devine un nom lisible depuis un handle", () => {
    expect(handleToName("le.bouillon.versailles")).toBe("Le Bouillon Versailles");
    expect(handleToName("salon_marie")).toBe("Salon Marie");
  });
});
