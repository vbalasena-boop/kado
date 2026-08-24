import { describe, it, expect } from "vitest";
import {
  segmentKeywords,
  placeToProspect,
  mockProspects,
  searchProspects,
} from "@/lib/prospection/places";

describe("segmentKeywords", () => {
  it("renvoie des mots-clés par segment", () => {
    expect(segmentKeywords("resto")).toContain("restaurant");
    expect(segmentKeywords("beaute")).toContain("salon de coiffure");
  });
});

describe("placeToProspect", () => {
  it("normalise un lieu Places complet", () => {
    const p = placeToProspect(
      {
        id: "ChIJ123",
        displayName: { text: "Le Petit Café" },
        formattedAddress: "1 rue X, Lyon",
        rating: 4.2,
        userRatingCount: 30,
        websiteUri: "https://petitcafe.fr",
        primaryType: "cafe",
      },
      "resto",
      "Lyon"
    );
    expect(p).toMatchObject({
      place_id: "ChIJ123",
      name: "Le Petit Café",
      category: "resto",
      city: "Lyon",
      google_rating: 4.2,
      google_reviews_count: 30,
      website: "https://petitcafe.fr",
    });
  });

  it("gère les champs absents sans planter", () => {
    const p = placeToProspect(
      { id: "x", displayName: { text: "Sans avis" } },
      "boutique",
      "Nice"
    );
    expect(p?.google_rating).toBeNull();
    expect(p?.google_reviews_count).toBeNull();
    expect(p?.website).toBeNull();
  });

  it("rejette un lieu sans id ou sans nom", () => {
    expect(placeToProspect({ displayName: { text: "X" } }, "resto", "Lyon")).toBeNull();
    expect(placeToProspect({ id: "y" }, "resto", "Lyon")).toBeNull();
  });
});

describe("mockProspects", () => {
  it("respecte la limite", () => {
    const list = mockProspects("Lyon", ["resto", "beaute"], 5);
    expect(list).toHaveLength(5);
  });

  it("produit des place_id uniques et des signaux variés", () => {
    const list = mockProspects("Lyon", ["resto", "beaute", "boutique"], 12);
    const ids = new Set(list.map((p) => p.place_id));
    expect(ids.size).toBe(list.length);
    // au moins un prospect à faible nombre d'avis (bonne cible Kado)
    expect(list.some((p) => (p.google_reviews_count ?? 0) < 30)).toBe(true);
  });
});

describe("searchProspects (mode démo sans clé API)", () => {
  const prev = process.env.GOOGLE_PLACES_API_KEY;
  it("retombe sur les données factices quand la clé manque", async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const res = await searchProspects({
      city: "Lyon",
      segments: ["resto"],
      limit: 3,
    });
    expect(res.mock).toBe(true);
    expect(res.prospects).toHaveLength(3);
    expect(res.prospects[0].city).toBe("Lyon");
    if (prev) process.env.GOOGLE_PLACES_API_KEY = prev;
  });
});
