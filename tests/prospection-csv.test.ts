import { describe, it, expect } from "vitest";
import { parseCsv, mapCsv } from "@/lib/prospection/csv";

describe("parseCsv", () => {
  it("détecte le séparateur point-virgule", () => {
    const rows = parseCsv("a;b;c\n1;2;3");
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("détecte la virgule", () => {
    const rows = parseCsv("a,b\n1,2");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("gère les champs entre guillemets avec séparateur interne", () => {
    const rows = parseCsv('nom;ville\n"Bar, chez Léon";Versailles');
    expect(rows[1]).toEqual(["Bar, chez Léon", "Versailles"]);
  });

  it("gère les guillemets échappés", () => {
    const rows = parseCsv('a\n"Il dit ""oui"""');
    expect(rows[1]).toEqual(['Il dit "oui"']);
  });

  it("ignore les lignes vides et le BOM", () => {
    const rows = parseCsv("﻿a;b\n\n1;2\n");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("mapCsv", () => {
  it("mappe les en-têtes FR vers les champs internes", () => {
    const csv = "nom;ville;email;instagram;avis;note\nCafé du Coin;Versailles;bonjour@cafe.fr;@cafeducoin;12;4.5";
    const { rows } = mapCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Café du Coin",
      city: "Versailles",
      email: "bonjour@cafe.fr",
      instagram_handle: "@cafeducoin",
      google_reviews_count: 12,
      google_rating: 4.5,
    });
  });

  it("mappe aussi les en-têtes EN", () => {
    const csv = "name,city,email\nJoe's,Paris,joe@x.com";
    const { rows } = mapCsv(csv);
    expect(rows[0]).toMatchObject({ name: "Joe's", city: "Paris", email: "joe@x.com" });
  });

  it("ignore les lignes sans nom", () => {
    const csv = "nom;email\n;orphelin@x.com\nVrai;vrai@x.com";
    const { rows } = mapCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Vrai");
  });

  it("remonte les colonnes inconnues", () => {
    const csv = "nom;telephone\nX;0102030405";
    const { rows, unknownHeaders } = mapCsv(csv);
    expect(rows[0].name).toBe("X");
    expect(rows[0]).not.toHaveProperty("telephone");
    expect(unknownHeaders).toContain("telephone");
  });

  it("renvoie vide si pas d'en-tête + données", () => {
    expect(mapCsv("nom;ville").rows).toEqual([]);
    expect(mapCsv("").rows).toEqual([]);
  });

  it("nettoie les nombres avec virgule décimale et unités", () => {
    const csv = "nom;note;avis\nX;4,7;1 234";
    const { rows } = mapCsv(csv);
    expect(rows[0].google_rating).toBe(4.7);
    expect(rows[0].google_reviews_count).toBe(1234);
  });
});
